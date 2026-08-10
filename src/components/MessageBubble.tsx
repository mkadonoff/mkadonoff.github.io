import type { Message } from '../types'
import { MODELS } from '../data/models'

function renderContent(content: string) {
  const parts = content.split(/```ts\n([\s\S]*?)```/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <pre key={i} className="my-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-amber-200">
        <code>{part}</code>
      </pre>
    ) : (
      <span key={i} className="whitespace-pre-wrap">
        {part}
      </span>
    ),
  )
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const model = message.modelId ? MODELS.find((m) => m.id === message.modelId) : undefined

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75ch] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isUser && model && <span className="px-1 text-[11px] font-medium text-neutral-500">{model.name}</span>}
        <div
          className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
            isUser
              ? 'bg-amber-500 text-neutral-950 rounded-br-sm'
              : 'bg-white/5 text-neutral-100 rounded-bl-sm border border-white/5'
          }`}
        >
          {renderContent(message.content)}
          {message.content.length === 0 && (
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
