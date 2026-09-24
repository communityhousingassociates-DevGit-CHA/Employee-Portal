import { rowTags, type TaggableRow } from '@/lib/timesheet-tags'

/** A timesheet day's tags as pills (see lib/timesheet-tags.ts). Renders a dash when the day has none. */
export default function RowTags({ row }: { row: TaggableRow }) {
  const tags = rowTags(row)
  if (tags.length === 0) return <span className="text-gray-300">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map(t => (
        <span key={t.key} title={t.title} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${t.cls}`}>{t.label}</span>
      ))}
    </span>
  )
}
