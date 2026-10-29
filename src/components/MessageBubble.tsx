import type { Message, SharedSession } from '../types'
import { modelLabel } from '../data/models'
import { isVeniceModelId } from '../lib/venice'

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

export function MessageBubble({ message, shared }: { message: Message; shared?: SharedSession | null }) {
  if (shared) return <SharedBubble message={message} session={shared} />
  const isUser = message.role === 'user'
  const label = modelLabel(message.modelId)
  const cloud = isVeniceModelId(message.modelId)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75ch] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isUser && label && (
          <span className="px-1 text-[11px] font-medium text-neutral-500">
            {label}
            {cloud ? ' · Venice' : ' · on-device'}
          </span>
        )}
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

/**
 * Three voices in a session: you (right, amber), the other person (left, sky) and the mediator
 * (left, neutral). Every bubble is named, since a screenshot shouldn't leave authorship ambiguous.
 */
function SharedBubble({ message, session }: { message: Message; session: SharedSession }) {
  const mediator = message.role === 'assistant'
  const mine = !mediator && message.from === session.role
  const name = mediator ? `Mediator · ${session.modelLabel}` : mine ? 'You' : (message.author ?? session.peerName ?? 'Them')

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75ch] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <span className="px-1 text-[11px] font-medium text-neutral-500">{name}</span>
        <div
          className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
            mine
              ? 'rounded-br-sm bg-amber-500 text-neutral-950'
              : mediator
                ? 'rounded-bl-sm border border-white/5 bg-white/5 text-neutral-100'
                : 'rounded-bl-sm bg-sky-500/20 text-sky-50'
          }`}
        >
          {renderContent(message.content)}
        </div>
      </div>
    </div>
  )
}
