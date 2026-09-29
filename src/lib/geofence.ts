// Sign-in geofence (per person). Uses the visitor's location as reported by Vercel's edge from their IP address
// (x-vercel-ip-country / x-vercel-ip-country-region). IP geolocation is approximate — VPNs, some mobile carriers and travel can
// land someone in the "wrong" state — so a temporary override exists. It limits where the PORTAL can be used from; it is not a
// substitute for a strong password and a second factor.

export type GeoCheck = { allowed: boolean; reason?: string }

export type GeofenceSettings = { enabled: boolean; regions: string[] }
export const DEFAULT_GEOFENCE: GeofenceSettings = { enabled: true, regions: ['MD', 'DC', 'VA', 'PA', 'DE'] }

/** Portal-wide rule from portal_settings.values; anything missing or invalid falls back to the default (Maryland region, on). */
export function resolveGeofenceSettings(values: Record<string, unknown> | null | undefined): GeofenceSettings {
  const enabled = typeof values?.geofence_enabled === 'boolean' ? values.geofence_enabled : DEFAULT_GEOFENCE.enabled
  const raw = values?.geofence_regions
  const regions = Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string').map(r => r.trim().toUpperCase()).filter(Boolean) : []
  return { enabled, regions: regions.length ? regions : DEFAULT_GEOFENCE.regions }
}

/** The state list that applies to one person: their own exception if they have one, else the portal-wide list (null = unrestricted). */
export function regionsFor(personRegions: string[] | null | undefined, global: GeofenceSettings): string[] | null {
  if (personRegions && personRegions.length > 0) return personRegions.includes('*') ? null : personRegions
  return global.enabled ? global.regions : null
}

export function checkGeofence(input: {
  regions: string[] | null | undefined
  overrideUntil: string | null | undefined
  country: string | null
  region: string | null
  production: boolean
  now?: number
}): GeoCheck {
  if (!input.regions || input.regions.length === 0) return { allowed: true }
  if (input.overrideUntil && Date.parse(input.overrideUntil) > (input.now ?? Date.now())) return { allowed: true, reason: 'travel override' }
  // Vercel always sets these in production; outside production (local dev) there is nothing to check against.
  if (!input.country && !input.region) return input.production ? { allowed: false, reason: 'location unknown' } : { allowed: true }
  if ((input.country ?? '').toUpperCase() !== 'US') return { allowed: false, reason: `outside the United States (${input.country ?? '?'})` }
  const allowed = input.regions.map(r => r.trim().toUpperCase())
  const region = (input.region ?? '').toUpperCase().replace(/^US-/, '') // tolerate an ISO 3166-2 prefix
  if (!allowed.includes(region)) return { allowed: false, reason: `region ${input.region ?? '?'} is not in ${allowed.join(', ')}` }
  return { allowed: true }
}

/** "md, dc VA" → ['MD','DC','VA']; blank → null (no restriction). */
export function parseRegions(text: string): string[] | null {
  const list = text.split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
  return list.length ? Array.from(new Set(list)) : null
}

