import { CreateMLCEngine, type MLCEngine, type InitProgressReport } from '@mlc-ai/web-llm'
import { clearLoadAttempt, hasWebGpuAdapter, markLoadAttempt } from './capability'

let engine: MLCEngine | null = null
let loadedModelId: string | null = null
let loadPromise: Promise<MLCEngine> | null = null

export function isWebGPUSupported(): Promise<boolean> {
  return hasWebGpuAdapter()
}

export async function getEngine(
  webllmModelId: string,
  onProgress: (report: InitProgressReport) => void,
): Promise<MLCEngine> {
  if (engine && loadedModelId === webllmModelId) return engine

  if (loadPromise && loadedModelId === webllmModelId) return loadPromise

  const promise = (async () => {
    // Recorded before the attempt: an out-of-memory kill takes the tab down without unwinding,
    // so a marker still present next visit is the only trace that this load never finished.
    markLoadAttempt(webllmModelId)
    if (!engine) {
      engine = await CreateMLCEngine(webllmModelId, { initProgressCallback: onProgress })
    } else {
      await engine.reload(webllmModelId)
    }
    clearLoadAttempt(webllmModelId)
    loadedModelId = webllmModelId
    return engine
  })()

  loadPromise = promise
  try {
    return await promise
  } finally {
    loadPromise = null
  }
}

export function interruptGeneration() {
  engine?.interruptGenerate()
}
