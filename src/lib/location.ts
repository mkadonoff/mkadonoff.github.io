const STORAGE_KEY = 'haven.locationSharing.v1'

let cachedLine: Promise<string | null> | null = null

export function isLocationSharingEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setLocationSharingEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // storage unavailable (private browsing, quota) — setting won't persist across reloads
  }
  cachedLine = null
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10_000,
      maximumAge: 5 * 60 * 1000,
    })
  })
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const parts = [data.locality, data.principalSubdivision, data.countryName].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

async function resolveLocationLine(): Promise<string | null> {
  try {
    const position = await getPosition()
    const place = await reverseGeocode(position.coords.latitude, position.coords.longitude)
    return place ? `User's approximate location: ${place}.` : null
  } catch {
    return null
  }
}

// Resolved once per session (or until sharing is toggled) — avoids re-prompting and
// re-hitting the reverse-geocoding API on every message.
export function getLocationLine(): Promise<string | null> {
  if (!isLocationSharingEnabled()) return Promise.resolve(null)
  if (!cachedLine) cachedLine = resolveLocationLine()
  return cachedLine
}
