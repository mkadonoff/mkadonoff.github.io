import { useEffect, useRef, useState } from 'react'
import { MODELS, modelLabel } from '../data/models'
import { ChevronDownIcon } from './icons'
import {
  assessModel,
  describeCapability,
  getDeviceCapability,
  hasFailedBefore,
  type DeviceCapability,
  type ModelFit,
} from '../lib/capability'
import {
  fetchVeniceModels,
  getCachedVeniceModels,
  isVeniceModelId,
  toVeniceModelId,
  type VeniceModel,
} from '../lib/venice'

interface Props {
  modelId: string
  veniceKeySet: boolean
  onChange: (modelId: string) => void
  onManageVenice: () => void
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

/**
 * Venice's list changes upstream, so it's fetched live — but only once a key is saved, so a visitor
 * who never opts in makes no request to Venice at all. The cached copy shows while it loads.
 */
function useVeniceModels(enabled: boolean, open: boolean) {
  const [models, setModels] = useState<VeniceModel[]>(getCachedVeniceModels)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!enabled || !open) return
    let alive = true
    fetchVeniceModels()
      .then((m) => {
        if (!alive) return
        setModels(m)
        setError(false)
      })
      .catch(() => {
        if (alive) setError(true)
      })
    return () => {
      alive = false
    }
  }, [enabled, open])
  return { models, error }
}

function formatContext(tokens: number | null): string | null {
  if (!tokens) return null
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}K context` : `${tokens} context`
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

export function ModelPicker({ modelId, veniceKeySet, onChange, onManageVenice }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeName = modelLabel(modelId) ?? MODELS[0].name
  const cap = useDeviceCapability()
  const venice = useVeniceModels(veniceKeySet, open)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    // min-w-0 so the trigger can shrink instead of pushing the header wide; real model names like
    // "Qwen2.5 Coder 0.5B Instruct" are long enough to overflow a phone header otherwise.
    <div className="relative min-w-0 flex-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/10 transition-colors"
      >
        <span className="truncate font-medium">{activeName}</span>
        {isVeniceModelId(modelId) ? (
          <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
            Cloud
          </span>
        ) : null}
        <ChevronDownIcon
          className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 max-h-[60dvh] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl shadow-black/50">
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            On-device · private
          </p>
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

          <div className="mt-1 border-t border-white/10 pt-1">
            <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                Venice.ai · cloud
              </p>
              <button
                onClick={() => {
                  onManageVenice()
                  setOpen(false)
                }}
                className="min-h-9 px-1 text-[11px] text-neutral-400 hover:text-neutral-200"
              >
                {veniceKeySet ? 'Manage key' : 'Add key'}
              </button>
            </div>
            {!veniceKeySet ? (
              <p className="px-3 pb-2 text-[11px] text-neutral-500">
                Larger models that run on Venice's servers. Messages in those chats leave this device. Add your
                own API key to enable.
              </p>
            ) : (
              <>
                {venice.models.map((m) => {
                  const id = toVeniceModelId(m.id)
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        onChange(id)
                        setOpen(false)
                      }}
                      className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors ${
                        id === modelId ? 'bg-amber-500/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="text-sm font-medium text-neutral-100">{m.name}</span>
                      <span className="mt-0.5 text-[11px] text-neutral-500">
                        {[formatContext(m.contextTokens), 'no download'].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  )
                })}
                {venice.error ? (
                  <p className="px-3 pb-2 text-[11px] text-red-300/80">Couldn't load Venice's model list.</p>
                ) : venice.models.length === 0 ? (
                  <p className="px-3 pb-2 text-[11px] text-neutral-500">Loading Venice models…</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
