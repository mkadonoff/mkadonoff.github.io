import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

/** Safari has no BarcodeDetector, so frames are decoded in JS. A few per second is plenty. */
const SCAN_INTERVAL_MS = 150
const SCAN_WIDTH = 640

export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let done = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (s) => {
        if (done) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        await video.play().catch(() => {})
        timer = setInterval(() => {
          if (!ctx || video.videoWidth === 0) return
          const scale = Math.min(1, SCAN_WIDTH / video.videoWidth)
          canvas.width = Math.round(video.videoWidth * scale)
          canvas.height = Math.round(video.videoHeight * scale)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
          if (found?.data && !done) {
            done = true
            onResultRef.current(found.data)
          }
        }, SCAN_INTERVAL_MS)
      })
      .catch(() => setError("Couldn't open the camera. Allow camera access for this site, or paste the code instead."))

    return () => {
      done = true
      if (timer) clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-xl bg-black">
        {/* playsInline + muted: without them iOS Safari opens the video full screen or refuses to play. */}
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-amber-400/70" />
      </div>
      {error ? <p className="mt-2 text-center text-xs text-red-300">{error}</p> : null}
    </div>
  )
}
