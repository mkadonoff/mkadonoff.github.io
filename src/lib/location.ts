const STORAGE_KEY = 'haven.locationSharing.v1'

let cachedLine: Promise<string | null> | null = null
let resolvedLine: string | null = null

// Off unless explicitly enabled — the public page shouldn't prompt a first-time visitor
// for their location. Enable it for your own devices with ?location=on (see
// applyLocationPreferenceFromUrl), which persists the choice from then on.
export function isLocationSharingEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Reads a ?location=on|off override out of the URL, stores it, and strips it from the
 * address bar so it isn't carried into a shared link. Must run before React mounts, since
 * components read the preference in their initial state.
 */
export function applyLocationPreferenceFromUrl() {
  try {
    const url = new URL(window.location.href)
    const raw = url.searchParams.get('location')
    if (raw === null) return

    if (/^(on|1|true)$/i.test(raw)) setLocationSharingEnabled(true)
    else if (/^(off|0|false)$/i.test(raw)) setLocationSharingEnabled(false)

    url.searchParams.delete('location')
    window.history.replaceState(null, '', url.toString())
  } catch {
    // malformed URL or no history access — fall back to the stored preference
  }
}

export function setLocationSharingEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // storage unavailable (private browsing, quota) — setting won't persist across reloads
  }
  cachedLine = null
  resolvedLine = null
}

// Synchronous snapshot of whatever getLocationLine() last resolved, for UI display.
// Returns null before the first resolution (e.g. sharing was just turned on).
export function peekLocationLine(): string | null {
  return isLocationSharingEnabled() ? resolvedLine : null
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

// Browser caches the last fix for up to 5 minutes (see getPosition), so calling this
// repeatedly (e.g. once per message for geofencing) doesn't re-prompt or hit the GPS each time.
export async function getCurrentCoords(): Promise<{ latitude: number; longitude: number }> {
  const position = await getPosition()
  return { latitude: position.coords.latitude, longitude: position.coords.longitude }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const parts = [data.locality, data.principalSubdivision, data.countryName].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

async function resolveLocationLine(): Promise<string | null> {
  try {
    const { latitude, longitude } = await getCurrentCoords()
    const coords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
    const place = await reverseGeocode(latitude, longitude)
    return place
      ? `User's approximate location: ${place} (lat/lon ${coords}).`
      : `User's approximate location: lat/lon ${coords}.`
  } catch {
    return null
  }
}

// Resolved once per session (or until sharing is toggled) — avoids re-prompting and
// re-hitting the reverse-geocoding API on every message.
export function getLocationLine(): Promise<string | null> {
  if (!isLocationSharingEnabled()) return Promise.resolve(null)
  if (!cachedLine) {
    cachedLine = resolveLocationLine().then((line) => {
      resolvedLine = line
      return line
    })
  }
  return cachedLine
}
