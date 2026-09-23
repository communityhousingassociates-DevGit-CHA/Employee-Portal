import type { WeatherNow } from '@/lib/weather'

// NWS's raster icons render small and grainy at UI sizes, so map its
// shortForecast text to a crisp emoji instead — consistent with the emoji
// icons used everywhere else in the portal's nav (🏠 📋 🕐 ⏱ 📅 🧾).
function weatherEmoji(shortForecast: string, isDaytime: boolean): string {
  const f = shortForecast.toLowerCase()
  if (f.includes('thunder')) return '⛈️'
  if (f.includes('snow') || f.includes('flurries') || f.includes('sleet')) return '❄️'
  if (f.includes('rain') || f.includes('showers') || f.includes('drizzle')) return '🌧️'
  if (f.includes('fog') || f.includes('haze') || f.includes('mist')) return '🌫️'
  if (f.includes('wind')) return '💨'
  if (f.includes('mostly cloudy') || (f.includes('cloudy') && !f.includes('partly'))) return '☁️'
  if (f.includes('partly') || f.includes('few clouds')) return isDaytime ? '⛅' : '☁️'
  if (f.includes('clear') || f.includes('sunny')) return isDaytime ? '☀️' : '🌙'
  return isDaytime ? '🌤️' : '🌙'
}

export default function WeatherBadge({ weather }: { weather: WeatherNow | null }) {
  if (!weather) return null
  return (
    <div
      className="flex items-center gap-3 bg-[#f0f7f8] rounded-lg px-4 py-2.5 flex-shrink-0"
      title={`${weather.shortForecast} · Baltimore, MD`}
    >
      <span className="text-[26px] leading-none">{weatherEmoji(weather.shortForecast, weather.isDaytime)}</span>
      <div>
        <span className="text-[20px] font-black text-[#0b2b35] leading-none">{weather.tempF}°</span>
        <p className="text-[11px] text-gray-500 leading-none mt-1 hidden sm:block">{weather.shortForecast}</p>
      </div>
    </div>
  )
}
