import type { SharedSession } from '../types'

interface Props {
  session: SharedSession
  connected: boolean
  mediatorBusy: boolean
  onPause: () => void
  onResume: () => void
  onLeave: () => void
  onReconnect: () => void
}

const control = 'min-h-9 shrink-0 rounded-lg border border-white/10 px-3 text-xs font-medium transition-colors'

export function SessionBar({ session, connected, mediatorBusy, onPause, onResume, onLeave, onReconnect }: Props) {
  const peer = session.peerName ?? 'the other person'
  const pausedByMe = session.pausedBy === session.role
  const pauserName = pausedByMe ? 'you' : peer

  const status = session.ended
    ? 'Session ended'
    : !connected
      ? 'Not connected'
      : mediatorBusy
        ? 'Mediator is thinking…'
        : 'Connected'

  return (
    <div className="shrink-0 border-b border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-neutral-200">
            <span
              className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                session.ended ? 'bg-neutral-600' : connected ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            With {peer} · {status}
          </p>
          <p className="truncate text-[11px] text-neutral-500">
            Mediator: {session.modelLabel}
            {session.cloud ? ' (Venice.ai)' : ' (on-device)'} · runs on {session.role === 'host' ? 'this phone' : `${session.hostName}'s phone`}
          </p>
        </div>

        {session.ended ? null : !connected ? (
          <button onClick={onReconnect} className={`${control} bg-amber-500 text-neutral-950`}>
            {session.role === 'host' ? 'Reconnect' : 'Rejoin'}
          </button>
        ) : (
          <>
            {session.pausedBy ? (
              pausedByMe ? (
                <button onClick={onResume} className={`${control} bg-amber-500 text-neutral-950`}>
                  Resume
                </button>
              ) : null
            ) : (
              <button onClick={onPause} className={`${control} text-neutral-200 hover:bg-white/10`}>
                Pause
              </button>
            )}
            <button onClick={onLeave} className={`${control} text-red-300 hover:bg-red-500/10`}>
              Leave
            </button>
          </>
        )}
      </div>

      {session.pausedBy && !session.ended ? (
        <p className="mx-auto mt-1.5 max-w-3xl rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          Paused by {pauserName}. {pausedByMe ? 'Resume when you’re ready.' : `Only ${peer} can resume.`} No messages
          can be sent while paused.
        </p>
      ) : null}
    </div>
  )
}
