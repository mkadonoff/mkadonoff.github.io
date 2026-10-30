import { useEffect, useRef, useState } from 'react'
import type { Conversation, EngineState, Message } from './types'
import { MODELS } from './data/models'
import { clearConversations, loadConversations, saveConversations } from './lib/storage'
import type { InitProgressReport } from '@mlc-ai/web-llm'
import { toChatHistory } from './lib/respond'
import { interruptGeneration, isWebGPUSupported } from './lib/engine'
import { prepareGenerator } from './lib/generate'
import { getLocationLine, isLocationSharingEnabled, setLocationSharingEnabled } from './lib/location'
import { buildGeofenceLine, captureGeofenceAnchor, stripGeofenceMarker } from './lib/geofence'
import { getReading, heartRateLine } from './lib/heartRate'
import { describeEngineError, engineErrorText } from './lib/engineErrors'
import { getVeniceKey, isVeniceModelId, veniceModelName } from './lib/venice'
import { Sidebar } from './components/Sidebar'
import { ModelPicker } from './components/ModelPicker'
import { MessageBubble } from './components/MessageBubble'
import { Composer } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import { EngineBanner } from './components/EngineBanner'
import { HeartRatePanel } from './components/HeartRatePanel'
import { SettingsSheet } from './components/SettingsSheet'
import { getCoachModelId, getDefaultModelId } from './lib/settings'
import { SessionSheet } from './components/SessionSheet'
import { SessionBar } from './components/SessionBar'
import { useSharedSession } from './lib/useSharedSession'
import { buildCoachPrompt } from './lib/session'
import { CoachBar } from './components/CoachBar'
import { SystemPromptPanel } from './components/SystemPromptPanel'
import { ToolbarButton } from './components/ToolbarButton'
import { HeartIcon, InfoIcon, LocationIcon, MenuIcon, PeopleIcon, PlusIcon } from './components/icons'

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function titleFromText(text: string) {
  const words = text.trim().split(/\s+/).slice(0, 6).join(' ')
  return words.length < text.trim().length ? `${words}…` : words
}

function isMobile() {
  return !window.matchMedia('(min-width: 768px)').matches
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [sending, setSending] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showHeartRate, setShowHeartRate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [veniceKeySet, setVeniceKeySet] = useState(() => !!getVeniceKey())
  const [locationSharing, setLocationSharing] = useState(isLocationSharingEnabled)
  const [, forceRerender] = useState(0)
  const [engineState, setEngineState] = useState<EngineState>({
    status: 'idle',
    modelId: null,
    progress: 0,
    progressText: '',
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Session event handlers run outside render, so they read conversations through a ref.
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations

  const session = useSharedSession({
    getConversations: () => conversationsRef.current,
    setConversations,
    setActiveId,
    onEngineProgress: reportEngineProgress,
  })

  useEffect(() => {
    const loaded = loadConversations()
    setConversations(loaded)
    if (loaded.length > 0) setActiveId(loaded[0].id)
  }, [])

  useEffect(() => {
    saveConversations(conversations)
  }, [conversations])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [activeId, conversations])

  const active = conversations.find((c) => c.id === activeId) ?? null
  const shared = active?.shared ?? null
  const coachSession = active?.coachFor ? (conversations.find((c) => c.id === active.coachFor) ?? null) : null
  const sharedConnected = !!shared && session.liveId === active?.id && session.connected

  function updateConversation(id: string, updater: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)))
  }

  function createConversation(modelId = getDefaultModelId()): Conversation {
    const conv: Conversation = {
      id: makeId(),
      title: 'New chat',
      modelId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setConversations((prev) => [conv, ...prev])
    setActiveId(conv.id)
    return conv
  }

  function deleteConversation(id: string) {
    session.forget(id)
    const index = conversations.findIndex((c) => c.id === id)
    const remaining = conversations.filter((c) => c.id !== id)
    setConversations(remaining)
    // Land on whichever chat took its place rather than dropping to the empty state.
    if (activeId === id) {
      setActiveId(remaining.length > 0 ? remaining[Math.min(index, remaining.length - 1)].id : null)
    }
  }

  /**
   * One private coach chat per session on this phone. It runs on this phone's own model — a Venice
   * model when a key is saved, since on-device models are too small to follow a session well.
   */
  function openCoach(sessionConv: Conversation) {
    const existing = conversations.find((c) => c.coachFor === sessionConv.id)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const conv: Conversation = {
      id: makeId(),
      title: `Private coach · ${sessionConv.shared?.peerName ?? 'session'}`,
      modelId: getCoachModelId(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      coachFor: sessionConv.id,
    }
    setConversations((prev) => [conv, ...prev])
    setActiveId(conv.id)
  }

  function deleteAllConversations() {
    // The save effect immediately writes "[]" back over the removed key — harmless, but it's why
    // the storage entry reappears empty rather than staying absent.
    clearConversations()
    setConversations([])
    setActiveId(null)
  }

  function toggleLocationSharing() {
    const next = !locationSharing
    setLocationSharingEnabled(next)
    setLocationSharing(next)
    if (next) {
      // Resolve right away instead of waiting for the next send, so the prompt
      // viewer (and the model) has it as soon as possible.
      getLocationLine().then(() => forceRerender((v) => v + 1))
    }
  }

  function reportEngineProgress(report: InitProgressReport, webllmId: string) {
    setEngineState({ status: 'loading', modelId: webllmId, progress: report.progress, progressText: report.text, error: null })
  }

  function stopGenerating() {
    abortRef.current?.abort()
    interruptGeneration()
    setSending(false)
  }

  async function sendMessage(text: string) {
    if (active?.shared) {
      session.sendText(text)
      return
    }
    const conv = active ?? createConversation()
    const cloud = isVeniceModelId(conv.modelId)
    const model = MODELS.find((m) => m.id === conv.modelId) ?? MODELS[0]

    const userMsg: Message = { id: makeId(), role: 'user', content: text, createdAt: Date.now() }
    const assistantId = makeId()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      modelId: conv.modelId,
      createdAt: Date.now(),
    }

    const priorMessages = conv.messages

    updateConversation(conv.id, (c) => ({
      ...c,
      title: c.messages.length === 0 && !c.coachFor ? titleFromText(text) : c.title,
      messages: [...c.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
    }))

    if (!cloud && !(await isWebGPUSupported())) {
      updateConversation(conv.id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "This browser doesn't support WebGPU, so Haven can't run a model on-device here. Try a recent version of Chrome, Edge, or Firefox on desktop.",
              }
            : m,
        ),
      }))
      return
    }

    setSending(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const generate = await prepareGenerator(conv.modelId, reportEngineProgress)
      // For Venice this clears a leftover on-device error banner, which no longer applies to this chat.
      setEngineState(
        cloud
          ? { status: 'idle', modelId: null, progress: 0, progressText: '', error: null }
          : { status: 'ready', modelId: model.webllmId, progress: 1, progressText: '', error: null },
      )

      const linked = conv.coachFor ? conversationsRef.current.find((c) => c.id === conv.coachFor) : undefined
      let history: ReturnType<typeof toChatHistory>
      if (linked?.shared) {
        // A private coach reads the session in place of device context. On-device models hold about 4K
        // tokens, so they see a much shorter stretch of it.
        const coachPrompt = buildCoachPrompt(linked.shared, linked.messages, cloud ? 12_000 : 1_500)
        history = [{ role: 'system', content: coachPrompt }, ...toChatHistory([...priorMessages, userMsg]).slice(1)]
      } else {
        const locationLine = await getLocationLine()

        let geofenceLine: string | null = null
        if (isLocationSharingEnabled()) {
          let anchor = conv.geofenceAnchor
          if (!anchor) {
            try {
              anchor = await captureGeofenceAnchor()
              updateConversation(conv.id, (c) => ({ ...c, geofenceAnchor: anchor }))
            } catch {
              anchor = undefined
            }
          }
          if (anchor) geofenceLine = await buildGeofenceLine(anchor)
        }

        history = toChatHistory([...priorMessages, userMsg], {
          cloud,
          locationLine,
          geofenceLine,
          heartRateLine: heartRateLine(),
        })
      }

      let resetRequested = false
      await generate(
        history,
        (soFar) => {
          const { cleaned, triggered } = stripGeofenceMarker(soFar)
          if (triggered) resetRequested = true
          updateConversation(conv.id, (c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: cleaned } : m)),
          }))
        },
        controller.signal,
      )

      if (resetRequested) {
        try {
          const newAnchor = await captureGeofenceAnchor()
          updateConversation(conv.id, (c) => ({
            ...c,
            geofenceAnchor: newAnchor,
            messages: c.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: `${m.content}\n\n_Geofence start point updated to your current location${
                      newAnchor.place ? ` (${newAnchor.place})` : ''
                    }._`,
                  }
                : m,
            ),
          }))
        } catch {
          // couldn't re-resolve location — leave the previous anchor in place
        }
      }
    } catch (err) {
      const error = describeEngineError(err)
      setEngineState({ status: 'error', modelId: cloud ? null : model.webllmId, progress: 0, progressText: '', error })
      updateConversation(conv.id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === assistantId && m.content.length === 0
            ? { ...m, content: engineErrorText(error) }
            : m,
        ),
      }))
    } finally {
      setSending(false)
      setEngineState((s) => (s.status === 'loading' ? { ...s, status: 'idle' } : s))
    }
  }

  // h-dvh rather than h-screen: on iOS Safari 100vh is the *large* viewport height, which assumes
  // the URL bar is hidden. That makes the shell taller than the visible area, so the page itself
  // scrolls and the header drifts off screen. dvh tracks the visible viewport, keyboard included.
  return (
    <div className="flex h-dvh bg-neutral-950 text-neutral-100">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id)
          if (isMobile()) setSidebarOpen(false)
        }}
        onNew={() => {
          createConversation()
          if (isMobile()) setSidebarOpen(false)
        }}
        onDelete={deleteConversation}
        onDeleteAll={deleteAllConversations}
        onOpenSettings={() => {
          setShowSettings(true)
          if (isMobile()) setSidebarOpen(false)
        }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-3">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle sidebar"
            className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
          >
            <MenuIcon className="h-4.5 w-4.5" />
          </button>
          {/* Starting a chat otherwise means opening the sidebar first, which on mobile covers
              the screen. Keep it one tap away and always visible. */}
          <ToolbarButton
            icon={PlusIcon}
            title="New chat"
            onClick={() => {
              createConversation()
              if (isMobile()) setSidebarOpen(false)
            }}
          />
          {shared ? (
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-200">{active?.title}</p>
          ) : (
          <ModelPicker
            modelId={active?.modelId ?? getDefaultModelId()}
            veniceKeySet={veniceKeySet}
            onChange={(modelId) => {
              if (active) updateConversation(active.id, (c) => ({ ...c, modelId }))
              else createConversation(modelId)
            }}
            onManageVenice={() => setShowSettings(true)}
          />
          )}

          <div className="ml-auto flex items-center gap-0.5">
            <ToolbarButton
              icon={PeopleIcon}
              active={session.connected}
              title="Start or join a mediated session with another person"
              onClick={() => session.setSheet({ step: 'menu' })}
            />
            <ToolbarButton
              icon={InfoIcon}
              active={showPrompt}
              title={showPrompt ? 'Hide system prompt' : 'View the system prompt sent to the model'}
              onClick={() => setShowPrompt((v) => !v)}
            />
            {/* Sessions never carry either person's sensor data, so these controls don't apply there. */}
            {shared || coachSession ? null : (
              <>
            <ToolbarButton
              icon={HeartIcon}
              active={showHeartRate || !!getReading()}
              title={getReading() ? 'Heart rate shared with the model — tap to re-measure' : 'Measure your heart rate'}
              onClick={() => setShowHeartRate((v) => !v)}
            />
            <ToolbarButton
              icon={LocationIcon}
              active={locationSharing}
              title={
                locationSharing
                  ? 'Location sharing on — your approximate location is sent to a geocoding service and given to the model'
                  : 'Share your approximate location with the model'
              }
              onClick={toggleLocationSharing}
            />
              </>
            )}
          </div>
        </header>

        {shared && active ? (
          <SessionBar
            session={shared}
            connected={sharedConnected}
            mediatorBusy={session.mediatorBusy && session.liveId === active.id}
            onPause={session.pause}
            onResume={session.resume}
            onSafeword={session.callSafeword}
            onLiftSafeword={session.liftSafeword}
            onAgreement={() => session.setSheet({ step: 'agreement' })}
            onCoach={() => openCoach(active)}
            onLeave={() => {
              if (window.confirm(`Leave the session with ${shared.peerName ?? 'the other person'}? This ends it for both of you.`)) {
                session.leave()
              }
            }}
            onReconnect={() =>
              shared.role === 'host' ? session.reconnect(active) : session.setSheet({ step: 'join', error: null })
            }
          />
        ) : null}

        {coachSession?.shared ? (
          <CoachBar session={coachSession.shared} onBack={() => setActiveId(coachSession.id)} />
        ) : null}

        <EngineBanner state={engineState} />

        {showPrompt || showHeartRate ? (
          <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3">
            {showHeartRate ? (
              <HeartRatePanel
                onClose={() => setShowHeartRate(false)}
                onReading={() => forceRerender((v) => v + 1)}
              />
            ) : null}
            {showPrompt ? (
              <SystemPromptPanel
                locationSharing={locationSharing}
                geofenceActive={!!active?.geofenceAnchor}
                cloud={isVeniceModelId(active?.modelId)}
                shared={shared}
                coach={coachSession?.shared && active ? buildCoachPrompt(coachSession.shared, coachSession.messages, isVeniceModelId(active.modelId) ? 12_000 : 1_500) : null}
                onClose={() => setShowPrompt(false)}
              />
            ) : null}
          </div>
        ) : null}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!active || active.messages.length === 0 ? (
            <EmptyState onPick={sendMessage} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
              {active.messages.map((m) => (
                <MessageBubble key={m.id} message={m} shared={shared} />
              ))}
            </div>
          )}
        </div>

        <Composer
          disabled={shared ? !sharedConnected || !!shared.pausedBy || shared.ended : sending}
          onSend={sendMessage}
          onStop={sending && !shared ? stopGenerating : undefined}
          shared={shared}
          coachFor={coachSession?.shared ?? null}
          locationSharing={locationSharing}
          cloudModelName={active && isVeniceModelId(active.modelId) ? veniceModelName(active.modelId) : null}
        />
      </div>

      {showSettings ? (
        <SettingsSheet
          onClose={() => setShowSettings(false)}
          onVeniceKeyChange={(key) => setVeniceKeySet(!!key)}
          locationSharing={locationSharing}
          onToggleLocation={toggleLocationSharing}
        />
      ) : null}

      <SessionSheet
        sheet={session.sheet}
        session={shared}
        onClose={session.closeSheet}
        onEditAgreement={() => session.setSheet({ step: 'agreement-edit' })}
        onPropose={(agreement) => {
          session.propose(agreement)
          session.setSheet({ step: 'closed' })
        }}
        onRespond={(accept) => {
          session.respondToProposal(accept)
          session.setSheet({ step: 'closed' })
        }}
        onWithdraw={() => {
          session.withdraw()
          session.setSheet({ step: 'closed' })
        }}
        onStartForm={() => session.setSheet({ step: 'host-form' })}
        onJoinForm={() => session.setSheet({ step: 'join', error: null })}
        onHost={(options) => void session.startHosting(options)}
        onSubmitAnswer={(code) => void session.submitAnswer(code)}
        onJoin={(code) => void session.joinWithCode(code)}
        onAccept={session.acceptSetup}
        onDecline={session.declineSetup}
      />
    </div>
  )
}
