import { peekLocationLine } from '../lib/location'
import { heartRateLine } from '../lib/heartRate'
import { buildSystemPrompt } from '../lib/respond'

interface Props {
  locationSharing: boolean
  geofenceActive: boolean
  onClose: () => void
}

export function SystemPromptPanel({ locationSharing, geofenceActive, onClose }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-medium text-neutral-400">
          Exactly what's sent as the system prompt on your next message:
        </p>
        <button onClick={onClose} className="text-[11px] text-neutral-500 hover:text-neutral-300">
          Close
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-300">
        {buildSystemPrompt(peekLocationLine(), null, heartRateLine())}
      </pre>
      {locationSharing && !peekLocationLine() ? (
        <p className="mt-1.5 text-[11px] text-amber-400">
          Location sharing is on but hasn't resolved yet — it'll be added the moment it does.
        </p>
      ) : null}
      {geofenceActive ? (
        <p className="mt-1.5 text-[11px] text-neutral-500">
          Geofence tracking is on for this chat — a line reporting distance from where the conversation
          started is computed fresh and added right before each send, so it isn't shown in this preview. Ask
          the model to reset the start point and it can do so on its own.
        </p>
      ) : null}
    </div>
  )
}
