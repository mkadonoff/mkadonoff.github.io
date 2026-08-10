export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  modelId?: string
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  modelId: string
  messages: Message[]
  createdAt: number
  updatedAt: number
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

export interface EngineState {
  status: EngineStatus
  modelId: string | null
  progress: number
  progressText: string
  error: string | null
}
