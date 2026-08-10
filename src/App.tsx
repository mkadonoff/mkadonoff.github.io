import { useEffect, useRef, useState } from 'react'
import type { Conversation, Message } from './types'
import { DEFAULT_MODEL_ID } from './data/models'
import { loadConversations, saveConversations } from './lib/storage'
import { generateReply, streamReply } from './lib/respond'
import { Sidebar } from './components/Sidebar'
import { ModelPicker } from './components/ModelPicker'
import { MessageBubble } from './components/MessageBubble'
import { Composer } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import { MenuIcon } from './components/icons'

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function titleFromText(text: string) {
  const words = text.trim().split(/\s+/).slice(0, 6).join(' ')
  return words.length < text.trim().length ? `${words}…` : words
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sending, setSending] = useState(false)
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

  async function sendMessage(text: string) {
    const conv = active ?? createConversation()
    const modelId = conv.modelId

    const userMsg: Message = { id: makeId(), role: 'user', content: text, createdAt: Date.now() }
    const assistantId = makeId()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      modelId,
      createdAt: Date.now(),
    }

    updateConversation(conv.id, (c) => ({
      ...c,
      title: c.messages.length === 0 ? titleFromText(text) : c.title,
      messages: [...c.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
    }))

    setSending(true)
    const controller = new AbortController()
    abortRef.current = controller
    const fullText = generateReply(text, modelId)

    await streamReply(
      fullText,
      (soFar) => {
        updateConversation(conv.id, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: soFar } : m)),
        }))
      },
      controller.signal,
    )

    setSending(false)
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={() => createConversation()}
        onDelete={deleteConversation}
        open={sidebarOpen}
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

        <Composer disabled={sending} onSend={sendMessage} />
      </div>
    </div>
  )
}
