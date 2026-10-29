import type { SharedSession } from '../types'

export function CoachBar({ session, onBack }: { session: SharedSession; onBack: () => void }) {
  const peer = session.peerName ?? 'the other person'
  return (
    <div className="shrink-0 border-b border-white/10 bg-violet-500/10 px-3 py-2">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <p className="min-w-0 flex-1 text-xs leading-snug text-violet-200">
          <span className="font-medium">Private coach.</span> Only you see this chat — {peer} never does. It reads your
          session with {peer} but can't post to it.
        </p>
        <button
          onClick={onBack}
          className="min-h-9 shrink-0 rounded-lg border border-white/10 px-3 text-xs font-medium text-neutral-200 hover:bg-white/10"
        >
          Back to session
        </button>
      </div>
    </div>
  )
}
