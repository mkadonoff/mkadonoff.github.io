import type { InitProgressReport } from '@mlc-ai/web-llm'
import { MODELS } from '../data/models'
import { getEngine, isWebGPUSupported } from './engine'
import { streamModelReply } from './respond'
import { getVeniceKey, isVeniceModelId, streamVeniceReply, VeniceError } from './venice'

export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string }

export type Generate = (history: ChatTurn[], onChunk: (soFar: string) => void, signal: AbortSignal) => Promise<void>

/** Matches WebLLM's own error name, so describeEngineError explains it the same way. */
class WebGPUNotAvailableError extends Error {
  constructor() {
    super("This browser doesn't support WebGPU.")
    this.name = 'WebGPUNotAvailableError'
  }
}

/**
 * Resolves a model id to a function that streams a reply, loading the on-device engine first when
 * needed. Both private chats and the shared-session mediator go through here.
 */
export async function prepareGenerator(
  modelId: string,
  onLoadProgress: (report: InitProgressReport, webllmId: string) => void,
): Promise<Generate> {
  if (isVeniceModelId(modelId)) {
    const apiKey = getVeniceKey()
    if (!apiKey) throw new VeniceError('No Venice API key is saved in this browser.', null)
    return (history, onChunk, signal) => streamVeniceReply(modelId, apiKey, history, onChunk, signal)
  }

  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0]
  if (!(await isWebGPUSupported())) throw new WebGPUNotAvailableError()
  const engine = await getEngine(model.webllmId, (report) => onLoadProgress(report, model.webllmId))
  return (history, onChunk, signal) => streamModelReply(engine, history, onChunk, signal)
}
