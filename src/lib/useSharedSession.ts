import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { InitProgressReport } from '@mlc-ai/web-llm'
import type { Conversation, Message, SharedSession } from '../types'
import { acceptAnswer, answerOffer, createOffer, joinLink, primeLocalAddresses, type PeerLink } from './peer'
import {
  buildMediatorHistory,
  isPass,
  isWireMessage,
  makeSessionId,
  mightBePass,
  saveName,
  upsertMessage,
  type SetupMessage,
  type WireMessage,
} from './session'
import { prepareGenerator } from './generate'
import { describeEngineError, engineErrorText } from './engineErrors'

/** Long enough for a slow handshake, short enough that someone isn't left staring at a spinner. */
const CONNECT_TIMEOUT_MS = 20_000
/** Streaming the mediator's reply to the guest: often enough to feel live, not once per token. */
const STREAM_INTERVAL_MS = 150

export type SessionSheet =
  | { step: 'closed' }
  | { step: 'menu' }
  | { step: 'host-form' }
  | { step: 'working'; label: string }
  | { step: 'host-offer'; code: string; link: string; error: string | null }
  | { step: 'host-waiting' }
  | { step: 'join'; error: string | null }
  | { step: 'guest-answer'; code: string; connected: boolean }
  | { step: 'guest-consent'; setup: SetupMessage }
  | { step: 'notice'; title: string; body: string }

export interface HostOptions {
  name: string
  modelId: string
  modelLabel: string
  cloud: boolean
  instructions: string
}

interface Live {
  convId: string
  modelId: string
  session: SharedSession
  messages: Message[]
}

interface Options {
  getConversations: () => Conversation[]
  setConversations: Dispatch<SetStateAction<Conversation[]>>
  setActiveId: (id: string) => void
  onEngineProgress: (report: InitProgressReport, webllmId: string) => void
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

const CONNECT_FAILED = {
  title: "The phones couldn't connect",
  body:
    'Haven connects the phones directly, with no server in between. That works best with both phones on the same Wi-Fi network. ' +
    'Mobile data and some guest or office networks block direct connections. Check both phones are on the same Wi-Fi and try again.',
}

export function useSharedSession({ getConversations, setConversations, setActiveId, onEngineProgress }: Options) {
  const [sheet, setSheet] = useState<SessionSheet>({ step: 'closed' })
  const [liveId, setLiveId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [mediatorBusy, setMediatorBusy] = useState(false)

  const linkRef = useRef<PeerLink | null>(null)
  const liveRef = useRef<Live | null>(null)
  const hostSetupRef = useRef<{ setup: SetupMessage; convId: string | null } | null>(null)
  const guestSetupRef = useRef<SetupMessage | null>(null)
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** True while the current link is still being paired, before it carries a live session. */
  const pairingRef = useRef(false)
  const mediatorRef = useRef({ running: false, pending: false, abort: null as AbortController | null })

  // ---------- persistence ----------

  function writeConversation(convId: string, update: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => (c.id === convId ? update(c) : c)))
  }

  function applyMessage(message: Message) {
    const live = liveRef.current
    if (!live) return
    live.messages = upsertMessage(live.messages, message)
    writeConversation(live.convId, (c) => ({ ...c, messages: upsertMessage(c.messages, message), updatedAt: Date.now() }))
  }

  function removeMessage(id: string) {
    const live = liveRef.current
    if (!live) return
    live.messages = live.messages.filter((m) => m.id !== id)
    writeConversation(live.convId, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== id) }))
  }

  function updateSession(patch: Partial<SharedSession>) {
    const live = liveRef.current
    if (!live) return
    live.session = { ...live.session, ...patch }
    writeConversation(live.convId, (c) => (c.shared ? { ...c, shared: { ...c.shared, ...patch } } : c))
  }

  // ---------- link lifecycle ----------

  function clearConnectTimer() {
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current)
    connectTimerRef.current = null
  }

  function startConnectTimer() {
    clearConnectTimer()
    connectTimerRef.current = setTimeout(() => {
      if (linkRef.current?.isOpen) return
      dropLink()
      setSheet({ step: 'notice', ...CONNECT_FAILED })
    }, CONNECT_TIMEOUT_MS)
  }

  /** Closes any current link without marking the session ended — it can be reconnected later. */
  function dropLink() {
    const link = linkRef.current
    linkRef.current = null
    if (link) {
      link.onClose = null
      link.close()
    }
    mediatorRef.current.abort?.abort()
    setConnected(false)
  }

  function install(link: PeerLink, onMessage: (m: WireMessage) => void) {
    dropLink()
    pairingRef.current = true
    linkRef.current = link
    link.onMessage = (raw) => {
      if (isWireMessage(raw)) onMessage(raw)
    }
    link.onClose = () => {
      if (linkRef.current !== link) return
      linkRef.current = null
      clearConnectTimer()
      setConnected(false)
      mediatorRef.current.abort?.abort()
      // Mid-handshake, a closed link means the attempt failed; once live, the session bar shows it.
      setSheet((s) =>
        s.step === 'host-waiting' || s.step === 'guest-answer' || s.step === 'guest-consent'
          ? { step: 'notice', title: 'The connection closed', body: 'The other phone disconnected before the session started.' }
          : s,
      )
    }
  }

  function send(message: WireMessage) {
    linkRef.current?.send(message)
  }

  function goLive(live: Live) {
    pairingRef.current = false
    liveRef.current = live
    setLiveId(live.convId)
    setConnected(true)
    setActiveId(live.convId)
    setSheet({ step: 'closed' })
  }

  // ---------- host ----------

  async function host(setup: SetupMessage, convId: string | null) {
    setSheet({ step: 'working', label: 'Preparing the invitation code…' })
    try {
      await primeLocalAddresses()
      const { link, code } = await createOffer()
      hostSetupRef.current = { setup, convId }
      install(link, handleHostMessage)
      link.onOpen = () => {
        clearConnectTimer()
        link.send(setup)
        setSheet({ step: 'host-waiting' })
      }
      setSheet({ step: 'host-offer', code, link: joinLink(code), error: null })
    } catch (err) {
      setSheet({ step: 'notice', title: "Couldn't start a session", body: err instanceof Error ? err.message : String(err) })
    }
  }

  function startHosting(options: HostOptions) {
    saveName(options.name)
    const setup: SetupMessage = {
      t: 'setup',
      sessionId: makeSessionId(),
      hostName: options.name,
      modelId: options.modelId,
      modelLabel: options.modelLabel,
      cloud: options.cloud,
      instructions: options.instructions,
    }
    return host(setup, null)
  }

  /** Same session, same agreed instructions — the guest's phone recognises it and rejoins. */
  function reconnect(conv: Conversation) {
    const shared = conv.shared
    if (!shared || shared.role !== 'host') return
    return host(
      {
        t: 'setup',
        sessionId: shared.sessionId,
        hostName: shared.hostName,
        modelId: conv.modelId,
        modelLabel: shared.modelLabel,
        cloud: shared.cloud,
        instructions: shared.instructions,
      },
      conv.id,
    )
  }

  async function submitAnswer(input: string) {
    const link = linkRef.current
    if (!link || sheet.step !== 'host-offer') return
    try {
      await acceptAnswer(link, input)
      setSheet({ step: 'working', label: 'Connecting to the other phone…' })
      startConnectTimer()
    } catch (err) {
      setSheet({ ...sheet, error: err instanceof Error ? err.message : String(err) })
    }
  }

  function handleHostMessage(message: WireMessage) {
    const live = liveRef.current
    switch (message.t) {
      case 'accept': {
        const pending = hostSetupRef.current
        if (!pending) return
        hostSetupRef.current = null
        const { setup } = pending
        const name = message.name.trim() || 'Guest'
        let conv = pending.convId ? getConversations().find((c) => c.id === pending.convId) : undefined
        if (!conv) {
          conv = {
            id: makeId(),
            title: `Session with ${name}`,
            modelId: setup.modelId,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          const created = conv
          setConversations((prev) => [created, ...prev])
        }
        const session: SharedSession = {
          sessionId: setup.sessionId,
          role: 'host',
          selfName: setup.hostName,
          peerName: name,
          hostName: setup.hostName,
          instructions: setup.instructions,
          modelLabel: setup.modelLabel,
          cloud: setup.cloud,
          pausedBy: conv.shared?.pausedBy ?? null,
          ended: false,
        }
        writeConversation(conv.id, (c) => ({ ...c, shared: session }))
        goLive({ convId: conv.id, modelId: setup.modelId, session, messages: conv.messages })
        // The host's transcript is the record: replay it so the guest's copy matches.
        for (const m of conv.messages) send({ t: 'msg', message: m })
        if (session.pausedBy) send({ t: 'pause', by: session.pausedBy })
        return
      }
      case 'decline':
        hostSetupRef.current = null
        dropLink()
        setSheet({ step: 'notice', title: 'Invitation declined', body: 'The other person chose not to join this session.' })
        return
      case 'msg': {
        // Only the guest's own words are accepted — never a mediator reply or a message in the host's name.
        if (!live || live.session.ended || message.message.role !== 'user') return
        applyMessage({ ...message.message, from: 'guest', author: live.session.peerName ?? message.message.author, modelId: undefined })
        void runMediator()
        return
      }
      case 'pause':
        if (!live) return
        updateSession({ pausedBy: 'guest' })
        mediatorRef.current.abort?.abort()
        return
      case 'resume':
        if (live?.session.pausedBy === 'guest') updateSession({ pausedBy: null })
        return
      case 'leave':
        endSession()
        return
    }
  }

  // ---------- mediator (host only) ----------

  async function runMediator() {
    const state = mediatorRef.current
    if (state.running) {
      state.pending = true
      return
    }
    state.running = true
    setMediatorBusy(true)
    try {
      do {
        state.pending = false
        await mediatorTurn()
      } while (state.pending && liveRef.current && !liveRef.current.session.pausedBy && !liveRef.current.session.ended)
    } finally {
      state.running = false
      setMediatorBusy(false)
    }
  }

  async function mediatorTurn() {
    const live = liveRef.current
    if (!live || live.session.role !== 'host' || live.session.pausedBy || live.session.ended) return
    const controller = new AbortController()
    mediatorRef.current.abort = controller
    const id = makeId()
    const createdAt = Date.now()
    let shown = false
    let lastSent = 0

    const emit = (content: string, final: boolean) => {
      const message: Message = { id, role: 'assistant', content, modelId: live.modelId, createdAt }
      applyMessage(message)
      const now = Date.now()
      if (final || now - lastSent >= STREAM_INTERVAL_MS) {
        send({ t: 'msg', message })
        lastSent = now
      }
    }

    let text = ''
    try {
      const generate = await prepareGenerator(live.modelId, onEngineProgress)
      await generate(
        buildMediatorHistory(live.session, live.messages),
        (soFar) => {
          text = soFar
          if (!shown && mightBePass(soFar)) return
          shown = true
          emit(soFar, false)
        },
        controller.signal,
      )
      if (isPass(text)) {
        if (shown) {
          removeMessage(id)
          send({ t: 'drop', id })
        }
        return
      }
      if (text.trim()) emit(text.trim(), true)
    } catch (err) {
      if (controller.signal.aborted) {
        if (shown && text.trim()) emit(text.trim(), true)
        return
      }
      emit(`(The mediator couldn't reply. ${engineErrorText(describeEngineError(err))})`, true)
    }
  }

  // ---------- guest ----------

  async function joinWithCode(input: string) {
    setSheet({ step: 'working', label: 'Joining the session…' })
    try {
      await primeLocalAddresses()
      const { link, code } = await answerOffer(input)
      install(link, handleGuestMessage)
      link.onOpen = () => {
        clearConnectTimer()
        setSheet((s) => (s.step === 'guest-answer' ? { ...s, connected: true } : s))
      }
      setSheet({ step: 'guest-answer', code, connected: false })
      startConnectTimer()
    } catch (err) {
      setSheet({ step: 'join', error: err instanceof Error ? err.message : String(err) })
    }
  }

  function handleGuestMessage(message: WireMessage) {
    const live = liveRef.current
    switch (message.t) {
      case 'setup': {
        const known = getConversations().find((c) => c.shared?.sessionId === message.sessionId && !c.shared.ended)
        // Rejoining needs no fresh consent only if what was agreed hasn't changed.
        if (known?.shared && known.shared.instructions === message.instructions && known.modelId === message.modelId) {
          const session = { ...known.shared, peerName: message.hostName }
          send({ t: 'accept', name: session.selfName })
          writeConversation(known.id, (c) => ({ ...c, shared: session }))
          goLive({ convId: known.id, modelId: known.modelId, session, messages: known.messages })
          return
        }
        guestSetupRef.current = message
        setSheet({ step: 'guest-consent', setup: message })
        return
      }
      case 'msg':
        if (live) applyMessage(message.message)
        return
      case 'drop':
        removeMessage(message.id)
        return
      case 'pause':
        updateSession({ pausedBy: message.by })
        return
      case 'resume':
        updateSession({ pausedBy: null })
        return
      case 'leave':
        endSession()
        return
    }
  }

  function acceptSetup(name: string) {
    const setup = guestSetupRef.current
    if (!setup) return
    guestSetupRef.current = null
    const selfName = name.trim() || 'Guest'
    saveName(selfName)
    const session: SharedSession = {
      sessionId: setup.sessionId,
      role: 'guest',
      selfName,
      peerName: setup.hostName,
      hostName: setup.hostName,
      instructions: setup.instructions,
      modelLabel: setup.modelLabel,
      cloud: setup.cloud,
      pausedBy: null,
      ended: false,
    }
    const conv: Conversation = {
      id: makeId(),
      title: `Session with ${setup.hostName}`,
      modelId: setup.modelId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shared: session,
    }
    setConversations((prev) => [conv, ...prev])
    send({ t: 'accept', name: selfName })
    goLive({ convId: conv.id, modelId: setup.modelId, session, messages: [] })
  }

  function declineSetup() {
    guestSetupRef.current = null
    send({ t: 'decline' })
    // Let the decline reach the host before the link goes away.
    setTimeout(dropLink, 300)
    setSheet({ step: 'closed' })
  }

  /** Closing the sheet mid-pairing abandons that attempt; it never touches a live session. */
  function closeSheet() {
    if (pairingRef.current) {
      pairingRef.current = false
      hostSetupRef.current = null
      guestSetupRef.current = null
      clearConnectTimer()
      dropLink()
    }
    setSheet({ step: 'closed' })
  }

  // ---------- in-session controls ----------

  function sendText(text: string) {
    const live = liveRef.current
    if (!live || !connected || live.session.pausedBy || live.session.ended) return
    const message: Message = {
      id: makeId(),
      role: 'user',
      content: text,
      from: live.session.role,
      author: live.session.selfName,
      createdAt: Date.now(),
    }
    applyMessage(message)
    send({ t: 'msg', message })
    if (live.session.role === 'host') void runMediator()
  }

  function pause() {
    const live = liveRef.current
    if (!live || live.session.pausedBy) return
    updateSession({ pausedBy: live.session.role })
    send({ t: 'pause', by: live.session.role })
    mediatorRef.current.abort?.abort()
  }

  /** Only whoever paused can resume — the other person can't override it. */
  function resume() {
    const live = liveRef.current
    if (!live || live.session.pausedBy !== live.session.role) return
    updateSession({ pausedBy: null })
    send({ t: 'resume' })
  }

  function endSession() {
    updateSession({ ended: true, pausedBy: null })
    dropLink()
  }

  function leave() {
    send({ t: 'leave' })
    // A beat for the message to go out before the channel closes.
    setTimeout(endSession, 300)
  }

  /** For deleting a chat: a live session is left first, so the other phone isn't left hanging. */
  function forget(convId: string) {
    if (liveRef.current?.convId !== convId) return
    send({ t: 'leave' })
    setTimeout(() => {
      dropLink()
      liveRef.current = null
      setLiveId(null)
    }, 300)
  }

  // Opening a join link — from the Camera app or a message — starts joining straight away. The code
  // is stripped from the address bar so a reload or shared link doesn't reuse it.
  useEffect(() => {
    const match = window.location.hash.match(/^#join=(.+)$/)
    if (!match) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    void joinWithCode(match[1])
    // Runs once on load; joinWithCode only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    sheet,
    setSheet,
    closeSheet,
    liveId,
    connected,
    mediatorBusy,
    startHosting,
    reconnect,
    submitAnswer,
    joinWithCode,
    acceptSetup,
    declineSetup,
    sendText,
    pause,
    resume,
    leave,
    forget,
  }
}
