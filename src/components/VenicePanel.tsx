import { useState } from 'react'
import { getVeniceKey, setVeniceKey } from '../lib/venice'

interface Props {
  onClose: () => void
  onKeyChange: (key: string | null) => void
}

export function VenicePanel({ onClose, onKeyChange }: Props) {
  const [saved, setSaved] = useState(getVeniceKey)
  const [draft, setDraft] = useState('')

  function save() {
    const key = draft.trim()
    if (!key) return
    setVeniceKey(key)
    setSaved(key)
    setDraft('')
    onKeyChange(key)
  }

  function remove() {
    setVeniceKey(null)
    setSaved(null)
    onKeyChange(null)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-medium text-neutral-300">Venice.ai cloud models</p>
        <button onClick={onClose} className="min-h-9 px-2 text-[11px] text-neutral-500 hover:text-neutral-300">
          Close
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-400">
        Optional. With a key saved, the model picker also lists Venice's larger cloud models. When a chat uses
        one, your messages and the system prompt — including any location or heart rate you share — are sent to
        Venice to generate replies. On-device models are unaffected and stay the default. The key is stored only
        in this browser and sent only to Venice.
      </p>

      {saved ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="flex-1 truncate font-mono text-[11px] text-neutral-400">
            Key saved: ••••{saved.slice(-4)}
          </span>
          <button
            onClick={remove}
            className="min-h-9 rounded-lg border border-white/10 px-3 text-xs text-red-300 hover:bg-red-500/10"
          >
            Remove key
          </button>
        </div>
      ) : (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {/* text-base: iOS Safari zooms the page when focusing an input smaller than 16 px. */}
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Venice API key"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-neutral-100 placeholder-neutral-500 outline-none focus:border-amber-500/50"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="min-h-9 rounded-lg bg-amber-500 px-3 text-xs font-medium text-neutral-950 disabled:opacity-30"
          >
            Save
          </button>
        </form>
      )}

      <p className="mt-2 text-[11px] text-neutral-600">
        Create a key at{' '}
        <a
          href="https://venice.ai/settings/api"
          target="_blank"
          rel="noreferrer"
          className="text-neutral-400 underline"
        >
          venice.ai/settings/api
        </a>
        . Usage is billed to your Venice account.
      </p>
    </div>
  )
}
