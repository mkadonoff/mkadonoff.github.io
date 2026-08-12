import { useEffect, useRef, useState } from 'react'
import type { Conversation, EngineState, Message } from './types'
import { DEFAULT_MODEL_ID, MODELS } from './data/models'
import { loadConversations, saveConversations } from './lib/storage'
import { toChatHistory, streamModelReply } from './lib/respond'
import { getEngine, interruptGeneration, isWebGPUSupported } from './lib/engine'
import { getLocationLine } from './lib/location'
import { Sidebar } from './components/Sidebar'
import { ModelPicker } from './components/ModelPicker'
import { MessageBubble } from './components/MessageBubble'
import { Composer } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import { EngineBanner } from './components/EngineBanner'
import { MenuIcon } from './components/icons'

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
  const [engineState, setEngineState] = useState<EngineState>({
    status: 'idle',
    modelId: null,
    progress: 0,
    progressText: '',
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  function updateConversation(id: string, updater: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)))
  }

  function createConversation(modelId = DEFAULT_MODEL_ID): Conversation {
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
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeId === id) setActiveId(null)
  }

  function stopGenerating() {
    abortRef.current?.abort()
    interruptGeneration()
    setSending(false)
  }

  async function sendMessage(text: string) {
    const conv = active ?? createConversation()
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
      title: c.messages.length === 0 ? titleFromText(text) : c.title,
      messages: [...c.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
    }))

    if (!(await isWebGPUSupported())) {
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
      const engine = await getEngine(model.webllmId, (report) => {
        setEngineState({
          status: 'loading',
          modelId: model.webllmId,
          progress: report.progress,
          progressText: report.text,
          error: null,
        })
      })
      setEngineState({ status: 'ready', modelId: model.webllmId, progress: 1, progressText: '', error: null })

      const locationLine = await getLocationLine()
      const history = toChatHistory([...priorMessages, userMsg], locationLine)

      await streamModelReply(
        engine,
        history,
        (soFar) => {
          updateConversation(conv.id, (c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: soFar } : m)),
          }))
        },
        controller.signal,
      )
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const message = /fetch/i.test(raw)
        ? "Couldn't download the model. Check your internet connection and try again."
        : raw
      setEngineState({ status: 'error', modelId: model.webllmId, progress: 0, progressText: '', error: message })
      updateConversation(conv.id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === assistantId && m.content.length === 0
            ? { ...m, content: `Couldn't generate a reply: ${message}` }
            : m,
        ),
      }))
    } finally {
      setSending(false)
      setEngineState((s) => (s.status === 'loading' ? { ...s, status: 'idle' } : s))
    }
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
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
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
          >
            <MenuIcon className="h-4.5 w-4.5" />
          </button>
          <ModelPicker
            modelId={active?.modelId ?? DEFAULT_MODEL_ID}
            onChange={(modelId) => {
              if (active) updateConversation(active.id, (c) => ({ ...c, modelId }))
              else createConversation(modelId)
            }}
          />
        </header>

        <EngineBanner state={engineState} />

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!active || active.messages.length === 0 ? (
            <EmptyState onPick={sendMessage} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
              {active.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>

        <Composer disabled={sending} onSend={sendMessage} onStop={sending ? stopGenerating : undefined} />
      </div>
    </div>
  )
}
