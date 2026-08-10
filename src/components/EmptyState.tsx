import { ShieldIcon } from './icons'

const PROMPTS = [
  'Explain how on-device inference protects privacy',
  'Draft a short bio for a photography portfolio',
  'Write a function that reverses a linked list',
  'Compare two approaches to a tricky decision',
]

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
        <ShieldIcon className="h-7 w-7 text-amber-400" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Haven</h1>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">
          Private by default. No accounts, no message logs — conversations live only in this browser.
        </p>
      </div>
      <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-neutral-300 hover:bg-white/10 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
