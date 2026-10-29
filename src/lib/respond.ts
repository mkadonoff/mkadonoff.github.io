import type { MLCEngine } from '@mlc-ai/web-llm'
import type { Message } from '../types'
import { interruptGeneration } from './engine'

const SYSTEM_PROMPT =
  'You are Haven, a private AI assistant. You run entirely on the user\'s device — no message ever leaves their browser. Be helpful, direct, and concise.'

// The local prompt's privacy claim would be false here, and the model would repeat it to the user.
const CLOUD_SYSTEM_PROMPT =
  'You are Haven, an AI assistant. You are running on a cloud model through Venice.ai, not on the user\'s device. Be helpful, direct, and concise.'

export interface PromptContext {
  /** True when the reply comes from Venice rather than the on-device model. */
  cloud?: boolean
  locationLine?: string | null
  geofenceLine?: string | null
  heartRateLine?: string | null
}

function currentDateTimeLine(): string {
  const now = new Date()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(now)
  return `Current date and time: ${formatted} (${timeZone}).`
}

export function buildSystemPrompt(context: PromptContext = {}): string {
  return [
    context.cloud ? CLOUD_SYSTEM_PROMPT : SYSTEM_PROMPT,
    currentDateTimeLine(),
    context.locationLine,
    context.geofenceLine,
    context.heartRateLine,
  ]
    .filter(Boolean)
    .join('\n')
}

export function toChatHistory(messages: Message[], context: PromptContext = {}) {
  return [
    { role: 'system' as const, content: buildSystemPrompt(context) },
    ...messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content })),
  ]
}

export async function streamModelReply(
  engine: MLCEngine,
  history: { role: 'system' | 'user' | 'assistant'; content: string }[],
  onChunk: (soFar: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const completion = await engine.chat.completions.create({
    messages: history,
    stream: true,
  })

  let soFar = ''
  for await (const chunk of completion) {
    if (signal.aborted) {
      interruptGeneration()
      return
    }
    const delta = chunk.choices[0]?.delta?.content ?? ''
    if (delta) {
      soFar += delta
      onChunk(soFar)
    }
  }
}
