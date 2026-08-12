import type { GeofenceAnchor } from '../types'
import { getCurrentCoords, reverseGeocode } from './location'

// The model can't call real tools here, so it signals "reset the start point" by putting
// this exact token in its reply. The app strips it before display and treats it as the
// trigger to re-anchor — it's a text-convention stand-in for a tool call.
export const GEOFENCE_RESET_MARKER = '<<RESET_GEOFENCE>>'

const EARTH_RADIUS_M = 6_371_000
const STATIONARY_THRESHOLD_M = 50

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}

function anchorLabel(anchor: GeofenceAnchor): string {
  return anchor.place ?? `${anchor.latitude.toFixed(4)}, ${anchor.longitude.toFixed(4)}`
}

export async function captureGeofenceAnchor(): Promise<GeofenceAnchor> {
  const coords = await getCurrentCoords()
  const place = await reverseGeocode(coords.latitude, coords.longitude)
  return { ...coords, place, setAt: Date.now() }
}

// Fetches a fresh position (not the memoized one from lib/location) so movement since
// the anchor was set is actually reflected, then builds the line for the system prompt.
export async function buildGeofenceLine(anchor: GeofenceAnchor): Promise<string | null> {
  try {
    const current = await getCurrentCoords()
    const meters = distanceMeters(anchor, current)
    const setAtLabel = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(anchor.setAt)
    const movement =
      meters < STATIONARY_THRESHOLD_M
        ? "is still at the conversation's starting location"
        : `has moved ${formatDistance(meters)} from the conversation's starting location`
    return (
      `Geofence: user ${movement} (${anchorLabel(anchor)}, set at ${setAtLabel}). ` +
      `If the user asks you to reset or update the starting point, include the exact token ` +
      `${GEOFENCE_RESET_MARKER} anywhere in your reply — it will be silently stripped before ` +
      `they see it, and the app will make their current location the new starting point.`
    )
  } catch {
    return null
  }
}

export function stripGeofenceMarker(text: string): { cleaned: string; triggered: boolean } {
  if (!text.includes(GEOFENCE_RESET_MARKER)) return { cleaned: text, triggered: false }
  const cleaned = text.split(GEOFENCE_RESET_MARKER).join('').replace(/ {2,}/g, ' ').trim()
  return { cleaned, triggered: true }
}
