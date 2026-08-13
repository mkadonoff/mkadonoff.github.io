import { useEffect, useState } from 'react'
import type { Conversation } from '../types'
import { PlusIcon, ShieldIcon, TrashIcon } from './icons'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onDeleteAll: () => void
  open: boolean
  onClose: () => void
}

/** One armed target at a time, so a chat delete and clear-all can't both be pending. */
type Pending = { kind: 'chat'; id: string } | { kind: 'all' } | null

const CONFIRM_TIMEOUT_MS = 4000

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onDeleteAll,
  open,
  onClose,
}: Props) {
  const [pending, setPending] = useState<Pending>(null)

  // Disarm on its own after a moment, so a stray tap never leaves a delete primed.
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setPending(null), CONFIRM_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [pending])

  // A reopened sidebar should never still be armed from last time.
  useEffect(() => {
    if (!open) setPending(null)
  }, [open])

  const isPendingChat = (id: string) => pending?.kind === 'chat' && pending.id === id

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.stopPropagation() // otherwise arming also selects the chat
    if (isPendingChat(id)) {
      onDelete(id)
      setPending(null)
    } else {
      setPending({ kind: 'chat', id })
    }
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 transform border-r border-white/10 bg-neutral-950 transition-transform duration-200 md:static md:z-auto md:transition-[width] ${
          open ? 'translate-x-0 md:w-72' : '-translate-x-full md:w-0 md:translate-x-0'
        } ${open ? '' : 'md:overflow-hidden'}`}
      >
        <div className="flex h-full w-72 flex-col">
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
              <ShieldIcon className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-neutral-100">Haven</span>
          </div>

          <div className="px-3">
            <button
              onClick={onNew}
              className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              New chat
            </button>
          </div>

          <div className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
            {conversations.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-neutral-600">No conversations yet</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  c.id === activeId ? 'bg-white/10 text-neutral-100' : 'text-neutral-400 hover:bg-white/5'
                }`}
              >
                <span className="truncate">{c.title}</span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteClick(e, c.id)}
                  aria-label={isPendingChat(c.id) ? `Confirm deleting ${c.title}` : `Delete ${c.title}`}
                  className={`-mr-1.5 ml-2 flex h-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isPendingChat(c.id)
                      ? 'w-auto px-2 text-[11px] font-medium text-red-400'
                      : 'w-9 text-neutral-500 hover:bg-white/5 hover:text-red-400'
                  }`}
                >
                  {isPendingChat(c.id) ? 'Delete?' : <TrashIcon className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            {conversations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (pending?.kind === 'all') {
                    onDeleteAll()
                    setPending(null)
                  } else {
                    setPending({ kind: 'all' })
                  }
                }}
                className={`mb-2 -ml-1 flex items-center gap-1.5 rounded-lg px-1 py-1 text-[11px] transition-colors ${
                  pending?.kind === 'all'
                    ? 'font-medium text-red-400'
                    : 'text-neutral-500 hover:text-red-400'
                }`}
              >
                <TrashIcon className="h-3 w-3" />
                {pending?.kind === 'all'
                  ? `Delete ${conversations.length === 1 ? 'this chat' : `all ${conversations.length} chats`}?`
                  : 'Clear all chats'}
              </button>
            )}
            <p className="flex items-center gap-1.5 text-[11px] text-neutral-600">
              <ShieldIcon className="h-3 w-3" />
              Stored only on this device
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
