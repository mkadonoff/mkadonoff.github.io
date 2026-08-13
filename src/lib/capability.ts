import { prebuiltAppConfig } from '@mlc-ai/web-llm'

export interface DeviceCapability {
  /** Max single GPU buffer, bytes. null when WebGPU is unavailable. */
  maxBufferSize: number | null
  /** Max storage buffer binding, bytes. WebLLM uses this to guess constrained devices. */
  maxStorageBufferBindingSize: number | null
  /** Cache quota and current usage, bytes. null when the Storage API is unavailable. */
  storageQuota: number | null
  storageUsage: number | null
  /** Total device RAM in GiB, rounded. Chromium-only — null on Safari, meaning "unknown". */
  deviceMemoryGb: number | null
}

export type FitLevel = 'ok' | 'tight' | 'unlikely'

export interface ModelFit {
  level: FitLevel
  reason: string | null
}

const FAILURES_KEY = 'haven.loadFailures.v1'
const MIB = 1024 * 1024
/** WebGPU's default maxStorageBufferBindingSize — a device at the floor is resource-constrained. */
const DEFAULT_BINDING_SIZE = 128 * MIB
/** Above this, a model is big enough that a constrained device is a real concern. */
const LARGE_MODEL_MB = 1500

// ---------- failure memory ----------

function readFailures(): string[] {
  try {
    const raw = localStorage.getItem(FAILURES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeFailures(ids: string[]) {
  try {
    localStorage.setItem(FAILURES_KEY, JSON.stringify(ids))
  } catch {
    // storage unavailable — failure memory just won't persist
  }
}

/**
 * Written immediately *before* a load attempt, cleared once it succeeds. An out-of-memory kill
 * tears down the tab without running any catch block, so a marker still present on the next
 * visit is the only evidence that the previous attempt never finished.
 */
export function markLoadAttempt(webllmId: string) {
  const ids = readFailures()
  if (!ids.includes(webllmId)) writeFailures([...ids, webllmId])
}

export function clearLoadAttempt(webllmId: string) {
  const ids = readFailures()
  if (ids.includes(webllmId)) writeFailures(ids.filter((id) => id !== webllmId))
}

export function hasFailedBefore(webllmId: string): boolean {
  return readFailures().includes(webllmId)
}

// ---------- capability probe ----------

let probe: Promise<DeviceCapability> | null = null

async function runProbe(): Promise<DeviceCapability> {
  let maxBufferSize: number | null = null
  let maxStorageBufferBindingSize: number | null = null
  try {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      const adapter = await navigator.gpu.requestAdapter()
      if (adapter) {
        maxBufferSize = adapter.limits.maxBufferSize
        maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize
      }
    }
  } catch {
    // leave as null — treated as unknown, never as zero
  }

  let storageQuota: number | null = null
  let storageUsage: number | null = null
  try {
    const est = await navigator.storage?.estimate?.()
    if (est) {
      storageQuota = est.quota ?? null
      storageUsage = est.usage ?? null
    }
  } catch {
    // same — unknown
  }

  const deviceMemoryGb =
    typeof (navigator as { deviceMemory?: number }).deviceMemory === 'number'
      ? (navigator as { deviceMemory?: number }).deviceMemory!
      : null

  return { maxBufferSize, maxStorageBufferBindingSize, storageQuota, storageUsage, deviceMemoryGb }
}

export function getDeviceCapability(): Promise<DeviceCapability> {
  if (!probe) probe = runProbe()
  return probe
}

/** Whether WebGPU produced an adapter, reusing the memoized probe instead of requesting twice. */
export async function hasWebGpuAdapter(): Promise<boolean> {
  const cap = await getDeviceCapability()
  return cap.maxBufferSize !== null
}

// ---------- assessment ----------

export function requiredVramMb(webllmId: string): number | null {
  const record = prebuiltAppConfig.model_list.find((m) => m.model_id === webllmId)
  return record?.vram_required_MB ?? null
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * MIB ? `${(bytes / (1024 * MIB)).toFixed(1)} GB` : `${Math.round(bytes / MIB)} MB`
}

/**
 * Pure so it can be exercised without a browser. None of these signals is free memory — the web
 * exposes no such number — so every outcome is a hedge, never a verdict.
 */
export function assessModel(webllmId: string, cap: DeviceCapability, failedBefore: boolean): ModelFit {
  if (failedBefore) {
    return { level: 'unlikely', reason: 'This model failed to load on this device before.' }
  }

  const vramMb = requiredVramMb(webllmId)
  if (vramMb === null) return { level: 'ok', reason: null }
  const weightsBytes = vramMb * MIB

  if (cap.storageQuota !== null) {
    const free = cap.storageQuota - (cap.storageUsage ?? 0)
    if (free < weightsBytes) {
      return {
        level: 'unlikely',
        reason: `Needs about ${formatBytes(weightsBytes)} cached but only ${formatBytes(free)} is available.`,
      }
    }
    if (free < weightsBytes * 1.25) {
      return {
        level: 'tight',
        reason: `Needs about ${formatBytes(weightsBytes)} and only ${formatBytes(free)} is available.`,
      }
    }
  }

  if (cap.deviceMemoryGb !== null && vramMb > cap.deviceMemoryGb * 512) {
    return {
      level: 'tight',
      reason: `Needs about ${formatBytes(weightsBytes)} on a device reporting ${cap.deviceMemoryGb} GB of RAM.`,
    }
  }

  if (
    cap.maxStorageBufferBindingSize !== null &&
    cap.maxStorageBufferBindingSize <= DEFAULT_BINDING_SIZE &&
    vramMb > LARGE_MODEL_MB
  ) {
    return {
      level: 'tight',
      reason: 'This device reports limited GPU buffers, which often means constrained memory.',
    }
  }

  return { level: 'ok', reason: null }
}

/** Human-readable summary of what was actually detected, for display in the picker. */
export function describeCapability(cap: DeviceCapability): string {
  const parts: string[] = []
  if (cap.storageQuota !== null) {
    parts.push(`${formatBytes(cap.storageQuota - (cap.storageUsage ?? 0))} storage free`)
  }
  if (cap.maxBufferSize !== null) parts.push(`${formatBytes(cap.maxBufferSize)} max GPU buffer`)
  if (cap.deviceMemoryGb !== null) parts.push(`${cap.deviceMemoryGb} GB RAM`)
  return parts.length ? parts.join(' · ') : 'Device limits unavailable in this browser.'
}
