import { useEffect, useRef, useState } from 'react'
import {
  getReading,
  openCamera,
  runMeasurement,
  setReading,
  stopCamera,
  type HeartRateReading,
  type MeasurementProgress,
} from '../lib/heartRate'

type Phase = 'idle' | 'measuring' | 'done' | 'error'

export function HeartRatePanel({ onClose, onReading }: { onClose: () => void; onReading: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<MeasurementProgress | null>(null)
  const [result, setResult] = useState<HeartRateReading | null>(getReading)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      stopCamera(streamRef.current)
    }
  }, [])

  async function start() {
    setError(null)
    setPhase('measuring')
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const stream = await openCamera()
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Camera preview unavailable.')
      video.srcObject = stream
      await video.play()

      const reading = await runMeasurement(video, setProgress, controller.signal)
      setReading(reading)
      setResult(reading)
      setPhase('done')
      onReading()
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const message = /NotAllowedError|Permission/i.test(raw)
        ? 'Camera access was denied. Allow it in Safari settings to measure your heart rate.'
        : raw
      setError(message)
      setPhase(/cancelled/i.test(raw) ? 'idle' : 'error')
    } finally {
      stopCamera(streamRef.current)
      streamRef.current = null
      setProgress(null)
    }
  }

  function cancel() {
    abortRef.current?.abort()
  }

  const pct = progress ? Math.min(100, Math.round((progress.elapsedMs / progress.totalMs) * 100)) : 0

  return (
    <div className="mx-auto mb-2 max-w-3xl rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium text-neutral-400">Measure heart rate</p>
        <button onClick={onClose} className="text-[11px] text-neutral-500 hover:text-neutral-300">
          Close
        </button>
      </div>

      <div className="flex items-start gap-3">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-16 w-16 shrink-0 rounded-lg bg-white/5 object-cover ${
            phase === 'measuring' ? '' : 'opacity-40'
          }`}
        />

        <div className="min-w-0 flex-1">
          {phase === 'measuring' ? (
            <>
              <p className="text-[11px] text-neutral-300">
                Cover the rear camera lens with your fingertip and hold still.
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-500 transition-[width] duration-200"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <button onClick={cancel} className="mt-2 text-[11px] text-neutral-500 hover:text-neutral-300">
                Cancel
              </button>
            </>
          ) : (
            <>
              {result ? (
                <p className="text-[13px] text-neutral-200">
                  <span className="text-lg font-semibold tabular-nums text-amber-400">{result.bpm}</span> BPM
                  <span className="ml-2 text-[11px] text-neutral-500">
                    confidence {Math.round(result.confidence * 100)}%
                  </span>
                </p>
              ) : (
                <p className="text-[11px] text-neutral-400">
                  Uses the camera to detect the colour shift in your fingertip on each beat. Takes about 25
                  seconds and needs bright ambient light — iOS won't let a web page switch on the flash.
                </p>
              )}
              {error ? <p className="mt-1.5 text-[11px] text-red-400">{error}</p> : null}
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={start}
                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-medium text-neutral-950 hover:bg-amber-400"
                >
                  {result ? 'Measure again' : 'Start'}
                </button>
                {result ? (
                  <button
                    onClick={() => {
                      setReading(null)
                      setResult(null)
                      onReading()
                    }}
                    className="text-[11px] text-neutral-500 hover:text-neutral-300"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-neutral-600">
        Rough optical estimate, not a medical device — don't use it to make health decisions. The video never
        leaves your browser; only the resulting number is given to the model.
      </p>
    </div>
  )
}
