import type { WeatherNow } from '@/lib/weather'

export default function WeatherBadge({ weather }: { weather: WeatherNow | null }) {
  if (!weather) return null
  return (
    <div
      className="flex items-center gap-2 bg-white border border-[#d4eef2] rounded-lg px-3 py-2 flex-shrink-0"
      title={`${weather.shortForecast} · Baltimore, MD`}
    >
      <img src={weather.icon} alt={weather.shortForecast} className="w-7 h-7" />
      <div>
        <span className="text-[15px] font-bold text-[#0b2b35] leading-none">{weather.tempF}°</span>
        <p className="text-[10px] text-gray-400 leading-none mt-0.5 hidden sm:block">{weather.shortForecast}</p>
      </div>
    </div>
  )
}
