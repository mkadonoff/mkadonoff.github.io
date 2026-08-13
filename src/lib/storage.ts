import type { Conversation } from '../types'
import { LEGACY_MODEL_IDS } from '../data/models'

const STORAGE_KEY = 'haven.conversations.v1'

function currentId(modelId: string | undefined): string | undefined {
  if (!modelId) return modelId
  return LEGACY_MODEL_IDS[modelId] ?? modelId
}

/**
 * Model ids are stored on the conversation *and* on every assistant message, so both need
 * remapping — otherwise MessageBubble silently drops the model label from older replies.
 * Unknown ids pass through untouched.
 */
function migrateModelIds(conversations: Conversation[]): Conversation[] {
  return conversations.map((c) => ({
    ...c,
    modelId: currentId(c.modelId) ?? c.modelId,
    messages: Array.isArray(c.messages)
      ? c.messages.map((m) => (m.modelId ? { ...m, modelId: currentId(m.modelId) } : m))
      : [],
  }))
}

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? migrateModelIds(parsed) : []
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  } catch {
    // storage unavailable (private browsing, quota) — fail silently, in-memory state still works
  }
}

export function clearConversations() {
  localStorage.removeItem(STORAGE_KEY)
}
