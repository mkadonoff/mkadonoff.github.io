import { useState } from 'react'
import { Frame, Note, input, primary, secondary } from './Sheet'
import type { SessionSheet as Sheet, HostOptions } from '../lib/useSharedSession'
import { AGREEMENT_FIELDS, DEFAULT_AGREEMENT, DEFAULT_INSTRUCTIONS, EMPTY_AGREEMENT, agreementChanges, getSavedName } from '../lib/session'
import type { Agreement, SessionMode, SharedSession } from '../types'
import { MODELS } from '../data/models'
import { getCachedVeniceModels, getVeniceKey, toVeniceModelId } from '../lib/venice'
import { QrCode } from './QrCode'
import { QrScanner } from './QrScanner'

interface Props {
  sheet: Sheet
  /** The open chat's session, for the agreement screens. */
  session: SharedSession | null
  onClose: () => void
  onEditAgreement: () => void
  onPropose: (agreement: Agreement) => void
  onRespond: (accept: boolean) => void
  onWithdraw: () => void
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

function ModelSelect({ choices, modelId, onChange, label }: { choices: ModelChoice[]; modelId: string; onChange: (id: string) => void; label: string }) {
  const choice = choices.find((c) => c.id === modelId)
  const hasVenice = choices.some((c) => c.cloud)
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-400">{label}</span>
      <select value={modelId} onChange={(e) => onChange(e.target.value)} className={input}>
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
          On-device models are small and won't follow a session well.
          {hasVenice ? ' A Venice model will do far better.' : ' Add a Venice key in Settings for larger models.'}
        </span>
      ) : null}
    </label>
  )
}

function AgreementFields({ value, onChange }: { value: Agreement; onChange: (next: Agreement) => void }) {
  return (
    <>
      {AGREEMENT_FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">
            {f.label}
            {f.required ? '' : ' (optional)'}
          </span>
          <textarea
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            rows={f.key === 'notes' ? 2 : f.required ? 5 : 3}
            className={`${input} text-sm`}
          />
        </label>
      ))}
    </>
  )
}

function agreementComplete(a: Agreement): boolean {
  return AGREEMENT_FIELDS.every((f) => !f.required || a[f.key].trim())
}

function HostForm({ onHost }: { onHost: (options: HostOptions) => void }) {
  const choices = modelChoices()
  const [mode, setMode] = useState<SessionMode>('power')
  const [name, setName] = useState(getSavedName)
  const [modelId, setModelId] = useState(choices[0]?.id ?? '')
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS)
  const [agreement, setAgreement] = useState<Agreement>(DEFAULT_AGREEMENT)
  const choice = choices.find((c) => c.id === modelId)
  const power = mode === 'power'
  const ai = power ? 'AI coach' : 'mediator'
  const ready = !!name.trim() && !!choice && (power ? agreementComplete(agreement) : !!instructions.trim())

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {(['power', 'mediation'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-xl border px-3 text-sm font-medium ${
              mode === m ? 'border-amber-500/60 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-white/5 text-neutral-300'
            }`}
          >
            {m === 'power' ? 'Protocol' : 'Mediation'}
          </button>
        ))}
      </div>

      {power ? (
        <Note>
          <span className="font-medium text-neutral-200">You are the Follower, and you host.</span> The AI coach runs
          on your phone and holds the agreement, so the person giving up control keeps the phone that enforces the limits.
          The Lead reviews and accepts the agreement before joining. Either of you can call the safeword at any
          time, and only you can lift it — or the Lead can lift one they called themselves. Changes to the agreement
          take effect only when both of you accept them.
        </Note>
      ) : (
        <Note>A neutral AI mediator for a conversation between the two of you.</Note>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400">Your name, as the other person will see it</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="given-name" />
      </label>

      <ModelSelect choices={choices} modelId={modelId} onChange={setModelId} label={power ? 'AI coach model' : 'Mediator model'} />

      {power ? (
        <>
          <p className="pt-1 text-sm font-medium text-neutral-200">The agreement</p>
          <Note>
            The required parts are filled in with a starting point. Change them to fit the two of you — the Lead sees
            exactly what you write and must accept it before joining.
          </Note>
          <AgreementFields value={agreement} onChange={setAgreement} />
        </>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Mediator instructions — the other person sees these and must accept them</span>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={8} className={`${input} text-sm`} />
          <button className="self-start text-[11px] text-neutral-500 underline" onClick={() => setInstructions(DEFAULT_INSTRUCTIONS)}>
            Reset to default
          </button>
        </label>
      )}

      <Note>
        The {ai} runs on this phone and answers both of you.
        {choice?.cloud ? ' Because it uses Venice, the whole shared conversation is sent to Venice.ai with your API key.' : ''}{' '}
        Messages travel directly between the two phones, encrypted. {STUN_NOTE} Works best on the same Wi-Fi.
      </Note>

      <button
        className={primary}
        disabled={!ready}
        onClick={() =>
          choice &&
          onHost({
            name: name.trim(),
            modelId: choice.id,
            modelLabel: choice.label,
            cloud: choice.cloud,
            mode,
            instructions: instructions.trim(),
            agreement: power ? agreement : undefined,
          })
        }
      >
        Create invitation
      </button>
    </div>
  )
}

function AgreementSummary({ agreement }: { agreement: Agreement }) {
  return (
    <dl className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed">
      {AGREEMENT_FIELDS.filter((f) => agreement[f.key].trim()).map((f) => (
        <div key={f.key}>
          <dt className="font-medium text-neutral-200">{f.label}</dt>
          <dd className="whitespace-pre-wrap text-neutral-300">{agreement[f.key].trim()}</dd>
        </div>
      ))}
    </dl>
  )
}

function Consent({ sheet, onAccept, onDecline }: { sheet: Extract<Sheet, { step: 'guest-consent' }>; onAccept: (name: string) => void; onDecline: () => void }) {
  const { setup } = sheet
  const [name, setName] = useState(getSavedName)
  const power = setup.mode === 'power' && setup.agreement
  const ai = power ? 'the AI coach' : 'the mediator'

  return (
    <div className="flex flex-col gap-3">
      <Note>
        <span className="font-medium text-neutral-200">{setup.hostName}</span>{' '}
        {power ? 'invited you to a Protocol session, as the Lead.' : 'invited you to a mediated session.'} Review
        what you'd be agreeing to.
      </Note>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-neutral-300">
        <p className="mb-1 font-medium text-neutral-200">Who sees what</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Everything you write here is seen by {setup.hostName} and by {ai}.</li>
          <li>
            {power ? 'The AI coach' : 'The mediator'} is <span className="font-medium">{setup.modelLabel}</span>, running on{' '}
            {setup.hostName}'s phone.
            {setup.cloud ? (
              <span className="text-amber-300"> It's a Venice.ai cloud model, so the conversation is sent to Venice.</span>
            ) : (
              ' It runs on their device.'
            )}
          </li>
          <li>
            Each of you can also have a private coach chat that reads this session, on your own phone with your own
            model. Neither of you can see the other's.
          </li>
          <li>No location or heart rate is shared in sessions.</li>
          {power ? (
            <li>
              Either of you can call the safeword at any time. Only {setup.hostName} can lift it, unless you called it
              yourself. Changes to the agreement need both of you to accept.
            </li>
          ) : (
            <li>You can pause or leave at any time, and only you can resume a pause you started.</li>
          )}
        </ul>
      </div>

      {power ? (
        <div>
          <p className="mb-1 text-xs text-neutral-400">The agreement (version {setup.agreementVersion ?? 1}):</p>
          <AgreementSummary agreement={setup.agreement!} />
        </div>
      ) : null}

      <details className="rounded-xl border border-white/10 bg-black/30 p-3" open={!power}>
        <summary className="cursor-pointer text-xs text-neutral-400">
          {power ? "The AI coach's full instructions" : "The mediator's instructions"}, exactly as it will receive them
        </summary>
        <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-300">
          {setup.instructions}
        </pre>
      </details>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400">Your name, as {setup.hostName} will see it</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="given-name" />
      </label>

      <button className={primary} disabled={!name.trim()} onClick={() => onAccept(name)}>
        {power ? 'Accept the agreement and join' : 'Accept and join'}
      </button>
      <button className={secondary} onClick={onDecline}>
        Decline
      </button>
    </div>
  )
}

/** The current agreement, plus whatever proposal is open: review, accept, decline, or withdraw it. */
function AgreementPanel({ session, onEdit, onRespond, onWithdraw }: {
  session: SharedSession
  onEdit: () => void
  onRespond: (accept: boolean) => void
  onWithdraw: () => void
}) {
  const proposal = session.proposal
  const mine = proposal?.by === session.role
  const proposer = mine ? 'You' : (session.peerName ?? 'The other person')
  const changes = proposal && session.agreement ? agreementChanges(session.agreement, proposal.agreement) : []

  return (
    <div className="flex flex-col gap-3">
      {proposal ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-200">
            {proposer} proposed {changes.length === 1 ? 'a change' : `${changes.length} changes`}.{' '}
            {mine ? `Waiting for ${session.peerName ?? 'them'} to accept.` : 'Nothing changes unless you accept.'}
          </p>
          {changes.map((c) => (
            <div key={c.label} className="text-xs leading-relaxed">
              <p className="font-medium text-neutral-200">{c.label}</p>
              <p className="whitespace-pre-wrap text-red-300/80 line-through">{c.before || '(empty)'}</p>
              <p className="whitespace-pre-wrap text-emerald-300">{c.after || '(empty)'}</p>
            </div>
          ))}
          {mine ? (
            <button className={secondary} onClick={onWithdraw}>
              Withdraw proposal
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button className={secondary} onClick={() => onRespond(false)}>
                Decline
              </button>
              <button className={primary} onClick={() => onRespond(true)}>
                Accept
              </button>
            </div>
          )}
        </div>
      ) : null}

      <p className="text-xs text-neutral-400">Current agreement (version {session.agreementVersion ?? 1}), accepted by both:</p>
      {session.agreement ? <AgreementSummary agreement={session.agreement} /> : null}

      {proposal ? null : (
        <button className={secondary} onClick={onEdit}>
          Propose a change
        </button>
      )}
    </div>
  )
}

function AgreementEditor({ session, onPropose, onCancel }: { session: SharedSession; onPropose: (a: Agreement) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Agreement>(session.agreement ?? EMPTY_AGREEMENT)
  const changed = session.agreement ? agreementChanges(session.agreement, draft).length > 0 : true
  return (
    <div className="flex flex-col gap-3">
      <Note>
        Edit what you'd like to change. {session.peerName ?? 'The other person'} will see exactly what changed, and
        nothing takes effect unless they accept.
      </Note>
      <AgreementFields value={draft} onChange={setDraft} />
      <button className={primary} disabled={!changed || !agreementComplete(draft)} onClick={() => onPropose(draft)}>
        Send proposal
      </button>
      <button className={secondary} onClick={onCancel}>
        Cancel
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
        <Frame title="Session" onClose={onClose}>
          <div className="flex flex-col gap-3">
            <Note>
              Two people, each on their own phone, talk together with one AI as coach or mediator. The phones connect
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
        <Frame title="Session" onClose={onClose}>
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

    case 'agreement':
      return props.session ? (
        <Frame title="The agreement" onClose={onClose}>
          <AgreementPanel session={props.session} onEdit={props.onEditAgreement} onRespond={props.onRespond} onWithdraw={props.onWithdraw} />
        </Frame>
      ) : null

    case 'agreement-edit':
      return props.session ? (
        <Frame title="Propose a change" onClose={onClose}>
          <AgreementEditor session={props.session} onPropose={props.onPropose} onCancel={onClose} />
        </Frame>
      ) : null

    case 'notice':
      return (
        <Frame title={sheet.title} onClose={onClose}>
          <div className="flex flex-col gap-3">
            <Note>{sheet.body}</Note>
            {sheet.details ? (
              <details className="rounded-xl border border-white/10 bg-black/30 p-3" open>
                <summary className="cursor-pointer text-xs text-neutral-400">Troubleshooting details</summary>
                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-300">
                  {sheet.details}
                </pre>
                <div className="mt-2">
                  <ShareButton text={sheet.details} title="Haven connection details" label="Copy details" />
                </div>
              </details>
            ) : null}
            <button className={secondary} onClick={onClose}>
              OK
            </button>
          </div>
        </Frame>
      )
  }
}
