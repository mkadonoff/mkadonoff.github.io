import { useState, type ReactNode } from 'react'
import { MODELS } from '../data/models'
import { getCachedVeniceModels, getVeniceKey, setVeniceKey, toVeniceModelId } from '../lib/venice'
import { getDefaultModelId, setDefaultModelId } from '../lib/settings'
import { getSavedName, saveName } from '../lib/session'
import { Frame, Note, input, secondary } from './Sheet'

interface Props {
  onClose: () => void
  onVeniceKeyChange: (key: string | null) => void
  locationSharing: boolean
  onToggleLocation: () => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
      {children}
    </section>
  )
}

/** Saved as you type — there's no Save button to forget. */
function useSaved(initial: () => string, save: (value: string) => void) {
  const [value, setValue] = useState(initial)
  return [
    value,
    (next: string) => {
      setValue(next)
      save(next)
    },
  ] as const
}

function VeniceKey({ onChange }: { onChange: (key: string | null) => void }) {
  const [saved, setSaved] = useState(getVeniceKey)
  const [draft, setDraft] = useState('')

  if (saved) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate font-mono text-xs text-neutral-400">Key saved: ••••{saved.slice(-4)}</span>
        <button
          onClick={() => {
            setVeniceKey(null)
            setSaved(null)
            onChange(null)
          }}
          className="min-h-9 rounded-lg border border-white/10 px-3 text-xs text-red-300 hover:bg-red-500/10"
        >
          Remove key
        </button>
      </div>
    )
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const key = draft.trim()
        if (!key) return
        setVeniceKey(key)
        setSaved(key)
        setDraft('')
        onChange(key)
      }}
    >
      <input
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Venice API key"
        aria-label="Venice API key"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className={`${input} min-w-0 flex-1`}
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        className="min-h-10 shrink-0 rounded-lg bg-amber-500 px-4 text-sm font-medium text-neutral-950 disabled:opacity-30"
      >
        Save
      </button>
    </form>
  )
}

export function SettingsSheet({ onClose, onVeniceKeyChange, locationSharing, onToggleLocation }: Props) {
  const [hasKey, setHasKey] = useState(() => !!getVeniceKey())
  const [name, setName] = useSaved(getSavedName, (v) => saveName(v.trim()))
  const [defaultModel, setDefaultModel] = useSaved(getDefaultModelId, setDefaultModelId)
  const venice = hasKey ? getCachedVeniceModels() : []

  return (
    <Frame title="Settings" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Section title="Venice.ai cloud models">
          <Note>
            Optional. With your own API key, Venice's larger cloud models appear in the model picker and can run
            sessions and private coaches. Chats on a Venice model send their messages and system prompt to Venice.
            On-device models are unaffected. The key is stored only in this browser and sent only to Venice.
          </Note>
          <VeniceKey
            onChange={(key) => {
              setHasKey(!!key)
              onVeniceKeyChange(key)
            }}
          />
          <p className="text-[11px] text-neutral-600">
            Create a key at{' '}
            <a href="https://venice.ai/settings/api" target="_blank" rel="noreferrer" className="text-neutral-400 underline">
              venice.ai/settings/api
            </a>
            . Usage is billed to your Venice account.
          </p>
        </Section>

        <Section title="Default model for new chats">
          <select
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            aria-label="Default model for new chats"
            className={input}
          >
            {venice.length ? (
              <optgroup label="Venice.ai · cloud">
                {venice.map((m) => (
                  <option key={m.id} value={toVeniceModelId(m.id)}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="On-device · private">
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.downloadSize})
                </option>
              ))}
            </optgroup>
          </select>
          {hasKey && venice.length === 0 ? (
            <Note>Open the model picker once to load Venice's model list.</Note>
          ) : null}
          <Note>Private coach chats use this model when it's a Venice one; otherwise the first Venice model.</Note>
        </Section>

        <Section title="Your name in sessions">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How the other person sees you"
            aria-label="Your name in sessions"
            autoComplete="given-name"
            className={input}
          />
        </Section>

        <Section title="Location sharing">
          <label className="flex min-h-10 items-center justify-between gap-3">
            <span className="text-xs leading-relaxed text-neutral-400">
              Give private chats your approximate location. Your coordinates are sent to BigDataCloud to look up a place
              name. Never used in sessions.
            </span>
            <input
              type="checkbox"
              checked={locationSharing}
              onChange={onToggleLocation}
              className="h-6 w-6 shrink-0 accent-amber-500"
            />
          </label>
        </Section>

        <Section title="Where settings are kept">
          <Note>
            Everything here is saved in this browser only, and kept between visits. On iPhone, Safari and Haven added to
            the Home Screen keep separate settings.
          </Note>
        </Section>

        <button className={secondary} onClick={onClose}>
          Done
        </button>
      </div>
    </Frame>
  )
}
