import type { Conversation } from '../types'

const STORAGE_KEY = 'haven.conversations.v1'

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
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
