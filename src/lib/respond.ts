import { MODELS } from '../data/models'

const OPENERS = [
  "Here's a thought on that —",
  "Sure, let's dig into this.",
  "Good question.",
  "Happy to help with that.",
  "Let me lay this out.",
]

const CODE_SNIPPET = '```ts\nfunction sum(a: number, b: number) {\n  return a + b\n}\n```'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function modelFlavor(modelId: string): string {
  switch (modelId) {
    case 'lighthouse-reasoning':
      return "I worked through a few angles before settling on this, so here's the reasoning, step by step:"
    case 'driftwood-fast':
      return 'Quick take:'
    case 'tidepool-code':
      return "Here's a minimal example to illustrate the idea:"
    default:
      return pick(OPENERS)
  }
}

export function generateReply(userText: string, modelId: string): string {
  const model = MODELS.find((m) => m.id === modelId)
  const trimmed = userText.trim()
  const intro = modelFlavor(modelId)

  const lines: string[] = [intro]

  if (modelId === 'tidepool-code' || /\bcode\b|\bfunction\b|\bbug\b/i.test(trimmed)) {
    lines.push(CODE_SNIPPET)
    lines.push(
      "That's a simplified example — this is a local demo, so I'm not actually executing or reading real code here.",
    )
  } else if (trimmed.length < 20) {
    lines.push(
      `You said "${trimmed}" — in a real deployment I'd pull context from the conversation and ${model?.name ?? 'the selected model'} would generate a full response here.`,
    )
  } else {
    lines.push(
      `On "${trimmed.slice(0, 80)}${trimmed.length > 80 ? '…' : ''}", I'd normally reason through the details and give you a grounded answer.`,
    )
    lines.push(
      'This build is a local UI demo though, so every reply is simulated on-device — nothing you type is sent anywhere.',
    )
  }

  return lines.join('\n\n')
}

export function streamReply(
  fullText: string,
  onChunk: (soFar: string) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    const words = fullText.split(/(\s+)/)
    let index = 0
    let soFar = ''

    const tick = () => {
      if (signal.aborted) {
        resolve()
        return
      }
      if (index >= words.length) {
        resolve()
        return
      }
      soFar += words[index]
      index += 1
      onChunk(soFar)
      setTimeout(tick, 12 + Math.random() * 24)
    }

    tick()
  })
}
