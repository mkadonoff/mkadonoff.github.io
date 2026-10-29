import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * Dark modules on white with a quiet zone regardless of the app's dark theme — phone cameras read
 * that far more reliably. Low error correction keeps the modules large enough to scan off a screen.
 */
export function QrCode({ text, label }: { text: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(text, { errorCorrectionLevel: 'L', margin: 3, width: 640 })
      .then((url) => {
        if (alive) setSrc(url)
      })
      .catch(() => {
        if (alive) setSrc(null)
      })
    return () => {
      alive = false
    }
  }, [text])

  return (
    <div className="mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-xl bg-white">
      {src ? <img src={src} alt={label} className="h-full w-full [image-rendering:pixelated]" /> : null}
    </div>
  )
}
