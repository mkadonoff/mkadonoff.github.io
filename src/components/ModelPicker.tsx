import { useEffect, useRef, useState } from 'react'
import { MODELS } from '../data/models'
import { ChevronDownIcon } from './icons'
import {
  assessModel,
  describeCapability,
  getDeviceCapability,
  hasFailedBefore,
  type DeviceCapability,
  type ModelFit,
} from '../lib/capability'

interface Props {
  modelId: string
  onChange: (modelId: string) => void
}

/** Probed asynchronously so rows render immediately and simply gain badges once it resolves. */
function useDeviceCapability(): DeviceCapability | null {
  const [cap, setCap] = useState<DeviceCapability | null>(null)
  useEffect(() => {
    let alive = true
    getDeviceCapability().then((c) => {
      if (alive) setCap(c)
    })
    return () => {
      alive = false
    }
  }, [])
  return cap
}

function FitBadge({ fit }: { fit: ModelFit }) {
  if (fit.level === 'ok') return null
  const unlikely = fit.level === 'unlikely'
  return (
    <span
      title={fit.reason ?? undefined}
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        unlikely ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'
      }`}
    >
      {unlikely ? 'unlikely to fit' : 'may not fit'}
    </span>
  )
}

export function ModelPicker({ modelId, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = MODELS.find((m) => m.id === modelId) ?? MODELS[0]
  const cap = useDeviceCapability()

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
        <div className="absolute z-20 mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl shadow-black/50">
          {MODELS.map((m) => {
            // Every model stays selectable — these signals are hedges, not measurements.
            const fit = cap ? assessModel(m.webllmId, cap, hasFailedBefore(m.webllmId)) : null
            return (
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
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-100">{m.name}</span>
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                    {m.badge}
                  </span>
                </div>
                <span className="mt-0.5 text-xs text-neutral-400">{m.tagline}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                  <span>
                    {m.contextWindow} · {m.downloadSize} download
                  </span>
                  {fit ? <FitBadge fit={fit} /> : null}
                </span>
                {fit?.reason ? <span className="mt-1 text-[11px] text-neutral-500">{fit.reason}</span> : null}
              </button>
            )
          })}

          <p className="mt-1 border-t border-white/10 px-3 pb-1 pt-2 text-[11px] text-neutral-600">
            {cap ? describeCapability(cap) : 'Checking device limits…'}
            <br />
            Browsers can't report free memory, so these are estimates — a model may still fail to load.
          </p>
        </div>
      )}
    </div>
  )
}
