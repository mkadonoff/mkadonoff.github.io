import { useRef, useState, type KeyboardEvent } from 'react'
import { InfoIcon, LocationIcon, SendIcon, StopIcon } from './icons'
import { isLocationSharingEnabled, peekLocationLine, setLocationSharingEnabled } from '../lib/location'
import { buildSystemPrompt } from '../lib/respond'

interface Props {
  disabled: boolean
  onSend: (text: string) => void
  onStop?: () => void
}

export function Composer({ disabled, onSend, onStop }: Props) {
  const [value, setValue] = useState('')
  const [locationSharing, setLocationSharing] = useState(isLocationSharingEnabled)
  const [showPrompt, setShowPrompt] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function toggleLocationSharing() {
    const next = !locationSharing
    setLocationSharingEnabled(next)
    setLocationSharing(next)
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function autosize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div className="border-t border-white/10 bg-neutral-950/80 p-4">
      {showPrompt ? (
        <div className="mx-auto mb-2 max-w-3xl rounded-xl border border-white/10 bg-black/40 p-3">
          <p className="mb-1.5 text-[11px] font-medium text-neutral-400">
            Exactly what's sent as the system prompt on your next message:
          </p>
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-300">
            {buildSystemPrompt(peekLocationLine())}
          </pre>
          {locationSharing && !peekLocationLine() ? (
            <p className="mt-1.5 text-[11px] text-amber-400">
              Location sharing is on but hasn't resolved yet — it'll be added the moment it does.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 focus-within:border-amber-500/50">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            autosize()
          }}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder="Message Haven…"
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[15px] text-neutral-100 placeholder-neutral-500 outline-none disabled:opacity-60"
        />
        <button
          onClick={() => setShowPrompt((v) => !v)}
          title={showPrompt ? 'Hide system prompt' : 'View the system prompt sent to the model'}
          aria-pressed={showPrompt}
          className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
            showPrompt ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-neutral-400 hover:bg-white/20'
          }`}
        >
          <InfoIcon className="h-4 w-4" />
        </button>
        <button
          onClick={toggleLocationSharing}
          title={
            locationSharing
              ? 'Location sharing on — your approximate location is sent to a geocoding service and given to the model'
              : 'Share your approximate location with the model'
          }
          aria-pressed={locationSharing}
          className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
            locationSharing ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-neutral-400 hover:bg-white/20'
          }`}
        >
          <LocationIcon className="h-4 w-4" />
        </button>
        {onStop ? (
          <button
            onClick={onStop}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-neutral-200 hover:bg-white/20"
          >
            <StopIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-neutral-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-neutral-600">
        Runs on-device via WebGPU — nothing you type or generate leaves your browser. First reply from a model
        downloads and caches it; after that it works offline.
        {locationSharing
          ? ' Location sharing is on: your device sends coordinates to a geocoding lookup to resolve a place name for the model.'
          : ''}
      </p>
    </div>
  )
}
