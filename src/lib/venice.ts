// Cloud inference through Venice.ai's OpenAI-compatible API. Opt-in: nothing here touches the
// network until the user saves an API key, and the key never leaves this browser except as the
// Authorization header on requests to Venice itself.
//
// Venice answers CORS with `access-control-allow-origin: *` (verified for both the models list and
// the chat-completions preflight), so the static site can call it directly — no proxy.

const API_BASE = 'https://api.venice.ai/api/v1'
const KEY_STORAGE = 'haven.veniceApiKey.v1'
const MODELS_STORAGE = 'haven.veniceModels.v1'

/** Conversation and message model ids for Venice are this prefix plus Venice's own model id. */
export const VENICE_PREFIX = 'venice:'

export interface VeniceModel {
  /** Venice's id, without our prefix. */
  id: string
  name: string
  contextTokens: number | null
}

/** Carries the HTTP status so errors can be explained by cause rather than by message text. */
export class VeniceError extends Error {
  status: number | null
  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'VeniceError'
    this.status = status
  }
}

// ---------- ids ----------

export function isVeniceModelId(modelId: string | undefined): boolean {
  return !!modelId && modelId.startsWith(VENICE_PREFIX)
}

export function toVeniceModelId(veniceId: string): string {
  return VENICE_PREFIX + veniceId
}

function fromVeniceModelId(modelId: string): string {
  return modelId.slice(VENICE_PREFIX.length)
}

/**
 * Display name for a Venice-backed model id. Falls back to Venice's raw id when the model isn't in
 * the cached list (retired upstream, or the list was never fetched), so a label never disappears.
 */
export function veniceModelName(modelId: string): string {
  const raw = fromVeniceModelId(modelId)
  return getCachedVeniceModels().find((m) => m.id === raw)?.name ?? raw
}

// ---------- key ----------

// Deliberately no URL parameter for this, unlike other opt-in features: a key in a URL would land
// in browser history and anywhere the link was pasted.
export function getVeniceKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE) || null
  } catch {
    return null
  }
}

export function setVeniceKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    // storage unavailable — the key won't persist across reloads
  }
}

// ---------- models ----------

export function getCachedVeniceModels(): VeniceModel[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MODELS_STORAGE) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface RawVeniceModel {
  id?: unknown
  type?: unknown
  model_spec?: { name?: unknown; availableContextTokens?: unknown; offline?: unknown }
}

/** Pure, so it can be exercised outside a browser. Drops non-text and offline models. */
export function parseVeniceModels(body: unknown): VeniceModel[] {
  const data = (body as { data?: unknown })?.data
  if (!Array.isArray(data)) return []
  return (data as RawVeniceModel[])
    .filter((m) => typeof m.id === 'string' && (m.type === undefined || m.type === 'text'))
    .filter((m) => m.model_spec?.offline !== true)
    .map((m) => ({
      id: m.id as string,
      name: typeof m.model_spec?.name === 'string' ? m.model_spec.name : (m.id as string),
      contextTokens:
        typeof m.model_spec?.availableContextTokens === 'number' ? m.model_spec.availableContextTokens : null,
    }))
}

/** Fetches the live text-model list and caches it, so labels resolve offline later. */
export async function fetchVeniceModels(): Promise<VeniceModel[]> {
  const res = await fetch(`${API_BASE}/models?type=text`)
  if (!res.ok) throw new VeniceError(`Venice returned ${res.status} listing models`, res.status)
  const models = parseVeniceModels(await res.json())
  try {
    localStorage.setItem(MODELS_STORAGE, JSON.stringify(models))
  } catch {
    // storage unavailable — names just won't be cached
  }
  return models
}

// ---------- chat ----------

/** Status 0 marks a failure with no HTTP response at all — offline, DNS, a dropped stream. */
function unreachable(err: unknown): VeniceError {
  return new VeniceError(err instanceof Error ? err.message : String(err), 0)
}

async function errorFromResponse(res: Response): Promise<VeniceError> {
  let message = `Venice returned ${res.status}`
  try {
    const body = await res.json()
    const detail = body?.error?.message ?? body?.error ?? body?.message
    if (typeof detail === 'string' && detail) message = `${message}: ${detail}`
  } catch {
    // body wasn't JSON — keep the status-only message
  }
  return new VeniceError(message, res.status)
}

/**
 * Pulls the content deltas out of one block of server-sent events. Pure, for testing. Returns
 * `done: true` on the `[DONE]` sentinel.
 */
export function parseSseLines(lines: string[]): { text: string; done: boolean } {
  let text = ''
  for (const line of lines) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (payload === '[DONE]') return { text, done: true }
    try {
      const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content
      if (typeof delta === 'string') text += delta
    } catch {
      // a keep-alive or malformed line — skip it rather than abort the reply
    }
  }
  return { text, done: false }
}

export async function streamVeniceReply(
  modelId: string,
  apiKey: string,
  history: { role: 'system' | 'user' | 'assistant'; content: string }[],
  onChunk: (soFar: string) => void,
  signal: AbortSignal,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: fromVeniceModelId(modelId),
        messages: history,
        stream: true,
        // Venice prepends its own system prompt by default. Off, so the prompt viewer's
        // "exactly what's sent" stays true.
        venice_parameters: { include_venice_system_prompt: false },
      }),
      signal,
    })
  } catch (err) {
    if (signal.aborted) return
    throw unreachable(err)
  }
  if (!res.ok) throw await errorFromResponse(res)
  if (!res.body) throw new VeniceError('Venice sent an empty response', res.status)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let soFar = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // The last piece may be a partial line; keep it for the next read — unless the stream has
      // ended, in which case it's all there is.
      buffer = done ? '' : (lines.pop() ?? '')
      const parsed = parseSseLines(lines)
      if (parsed.text) {
        soFar += parsed.text
        onChunk(soFar)
      }
      if (parsed.done || done) return
    }
  } catch (err) {
    if (signal.aborted) return
    throw unreachable(err)
  }
}
