import type { ReactNode } from 'react'

// Shared by every bottom sheet — sessions and settings — so they look and behave alike.

export const button =
  'min-h-11 w-full rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'
export const primary = `${button} bg-amber-500 text-neutral-950`
export const secondary = `${button} border border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10`
// text-base: iOS Safari zooms the page when focusing an input smaller than 16 px.
export const input =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500 outline-none focus:border-amber-500/50'

export function Frame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-neutral-900 p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-100">{title}</h2>
          <button onClick={onClose} className="min-h-9 px-2 text-sm text-neutral-400 hover:text-neutral-200">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-neutral-400">{children}</p>
}

