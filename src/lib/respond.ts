import type { MLCEngine } from '@mlc-ai/web-llm'
import type { Message } from '../types'
import { interruptGeneration } from './engine'

const SYSTEM_PROMPT =
  'You are Haven, a private AI assistant. You run entirely on the user\'s device — no message ever leaves their browser. Be helpful, direct, and concise.'

export function toChatHistory(messages: Message[]) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
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
