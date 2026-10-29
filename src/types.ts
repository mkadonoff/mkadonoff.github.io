export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  modelId?: string
  createdAt: number
  /** Shared sessions only: which participant wrote a user message. */
  from?: SessionRole
  /** Shared sessions only: that participant's display name, as it was when they wrote it. */
  author?: string
  /** Shared sessions only: a session event (safeword, agreement change) rather than anyone's words. */
  notice?: boolean
}

export type SessionRole = 'host' | 'guest'

/**
 * `mediation`: a neutral AI mediator between two people. `power`: a consensual power-exchange
 * relationship, where the AI coaches within a written agreement. In `power` the host is always the
 * submissive, so the phone that runs the AI belongs to the person the limits protect.
 */
export type SessionMode = 'mediation' | 'power'

/** The written terms of a power-exchange session. Rendered into the AI coach's instructions. */
export interface Agreement {
  /** What the dominant may direct. */
  directs: string
  /** The submissive's limits: things that need asking first, or that are off the table for now. */
  limits: string
  /** Absolute limits: never, under any circumstances. */
  absoluteLimits: string
  checkIns: string
  aftercare: string
  notes: string
}

/** A proposed change to the agreement. It takes effect only when the other person accepts it. */
export interface Proposal {
  id: string
  by: SessionRole
  agreement: Agreement
}

/**
 * A live conversation between two people on their own phones, connected directly over WebRTC, with
 * one AI as mediator. The host's phone runs the mediator; both agreed to its instructions and model.
 */
export interface SharedSession {
  sessionId: string
  role: SessionRole
  selfName: string
  peerName: string | null
  hostName: string
  /** The mediator's instructions, exactly as both participants accepted them. */
  instructions: string
  /** Display name of the mediator's model, as the host described it. */
  modelLabel: string
  cloud: boolean
  /** Role of whoever paused the session, or null while it's running. Mediation only. */
  pausedBy: SessionRole | null
  ended: boolean
  /** Absent on sessions saved before modes existed, which were all mediation. */
  mode?: SessionMode
  agreement?: Agreement
  agreementVersion?: number
  /** Role of whoever called the safeword, or null. Power mode only. */
  safeword?: SessionRole | null
  proposal?: Proposal | null
}

export interface GeofenceAnchor {
  latitude: number
  longitude: number
  place: string | null
  setAt: number
}

export interface Conversation {
  id: string
  title: string
  modelId: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  geofenceAnchor?: GeofenceAnchor
  shared?: SharedSession
  /** A private coach chat linked to a session: only this phone sees it, and it reads that session. */
  coachFor?: string
}

export interface ModelOption {
  id: string
  name: string
  tagline: string
  badge: string
  contextWindow: string
  webllmId: string
  downloadSize: string
}

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface EngineError {
  /** One-line plain-language explanation. */
  title: string
  /** Suggested next step, when there is a useful one. */
  hint: string | null
  /** The original message, kept so nothing is lost — displayed demoted. */
  detail: string | null
}

export interface EngineState {
  status: EngineStatus
  modelId: string | null
  progress: number
  progressText: string
  error: EngineError | null
}
