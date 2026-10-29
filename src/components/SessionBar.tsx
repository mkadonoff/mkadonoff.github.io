import type { SharedSession } from '../types'
import { aiName, modeOf } from '../lib/session'

interface Props {
  session: SharedSession
  connected: boolean
  mediatorBusy: boolean
  onPause: () => void
  onResume: () => void
  onSafeword: () => void
  onLiftSafeword: () => void
  onAgreement: () => void
  onCoach: () => void
  onLeave: () => void
  onReconnect: () => void
}

const control = 'min-h-9 shrink-0 rounded-lg border border-white/10 px-3 text-xs font-medium transition-colors'

export function SessionBar(props: Props) {
  const { session, connected, mediatorBusy } = props
  const power = modeOf(session) === 'power'
  const peer = session.peerName ?? 'the other person'
  const ai = aiName(session)
  const subName = session.hostName
  const isHost = session.role === 'host'

  const status = session.ended
    ? 'Session ended'
    : !connected
      ? 'Not connected'
      : mediatorBusy
        ? `${ai} is thinking…`
        : 'Connected'

  const pausedByMe = session.pausedBy === session.role
  // Mirrors the rule the host enforces: the submissive lifts any safeword, the dominant only their own.
  const canLift = !!session.safeword && (isHost || session.safeword === session.role)
  const safewordBy = session.safeword === session.role ? 'you' : peer
  const proposal = session.proposal
  const live = connected && !session.ended

  return (
    <div className="shrink-0 border-b border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="mx-auto max-w-3xl">
        <p className="truncate text-xs font-medium text-neutral-200">
          <span
            className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
              session.ended ? 'bg-neutral-600' : connected ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
          With {peer} · {status}
          {power ? ` · you are the ${isHost ? 'submissive' : 'dominant'}` : ''}
        </p>
        <p className="truncate text-[11px] text-neutral-500">
          {ai}: {session.modelLabel}
          {session.cloud ? ' (Venice.ai)' : ' (on-device)'} · runs on {isHost ? 'this phone' : `${session.hostName}'s phone`}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {session.ended ? null : !connected ? (
            <button onClick={props.onReconnect} className={`${control} bg-amber-500 text-neutral-950`}>
              {isHost ? 'Reconnect' : 'Rejoin'}
            </button>
          ) : power ? (
            canLift ? (
              <button onClick={props.onLiftSafeword} className={`${control} text-neutral-200 hover:bg-white/10`}>
                Lift safeword
              </button>
            ) : session.safeword ? null : (
              <button onClick={props.onSafeword} className={`${control} border-red-500/40 bg-red-500/15 text-red-200`}>
                Safeword
              </button>
            )
          ) : session.pausedBy ? (
            pausedByMe ? (
              <button onClick={props.onResume} className={`${control} bg-amber-500 text-neutral-950`}>
                Resume
              </button>
            ) : null
          ) : (
            <button onClick={props.onPause} className={`${control} text-neutral-200 hover:bg-white/10`}>
              Pause
            </button>
          )}
          {power ? (
            <button onClick={props.onAgreement} className={`${control} text-neutral-200 hover:bg-white/10`}>
              Agreement{proposal ? ' •' : ''}
            </button>
          ) : null}
          <button onClick={props.onCoach} className={`${control} text-neutral-200 hover:bg-white/10`}>
            Private coach
          </button>
          {session.ended ? null : (
            <button onClick={props.onLeave} className={`${control} text-red-300 hover:bg-red-500/10`}>
              Leave
            </button>
          )}
        </div>
      </div>

      {power && session.safeword && !session.ended ? (
        <p className="mx-auto mt-2 max-w-3xl rounded-lg bg-red-500/15 px-3 py-1.5 text-xs text-red-200">
          Safeword called by {safewordBy}. All direction has stopped and the AI coach is checking in.{' '}
          {canLift
            ? isHost
              ? 'Lift it only when you’re ready.'
              : 'You can lift it, since you called it.'
            : `Only ${subName} can lift it.`}
        </p>
      ) : null}

      {power && proposal && live ? (
        <button
          onClick={props.onAgreement}
          className="mx-auto mt-2 block w-full max-w-3xl rounded-lg bg-amber-500/10 px-3 py-1.5 text-left text-xs text-amber-300"
        >
          {proposal.by === session.role
            ? `Your proposed changes to the agreement are waiting for ${peer}.`
            : `${peer} proposed changes to the agreement. Tap to review — nothing changes unless you accept.`}
        </button>
      ) : null}

      {!power && session.pausedBy && !session.ended ? (
        <p className="mx-auto mt-1.5 max-w-3xl rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          Paused by {pausedByMe ? 'you' : peer}. {pausedByMe ? 'Resume when you’re ready.' : `Only ${peer} can resume.`} No
          messages can be sent while paused.
        </p>
      ) : null}
    </div>
  )
}
