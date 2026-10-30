import { DEFAULT_MODEL_ID, MODELS } from '../data/models'
import { getCachedVeniceModels, getVeniceKey, isVeniceModelId, toVeniceModelId } from './venice'

// Every setting lives in this browser's localStorage, like the rest of Haven. Safari and a
// home-screen Haven on iOS keep separate storage, so each has its own settings.

const DEFAULT_MODEL_KEY = 'haven.defaultModel.v1'

function isUsable(modelId: string): boolean {
  if (isVeniceModelId(modelId)) return !!getVeniceKey()
  return MODELS.some((m) => m.id === modelId)
}

/**
 * The model new chats start on. A Venice choice falls back to the built-in default once the key is
 * removed, so a new chat never opens on a model it can't use.
 */
export function getDefaultModelId(): string {
  try {
    const stored = localStorage.getItem(DEFAULT_MODEL_KEY)
    if (stored && isUsable(stored)) return stored
  } catch {
    // storage unavailable — use the built-in default
  }
  return DEFAULT_MODEL_ID
}

export function setDefaultModelId(modelId: string) {
  try {
    localStorage.setItem(DEFAULT_MODEL_KEY, modelId)
  } catch {
    // storage unavailable — the choice won't persist
  }
}

/**
 * Private coach chats need a model that can follow a long session, which on-device models can't:
 * the default model if it's Venice, else the first Venice model, else the default.
 */
export function getCoachModelId(): string {
  const preferred = getDefaultModelId()
  if (isVeniceModelId(preferred)) return preferred
  const venice = getVeniceKey() ? getCachedVeniceModels()[0] : undefined
  return venice ? toVeniceModelId(venice.id) : preferred
}
