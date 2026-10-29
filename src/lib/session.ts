import type { Message, SessionRole, SharedSession } from '../types'

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

/**
 * Deliberately carries no location, geofence or heart-rate lines: those are one person's data, and
 * sharing them into a session needs that person's own consent, which this version doesn't ask for.
 */
export function buildMediatorSystemPrompt(session: Pick<SharedSession, 'instructions' | 'hostName' | 'role' | 'selfName' | 'peerName'>): string {
  const guestName = session.role === 'host' ? session.peerName : session.selfName
  return [
    session.instructions.trim(),
    `Participants: ${session.hostName} (started the session) and ${guestName ?? 'the other participant'}. Each message is prefixed with the name of who wrote it.`,
    `You see every message, but most don't need you. When it's better to stay quiet and let them talk to each other, reply with exactly ${PASS_MARKER} and nothing else.`,
    currentDateTimeLine(),
  ].join('\n\n')
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
    const line = `${m.author ?? 'Participant'}: ${m.content}`
    const last = turns[turns.length - 1]
    if (last?.role === 'user') last.content += `\n${line}`
    else turns.push({ role: 'user', content: line })
  }
  return [{ role: 'system' as const, content: buildMediatorSystemPrompt(session) }, ...turns]
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
