import type { Agreement, Message, Proposal, SessionMode, SessionRole, SharedSession } from '../types'

// Everything that crosses the data channel. The host's phone is the source of truth for the
// transcript: it runs the mediator and re-sends the whole conversation whenever the guest connects.

export interface SetupMessage {
  t: 'setup'
  sessionId: string
  hostName: string
  modelId: string
  modelLabel: string
  cloud: boolean
  instructions: string
  mode: SessionMode
  agreement?: Agreement
  agreementVersion?: number
}

export type WireMessage =
  | SetupMessage
  | { t: 'accept'; name: string }
  | { t: 'decline' }
  | { t: 'msg'; message: Message }
  | { t: 'drop'; id: string }
  | { t: 'pause'; by: SessionRole }
  | { t: 'resume' }
  | { t: 'leave' }
  // Power mode. The host validates anything the guest sends: the guest can't lift the submissive's
  // safeword or accept its own proposal.
  | { t: 'safeword'; by: SessionRole }
  | { t: 'lift'; by: SessionRole }
  | { t: 'propose'; agreement: Agreement }
  | { t: 'respond'; id: string; accept: boolean }
  | { t: 'withdraw'; id: string }
  | { t: 'proposal'; proposal: Proposal | null }
  | { t: 'agreement'; agreement: Agreement; version: number; instructions: string }

export function isWireMessage(value: unknown): value is WireMessage {
  return typeof value === 'object' && value !== null && typeof (value as { t?: unknown }).t === 'string'
}

/**
 * The mediator decides each turn whether to speak. When it shouldn't, it answers with only this, and
 * the reply is discarded instead of shown — so it can let two people talk without interjecting.
 */
export const PASS_MARKER = '<<PASS>>'

/** True while a reply could still turn out to be a pass, so it isn't shown or sent prematurely. */
export function mightBePass(soFar: string): boolean {
  const t = soFar.trim()
  return t.length === 0 || PASS_MARKER.startsWith(t) || t.startsWith(PASS_MARKER)
}

export function isPass(reply: string): boolean {
  return reply.includes(PASS_MARKER)
}

// Written as a starting point; both participants see it and accept it before joining.
export const DEFAULT_INSTRUCTIONS = `You are the coach and mediator in a live conversation between two people, each on their own phone, usually sitting together. One of them may hold more power in this relationship than the other.

- Stay neutral. Don't take sides, and don't let the person with more power set the terms by default.
- Make sure both people are heard. If one dominates, invite the other in.
- Reflect back what you hear. Name feelings and needs without judgement, and slow things down when tension rises.
- Ask one question at a time. Keep replies short — two to four sentences.
- Never pressure anyone to agree, disclose, or continue. Either person can pause at any time; respect it without asking why.
- You are not a therapist or a crisis service. If someone describes being in danger, encourage them to contact local emergency services.`

function currentDateTimeLine(): string {
  const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date())
  return `Current date and time: ${formatted}.`
}

const PASS_LINE = `You see every message, but most don't need you. When it's better to stay quiet and let them talk to each other, reply with exactly ${PASS_MARKER} and nothing else.`

export function modeOf(session: Pick<SharedSession, 'mode'>): SessionMode {
  return session.mode ?? 'mediation'
}

/** What the AI is called on screen. A therapist may join later as the human mediator. */
export function aiName(session: Pick<SharedSession, 'mode'>): string {
  return modeOf(session) === 'power' ? 'AI coach' : 'Mediator'
}

/** The same name mid-sentence: "the AI coach", "the mediator". */
export function aiNoun(session: Pick<SharedSession, 'mode'>): string {
  return modeOf(session) === 'power' ? 'AI coach' : 'mediator'
}

type Names = Pick<SharedSession, 'role' | 'selfName' | 'peerName' | 'hostName'>

export function hostAndGuest(session: Names): { host: string; guest: string } {
  const guest = session.role === 'host' ? session.peerName : session.selfName
  return { host: session.hostName, guest: guest ?? 'the other person' }
}

// ---------- the agreement (power mode) ----------

export const AGREEMENT_FIELDS: { key: keyof Agreement; label: string; placeholder: string; required?: boolean }[] = [
  {
    key: 'directs',
    label: 'What the dominant may direct',
    placeholder: 'e.g. how I address you; small tasks during the evening; what I wear at home',
    required: true,
  },
  {
    key: 'limits',
    label: "The submissive's limits — ask first, or not for now",
    placeholder: 'e.g. anything in public; changes to our plans with friends',
  },
  {
    key: 'absoluteLimits',
    label: 'Absolute limits — never',
    placeholder: 'e.g. anything involving money; anything that causes injury',
    required: true,
  },
  { key: 'checkIns', label: 'Check-ins', placeholder: 'e.g. ask how I am doing every 20 minutes, and after anything new' },
  { key: 'aftercare', label: 'Aftercare', placeholder: 'e.g. quiet time together, water, talk through how it went' },
  { key: 'notes', label: 'Anything else the AI coach should know', placeholder: 'Optional' },
]

export const EMPTY_AGREEMENT: Agreement = { directs: '', limits: '', absoluteLimits: '', checkIns: '', aftercare: '', notes: '' }

export function renderAgreement(agreement: Agreement): string {
  return AGREEMENT_FIELDS.filter((f) => agreement[f.key].trim())
    .map((f) => `${f.label}:\n${agreement[f.key].trim()}`)
    .join('\n\n')
}

/** Fields that differ, for reviewing a proposal side by side. */
export function agreementChanges(before: Agreement, after: Agreement) {
  return AGREEMENT_FIELDS.filter((f) => before[f.key].trim() !== after[f.key].trim()).map((f) => ({
    label: f.label,
    before: before[f.key].trim(),
    after: after[f.key].trim(),
  }))
}

/**
 * The AI coach's instructions for a power-exchange session. Stored as the session's `instructions`,
 * so the consent screen shows exactly this and a rejoin re-asks for consent if it changed.
 */
export function buildPowerInstructions(agreement: Agreement, version: number): string {
  return `You are the AI coach in a consensual power-exchange (dominant/submissive) relationship between two adults. Both are present, each on their own phone, and both accepted the agreement below.

Your role:
- Coach the dominant on structuring and running the dynamic, and help them direct the submissive — only ever within the agreement.
- Everything you suggest must respect the submissive's limits. Never suggest, endorse, or help with anything under the absolute limits, even if asked. If asked, say plainly that it's outside the agreement, and that the agreement can only change if both accept a proposed change.
- Watch for signs the submissive is struggling, hesitating, or no longer consenting. If you see them, stop directing and check in with the submissive directly.
- Follow the agreed check-ins. Keep replies short: one instruction or question at a time.
- Either person can call the safeword at any moment. It ends all direction immediately.
- You are not a therapist or a crisis service. If someone describes being in danger, encourage them to contact local emergency services.

THE AGREEMENT (version ${version})

${renderAgreement(agreement)}`
}

function safewordBlock(session: SharedSession): string {
  const { host, guest } = hostAndGuest(session)
  const caller = session.safeword === 'host' ? host : guest
  return `THE SAFEWORD HAS BEEN CALLED by ${caller}. Stop all direction and all coaching of the dynamic now. Your only job is care: check in gently with ${host} first, follow the agreed aftercare, and support both people. Don't resume the dynamic or suggest resuming it — only ${host} can lift the safeword. Reply now; don't stay silent.`
}

/**
 * Deliberately carries no location, geofence or heart-rate lines: those are one person's data, and
 * sharing them into a session needs that person's own consent, which this version doesn't ask for.
 */
export function buildMediatorSystemPrompt(session: SharedSession): string {
  const { host, guest } = hostAndGuest(session)
  if (modeOf(session) === 'power') {
    return [
      session.instructions.trim(),
      `Participants: ${host} is the submissive (and hosts this session); ${guest} is the dominant. Each message is prefixed with the name of who wrote it. Lines marked [Session notice] are events, not anyone's words.`,
      session.safeword ? safewordBlock(session) : PASS_LINE,
      currentDateTimeLine(),
    ].join('\n\n')
  }
  return [
    session.instructions.trim(),
    `Participants: ${host} (started the session) and ${guest}. Each message is prefixed with the name of who wrote it.`,
    PASS_LINE,
    currentDateTimeLine(),
  ].join('\n\n')
}

function speakerLine(m: Message): string {
  if (m.notice) return `[Session notice] ${m.content}`
  return `${m.author ?? 'Participant'}: ${m.content}`
}

/**
 * Human turns become user messages prefixed with the author's name; consecutive ones are merged,
 * because two people often speak in a row and not every chat template accepts back-to-back user turns.
 */
export function buildMediatorHistory(session: SharedSession, messages: Message[]) {
  const turns: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of messages) {
    if (!m.content.trim()) continue
    if (m.role === 'assistant') {
      turns.push({ role: 'assistant', content: m.content })
      continue
    }
    const line = speakerLine(m)
    const last = turns[turns.length - 1]
    if (last?.role === 'user') last.content += `\n${line}`
    else turns.push({ role: 'user', content: line })
  }
  return [{ role: 'system' as const, content: buildMediatorSystemPrompt(session) }, ...turns]
}

// ---------- private coach ----------

/**
 * The most recent stretch of the session that fits the budget, oldest first. On-device models hold
 * about 4K tokens in total, so they get a much smaller window than cloud ones.
 */
export function sessionTranscript(session: SharedSession, messages: Message[], budgetChars: number): string {
  const lines: string[] = []
  let used = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m.content.trim()) continue
    const line = m.role === 'assistant' ? `${aiName(session)}: ${m.content}` : speakerLine(m)
    if (used + line.length > budgetChars && lines.length > 0) {
      lines.unshift('[…earlier messages omitted…]')
      break
    }
    lines.unshift(line)
    used += line.length
  }
  return lines.length ? lines.join('\n') : '(Nothing has been said in the session yet.)'
}

/**
 * The system prompt for a private coach chat. It runs on this phone with this person's own model, and
 * the other person never sees it — the prompt says so, so the coach can be candid.
 */
export function buildCoachPrompt(session: SharedSession, messages: Message[], budgetChars: number): string {
  const self = session.selfName
  const peer = session.peerName ?? 'the other person'
  let role: string
  if (modeOf(session) === 'power') {
    role =
      session.role === 'host'
        ? `You are ${self}'s private coach, and you are on ${self}'s side. ${self} is the submissive in a consensual power-exchange relationship with ${peer}, the dominant. Only ${self} sees this conversation; ${peer} never does.

Help ${self} understand their own limits and feelings, check whether what's happening is within what they agreed to, and find the words to raise a concern or propose a change to the agreement. Never pressure ${self} toward anything. Remind them, when it's relevant, that they can call the safeword or leave at any time without explaining why, and that only they can lift a safeword.`
        : `You are ${self}'s private coach. ${self} is the dominant in a consensual power-exchange relationship with ${peer}, the submissive. Only ${self} sees this conversation; ${peer} never does.

Help ${self} plan, reflect, and grow as a dominant: structure, rituals, tasks, communication, reading ${peer}'s responses. Keep ${peer}'s wellbeing and ongoing consent at the centre. Stay within the agreement. Never help ${self} work around ${peer}'s limits, the safeword, or the rule that changes to the agreement need ${peer}'s acceptance.`
  } else {
    role = `You are ${self}'s private coach during a mediated conversation with ${peer}. Only ${self} sees this conversation; ${peer} never does. Help ${self} reflect, understand what's being said, and decide how to respond. Be honest and kind, and don't take sides against ${peer}.`
  }

  return [
    role,
    'You are not a therapist or a crisis service. If someone describes being in danger, encourage them to contact local emergency services.',
    modeOf(session) === 'power' && session.agreement
      ? `THE AGREEMENT (version ${session.agreementVersion ?? 1})\n\n${renderAgreement(session.agreement)}`
      : null,
    session.safeword ? `The safeword is currently in effect (called by ${session.safeword === session.role ? self : peer}).` : null,
    `THE SHARED SESSION SO FAR (you can read it; you can't post to it)\n\n${sessionTranscript(session, messages, budgetChars)}`,
    currentDateTimeLine(),
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Arrival order, not timestamps — the two phones' clocks needn't agree. */
export function upsertMessage(messages: Message[], message: Message): Message[] {
  const i = messages.findIndex((m) => m.id === message.id)
  if (i === -1) return [...messages, message]
  const next = messages.slice()
  next[i] = message
  return next
}

export function makeSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const NAME_KEY = 'haven.sessionName.v1'

export function getSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // storage unavailable — they'll retype it next time
  }
}
