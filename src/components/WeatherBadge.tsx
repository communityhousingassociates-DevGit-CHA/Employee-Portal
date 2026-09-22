import type { WeatherNow } from '@/lib/weather'

export default function WeatherBadge({ weather }: { weather: WeatherNow | null }) {
  if (!weather) return null
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0" title={`${weather.shortForecast} · Baltimore, MD`}>
      <img src={weather.icon} alt={weather.shortForecast} className="w-6 h-6" />
      <span className="text-[13px] font-semibold text-white hidden sm:inline">{weather.tempF}°</span>
    </div>
  )
}
