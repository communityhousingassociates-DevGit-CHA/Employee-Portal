// Small Dashboard convenience widget — current conditions for CHA's service
// area (Baltimore, MD). Uses the National Weather Service API: free, no key
// or account required, so there's no provider/provisioning decision here.
// Grid point for 39.2904,-76.6122 looked up once; NWS grid points are fixed
// for a given lat/lon, so this avoids a second network hop on every request.
const FORECAST_URL = 'https://api.weather.gov/gridpoints/LWX/109,91/forecast'
const USER_AGENT = 'CHA Employee Portal (support@communityhousingassociates.org)'

export type WeatherNow = {
  tempF: number
  shortForecast: string
  icon: string
  isDaytime: boolean
}

export async function getBaltimoreWeather(): Promise<WeatherNow | null> {
  try {
    const res = await fetch(FORECAST_URL, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      next: { revalidate: 1800 }, // NWS updates roughly hourly — 30 min is plenty fresh
    })
    if (!res.ok) return null
    const data = await res.json()
    const period = data?.properties?.periods?.[0]
    if (!period) return null
    return {
      tempF: period.temperature,
      shortForecast: period.shortForecast,
      icon: period.icon,
      isDaytime: period.isDaytime,
    }
  } catch {
    return null // weather is a nice-to-have — never break the Dashboard over it
  }
}
