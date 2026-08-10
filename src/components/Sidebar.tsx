import type { Conversation } from '../types'
import { PlusIcon, ShieldIcon, TrashIcon } from './icons'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  open: boolean
  onClose: () => void
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, open, onClose }: Props) {
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
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(c.id)
                  }}
                  className="ml-2 shrink-0 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 px-4 py-3">
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
