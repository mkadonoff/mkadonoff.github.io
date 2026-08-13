import type { EngineState } from '../types'
import { MODELS } from '../data/models'

export function EngineBanner({ state }: { state: EngineState }) {
  if (state.status === 'idle') return null

  const model = MODELS.find((m) => m.webllmId === state.modelId)

  if (state.status === 'error' && state.error) {
    return (
      <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2.5">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium text-red-300">{state.error.title}</p>
          {state.error.hint ? <p className="mt-0.5 text-xs text-red-300/80">{state.error.hint}</p> : null}
          {state.error.detail ? (
            <p className="mt-1 text-[11px] text-red-300/50">{state.error.detail}</p>
          ) : null}
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    const pct = Math.round(state.progress * 100)
    return (
      <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <div className="mx-auto flex max-w-3xl items-center gap-3 text-xs text-neutral-400">
          <span className="shrink-0 font-medium text-neutral-300">
            Downloading {model?.name ?? 'model'}{model ? ` (${model.downloadSize})` : ''}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-300"
              style={{ width: `${Math.max(pct, 3)}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right font-medium text-neutral-300 tabular-nums">{pct}%</span>
        </div>
        <p className="mx-auto mt-1 max-w-3xl truncate text-center text-[11px] text-neutral-600">
          {state.progressText || 'Runs once, then this model is cached for next time.'}
        </p>
      </div>
    )
  }

  return null
}
