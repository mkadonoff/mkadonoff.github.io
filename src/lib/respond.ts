import type { MLCEngine } from '@mlc-ai/web-llm'
import type { Message } from '../types'
import { interruptGeneration } from './engine'

const SYSTEM_PROMPT =
  'You are Haven, a private AI assistant. You run entirely on the user\'s device — no message ever leaves their browser. Be helpful, direct, and concise.'

function currentDateTimeLine(): string {
  const now = new Date()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(now)
  return `Current date and time: ${formatted} (${timeZone}).`
}

export function buildSystemPrompt(
  locationLine?: string | null,
  geofenceLine?: string | null,
): string {
  return [SYSTEM_PROMPT, currentDateTimeLine(), locationLine, geofenceLine].filter(Boolean).join('\n')
}

export function toChatHistory(messages: Message[], locationLine?: string | null, geofenceLine?: string | null) {
  return [
    { role: 'system' as const, content: buildSystemPrompt(locationLine, geofenceLine) },
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
