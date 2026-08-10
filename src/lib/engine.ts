import { CreateMLCEngine, type MLCEngine, type InitProgressReport } from '@mlc-ai/web-llm'

let engine: MLCEngine | null = null
let loadedModelId: string | null = null
let loadPromise: Promise<MLCEngine> | null = null

export async function isWebGPUSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

export async function getEngine(
  webllmModelId: string,
  onProgress: (report: InitProgressReport) => void,
): Promise<MLCEngine> {
  if (engine && loadedModelId === webllmModelId) return engine

  if (loadPromise && loadedModelId === webllmModelId) return loadPromise

  const promise = (async () => {
    if (!engine) {
      engine = await CreateMLCEngine(webllmModelId, { initProgressCallback: onProgress })
    } else {
      await engine.reload(webllmModelId)
    }
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
