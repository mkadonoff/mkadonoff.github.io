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
}

export type SessionRole = 'host' | 'guest'

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
  /** Role of whoever paused the session, or null while it's running. */
  pausedBy: SessionRole | null
  ended: boolean
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
