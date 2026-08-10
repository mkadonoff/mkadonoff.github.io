import { useEffect, useRef, useState } from 'react'
import { MODELS } from '../data/models'
import { ChevronDownIcon } from './icons'

interface Props {
  modelId: string
  onChange: (modelId: string) => void
}

export function ModelPicker({ modelId, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = MODELS.find((m) => m.id === modelId) ?? MODELS[0]

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/10 transition-colors"
      >
        <span className="font-medium">{active.name}</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl shadow-black/50">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChange(m.id)
                setOpen(false)
              }}
              className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors ${
                m.id === modelId ? 'bg-amber-500/10' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium text-neutral-100">{m.name}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                  {m.badge}
                </span>
              </div>
              <span className="mt-0.5 text-xs text-neutral-400">{m.tagline}</span>
              <span className="mt-1 text-[11px] text-neutral-500">
                {m.contextWindow} · {m.downloadSize} download
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
