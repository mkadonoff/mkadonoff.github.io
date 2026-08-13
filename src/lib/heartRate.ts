export interface HeartRateReading {
  bpm: number
  confidence: number
  measuredAt: number
}

export interface MeasurementProgress {
  elapsedMs: number
  totalMs: number
  /** Rough live signal strength (0–1) so the UI can tell the user to hold still / adjust. */
  quality: number
}

const STORAGE_KEY = 'haven.heartRate.v1'

/** A point measurement goes stale fast — past this we stop calling it "current". */
const MAX_AGE_MS = 30 * 60 * 1000

const SAMPLE_HZ = 30
const MIN_BPM = 40
const MAX_BPM = 200
const MEASURE_MS = 25_000
/** Discard the first stretch — auto-exposure and white balance are still settling. */
const WARMUP_MS = 3_000
/** Below this normalized autocorrelation peak we don't trust the estimate at all. */
const MIN_CONFIDENCE = 0.5
/** How close to the best peak a shorter-lag peak must be to win — guards against octave errors. */
const SUBHARMONIC_TOLERANCE = 0.8

let reading: HeartRateReading | null = null
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) reading = JSON.parse(raw) as HeartRateReading
  } catch {
    reading = null
  }
}

export function getReading(): HeartRateReading | null {
  load()
  if (!reading) return null
  if (Date.now() - reading.measuredAt > MAX_AGE_MS) return null
  return reading
}

export function setReading(next: HeartRateReading | null) {
  load()
  reading = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable — the in-memory value still works for this session
  }
}

export function heartRateLine(): string | null {
  const r = getReading()
  if (!r) return null
  const ageMin = Math.round((Date.now() - r.measuredAt) / 60_000)
  const when = ageMin < 1 ? 'just now' : `${ageMin} min ago`
  return (
    `User's heart rate: about ${r.bpm} BPM, measured ${when} with the phone camera. ` +
    `This is an approximate optical estimate, not a medical-grade reading — treat it as a rough ` +
    `signal and never as a basis for medical advice.`
  )
}

// ---------- capture ----------

export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser has no camera access.')
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 } },
    audio: false,
  })
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}

export interface Sample {
  t: number
  v: number
}

/**
 * Averages the red channel over a small centre crop of each frame. When a fingertip covers
 * the lens, blood volume changes across each beat show up as a faint periodic ripple here.
 */
function sampleRed(video: HTMLVideoElement, canvas: HTMLCanvasElement): number | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || video.videoWidth === 0) return null

  const size = 64
  canvas.width = size
  canvas.height = size
  const side = Math.min(video.videoWidth, video.videoHeight)
  const sx = (video.videoWidth - side) / 2
  const sy = (video.videoHeight - side) / 2
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size)

  const { data } = ctx.getImageData(0, 0, size, size)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += data[i]
  return sum / (data.length / 4)
}

export function runMeasurement(
  video: HTMLVideoElement,
  onProgress: (p: MeasurementProgress) => void,
  signal: AbortSignal,
): Promise<HeartRateReading> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const samples: Sample[] = []
    const start = performance.now()
    let frame = 0

    function tick() {
      if (signal.aborted) {
        reject(new Error('Measurement cancelled.'))
        return
      }

      const now = performance.now()
      const elapsed = now - start
      const v = sampleRed(video, canvas)
      if (v !== null && elapsed > WARMUP_MS) samples.push({ t: now, v })

      // Recompute the live quality hint occasionally rather than every frame.
      if (++frame % 10 === 0 && samples.length > SAMPLE_HZ * 3) {
        const recent = samples.slice(-SAMPLE_HZ * 5).map((s) => s.v)
        onProgress({ elapsedMs: elapsed, totalMs: MEASURE_MS, quality: signalQuality(recent) })
      } else {
        onProgress({ elapsedMs: elapsed, totalMs: MEASURE_MS, quality: 0 })
      }

      if (elapsed >= MEASURE_MS) {
        const result = estimateBpm(samples)
        if (!result) {
          reject(new Error("Couldn't find a steady pulse. Hold still, cover the lens fully, and try again."))
          return
        }
        resolve({ ...result, measuredAt: Date.now() })
        return
      }

      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  })
}

// ---------- signal processing ----------

/** Crude live indicator: how much of the recent signal is variation vs. flat/saturated. */
function signalQuality(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean < 5 || mean > 250) return 0 // too dark, or blown out
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length
  return Math.min(1, Math.sqrt(variance) / 2)
}

/** rAF is not a fixed cadence (and iOS throttles it), so put samples on an even grid first. */
function resample(samples: Sample[], hz: number): number[] {
  if (samples.length < 2) return []
  const step = 1000 / hz
  const t0 = samples[0].t
  const span = samples[samples.length - 1].t - t0
  const out: number[] = []
  let j = 0
  for (let t = 0; t <= span; t += step) {
    const target = t0 + t
    while (j < samples.length - 2 && samples[j + 1].t < target) j++
    const a = samples[j]
    const b = samples[j + 1]
    const ratio = b.t === a.t ? 0 : (target - a.t) / (b.t - a.t)
    out.push(a.v + (b.v - a.v) * ratio)
  }
  return out
}

/** Subtract a moving average to kill slow drift from exposure changes and hand movement. */
function detrend(values: number[], window: number): number[] {
  const out: number[] = []
  for (let i = 0; i < values.length; i++) {
    const lo = Math.max(0, i - window)
    const hi = Math.min(values.length - 1, i + window)
    let sum = 0
    for (let k = lo; k <= hi; k++) sum += values[k]
    out.push(values[i] - sum / (hi - lo + 1))
  }
  return out
}

export function estimateBpm(samples: Sample[]): { bpm: number; confidence: number } | null {
  const uniform = resample(samples, SAMPLE_HZ)
  if (uniform.length < SAMPLE_HZ * 5) return null

  const centered = detrend(uniform, Math.round(SAMPLE_HZ * 0.5))
  const n = centered.length

  const minLag = Math.floor((SAMPLE_HZ * 60) / MAX_BPM)
  const maxLag = Math.min(n - 1, Math.ceil((SAMPLE_HZ * 60) / MIN_BPM))
  if (maxLag <= minLag) return null

  // Normalized autocorrelation — the lag with the strongest self-similarity is the beat period.
  const corr: number[] = []
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    let e1 = 0
    let e2 = 0
    for (let i = 0; i + lag < n; i++) {
      sum += centered[i] * centered[i + lag]
      e1 += centered[i] ** 2
      e2 += centered[i + lag] ** 2
    }
    const denom = Math.sqrt(e1 * e2)
    corr.push(denom > 0 ? sum / denom : 0)
  }

  // A signal with period T also correlates strongly at 2T, 3T… so taking the global maximum
  // reports half or a third of the true rate. Walk from the shortest lag instead and take the
  // first local peak that gets close to the best one — that's the fundamental, not a subharmonic.
  let globalIdx = 0
  for (let i = 1; i < corr.length; i++) if (corr[i] > corr[globalIdx]) globalIdx = i

  let bestIdx = globalIdx
  for (let i = 1; i < corr.length - 1; i++) {
    if (corr[i] > corr[i - 1] && corr[i] >= corr[i + 1] && corr[i] >= corr[globalIdx] * SUBHARMONIC_TOLERANCE) {
      bestIdx = i
      break
    }
  }

  const confidence = corr[bestIdx]
  if (!(confidence >= MIN_CONFIDENCE)) return null

  // Parabolic interpolation for sub-sample precision on the peak.
  let lag = minLag + bestIdx
  if (bestIdx > 0 && bestIdx < corr.length - 1) {
    const a = corr[bestIdx - 1]
    const b = corr[bestIdx]
    const c = corr[bestIdx + 1]
    const denom = a - 2 * b + c
    if (denom !== 0) lag += (0.5 * (a - c)) / denom
  }

  const bpm = Math.round((SAMPLE_HZ * 60) / lag)
  if (bpm < MIN_BPM || bpm > MAX_BPM) return null
  return { bpm, confidence }
}
