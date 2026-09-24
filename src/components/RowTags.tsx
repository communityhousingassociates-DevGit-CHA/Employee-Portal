import type { RowTag } from '@/lib/timesheet-tags'

/** Renders a list of tags (see lib/timesheet-tags.ts) as pills; a dash when there are none. */
export default function RowTags({ tags, dashWhenEmpty = true }: { tags: RowTag[]; dashWhenEmpty?: boolean }) {
  if (tags.length === 0) return dashWhenEmpty ? <span className="text-gray-300">—</span> : null
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map(t => (
        <span key={t.key} title={t.title} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${t.cls}`}>{t.label}</span>
      ))}
    </span>
  )
}
