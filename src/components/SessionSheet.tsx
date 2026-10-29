import { useState, type ReactNode } from 'react'
import type { SessionSheet as Sheet, HostOptions } from '../lib/useSharedSession'
import { DEFAULT_INSTRUCTIONS, getSavedName } from '../lib/session'
import { MODELS } from '../data/models'
import { getCachedVeniceModels, getVeniceKey, toVeniceModelId } from '../lib/venice'
import { QrCode } from './QrCode'
import { QrScanner } from './QrScanner'

interface Props {
  sheet: Sheet
  onClose: () => void
  onStartForm: () => void
  onJoinForm: () => void
  onHost: (options: HostOptions) => void
  onSubmitAnswer: (code: string) => void
  onJoin: (code: string) => void
  onAccept: (name: string) => void
  onDecline: () => void
}

// Disclosed wherever pairing starts, on both phones: it's the one outside contact a session makes.
const STUN_NOTE =
  "Connecting asks a public Google or Cloudflare server for this phone's network address; it never sees the conversation."

const button =
  'min-h-11 w-full rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'
const primary = `${button} bg-amber-500 text-neutral-950`
const secondary = `${button} border border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10`
// text-base: iOS Safari zooms the page when focusing an input smaller than 16 px.
const input =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500 outline-none focus:border-amber-500/50'

function Frame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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

function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-neutral-400">{children}</p>
}

/** Scan, with paste as the fallback for remote use or a camera that won't cooperate. */
function CodeInput({ onCode, scanLabel }: { onCode: (code: string) => void; scanLabel: string }) {
  const [mode, setMode] = useState<'idle' | 'scan' | 'paste'>('idle')
  const [text, setText] = useState('')

  if (mode === 'scan') {
    return (
      <div className="flex flex-col gap-2">
        <QrScanner onResult={onCode} />
        <button className={secondary} onClick={() => setMode('idle')}>
          Stop scanning
        </button>
      </div>
    )
  }
  if (mode === 'paste') {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Paste the code or link"
          className={input}
          autoCapitalize="off"
          spellCheck={false}
        />
        <button className={primary} disabled={!text.trim()} onClick={() => onCode(text.trim())}>
          Use this code
        </button>
        <button className={secondary} onClick={() => setMode('idle')}>
          Cancel
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <button className={primary} onClick={() => setMode('scan')}>
        {scanLabel}
      </button>
      <button className={secondary} onClick={() => setMode('paste')}>
        Paste a code instead
      </button>
    </div>
  )
}

async function shareOrCopy(text: string, title: string): Promise<string> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text })
      return 'Shared'
    }
    await navigator.clipboard.writeText(text)
    return 'Copied'
  } catch {
    return 'Not shared'
  }
}

function ShareButton({ text, title, label }: { text: string; title: string; label: string }) {
  const [status, setStatus] = useState<string | null>(null)
  return (
    <button className={secondary} onClick={async () => setStatus(await shareOrCopy(text, title))}>
      {status ?? label}
    </button>
  )
}

interface ModelChoice {
  id: string
  label: string
  cloud: boolean
}

function modelChoices(): ModelChoice[] {
  const venice = getVeniceKey()
    ? getCachedVeniceModels().map((m) => ({ id: toVeniceModelId(m.id), label: m.name, cloud: true }))
    : []
  return [...venice, ...MODELS.map((m) => ({ id: m.id, label: m.name, cloud: false }))]
}

function HostForm({ onHost }: { onHost: (options: HostOptions) => void }) {
  const choices = modelChoices()
  const [name, setName] = useState(getSavedName)
  const [modelId, setModelId] = useState(choices[0]?.id ?? '')
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS)
  const choice = choices.find((c) => c.id === modelId)
  const hasVenice = choices.some((c) => c.cloud)

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400">Your name, as the other person will see it</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="given-name" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400">Mediator model</span>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} className={input}>
          {hasVenice ? (
            <optgroup label="Venice.ai · cloud">
              {choices.filter((c) => c.cloud).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="On-device">
            {choices.filter((c) => !c.cloud).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </optgroup>
        </select>
        {choice && !choice.cloud ? (
          <span className="text-[11px] text-amber-300/80">
            On-device models are small and make weak mediators.
            {hasVenice ? ' A Venice model will mediate far better.' : ' Add a Venice key in the model picker for larger models.'}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400">Mediator instructions — the other person sees these and must accept them</span>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={8} className={`${input} text-sm`} />
        <button className="self-start text-[11px] text-neutral-500 underline" onClick={() => setInstructions(DEFAULT_INSTRUCTIONS)}>
          Reset to default
        </button>
      </label>

      <Note>
        The mediator runs on this phone and answers both of you.
        {choice?.cloud ? ' Because it uses Venice, the whole shared conversation is sent to Venice.ai with your API key.' : ''}{' '}
        Messages travel directly between the two phones, encrypted. {STUN_NOTE} Works best on the same Wi-Fi.
      </Note>

      <button
        className={primary}
        disabled={!name.trim() || !choice || !instructions.trim()}
        onClick={() =>
          choice &&
          onHost({ name: name.trim(), modelId: choice.id, modelLabel: choice.label, cloud: choice.cloud, instructions: instructions.trim() })
        }
      >
        Create invitation
      </button>
    </div>
  )
}

function Consent({ sheet, onAccept, onDecline }: { sheet: Extract<Sheet, { step: 'guest-consent' }>; onAccept: (name: string) => void; onDecline: () => void }) {
  const { setup } = sheet
  const [name, setName] = useState(getSavedName)
  const model = setup.modelLabel

  return (
    <div className="flex flex-col gap-3">
      <Note>
        <span className="font-medium text-neutral-200">{setup.hostName}</span> invited you to a mediated session.
        Review what you'd be agreeing to.
      </Note>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-neutral-300">
        <p className="mb-1 font-medium text-neutral-200">Who sees what</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Everything you write here is seen by {setup.hostName} and by the mediator.</li>
          <li>
            The mediator is <span className="font-medium">{model}</span>, running on {setup.hostName}'s phone.
            {setup.cloud ? (
              <span className="text-amber-300"> It's a Venice.ai cloud model, so the conversation is sent to Venice.</span>
            ) : (
              ' It runs on their device.'
            )}
          </li>
          <li>No location or heart rate is shared in sessions. Your private chats stay on this phone.</li>
          <li>You can pause or leave at any time, and only you can resume a pause you started.</li>
        </ul>
      </div>

      <div>
        <p className="mb-1 text-xs text-neutral-400">The mediator's instructions, exactly as it will receive them:</p>
        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-neutral-300">
          {setup.instructions}
        </pre>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400">Your name, as {setup.hostName} will see it</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="given-name" />
      </label>

      <button className={primary} disabled={!name.trim()} onClick={() => onAccept(name)}>
        Accept and join
      </button>
      <button className={secondary} onClick={onDecline}>
        Decline
      </button>
    </div>
  )
}

export function SessionSheet(props: Props) {
  const { sheet, onClose } = props

  switch (sheet.step) {
    case 'closed':
      return null

    case 'menu':
      return (
        <Frame title="Mediated session" onClose={onClose}>
          <div className="flex flex-col gap-3">
            <Note>
              Two people, each on their own phone, talk together with one AI as coach and mediator. The phones connect
              directly — no server stores anything. Best done in the same room, on the same Wi-Fi.
            </Note>
            <button className={primary} onClick={props.onStartForm}>
              Start a session
            </button>
            <button className={secondary} onClick={props.onJoinForm}>
              Join a session
            </button>
          </div>
        </Frame>
      )

    case 'host-form':
      return (
        <Frame title="Start a session" onClose={onClose}>
          <HostForm onHost={props.onHost} />
        </Frame>
      )

    case 'working':
      return (
        <Frame title="Mediated session" onClose={onClose}>
          <p className="py-8 text-center text-sm text-neutral-300">{sheet.label}</p>
        </Frame>
      )

    case 'host-offer':
      return (
        <Frame title="Invite the other person" onClose={onClose}>
          <div className="flex flex-col gap-3">
            <Note>
              <span className="font-medium text-neutral-200">Step 1.</span> They scan this with their iPhone camera, or
              in Haven under Join a session.
            </Note>
            <QrCode text={sheet.link} label="Session invitation code" />
            <ShareButton text={sheet.link} title="Join my Haven session" label="Send the invitation link instead" />
            <Note>
              <span className="font-medium text-neutral-200">Step 2.</span> Their phone then shows a reply code. Scan it
              here.
            </Note>
            {sheet.error ? <p className="text-xs text-red-300">{sheet.error}</p> : null}
            <CodeInput onCode={props.onSubmitAnswer} scanLabel="Scan their reply code" />
          </div>
        </Frame>
      )

    case 'host-waiting':
      return (
        <Frame title="Connected" onClose={onClose}>
          <p className="py-6 text-center text-sm text-neutral-300">
            The other person is reviewing the mediator's instructions. The session starts when they accept.
          </p>
        </Frame>
      )

    case 'join':
      return (
        <Frame title="Join a session" onClose={onClose}>
          <div className="flex flex-col gap-3">
            <Note>
              Scan the invitation code on the other person's phone. {STUN_NOTE}
            </Note>
            {sheet.error ? <p className="text-xs text-red-300">{sheet.error}</p> : null}
            <CodeInput onCode={props.onJoin} scanLabel="Scan invitation code" />
          </div>
        </Frame>
      )

    case 'guest-answer':
      return (
        <Frame title="Show this to the host" onClose={onClose}>
          <div className="flex flex-col gap-3">
            {sheet.connected ? (
              <p className="py-6 text-center text-sm text-neutral-300">Connected. Loading the session details…</p>
            ) : (
              <>
                <Note>The other person scans this reply code in Haven to finish connecting. {STUN_NOTE}</Note>
                <QrCode text={sheet.code} label="Session reply code" />
                <ShareButton text={sheet.code} title="Haven session reply" label="Send the reply code instead" />
              </>
            )}
          </div>
        </Frame>
      )

    case 'guest-consent':
      return (
        <Frame title="Join this session?" onClose={props.onDecline}>
          <Consent sheet={sheet} onAccept={props.onAccept} onDecline={props.onDecline} />
        </Frame>
      )

    case 'notice':
      return (
        <Frame title={sheet.title} onClose={onClose}>
          <div className="flex flex-col gap-3">
            <Note>{sheet.body}</Note>
            <button className={secondary} onClick={onClose}>
              OK
            </button>
          </div>
        </Frame>
      )
  }
}
