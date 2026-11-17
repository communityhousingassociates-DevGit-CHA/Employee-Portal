// Line icons for the dashboard (replaces the emoji). All decorative: the label next to each one carries the meaning.
const PATHS: Record<string, React.ReactNode> = {
  leave: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M12 14v4M10 16h4" /></>,
  timesheet: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  expenses: <><path d="M4 4h16v16l-3-2-3 2-3-2-3 2-4-2z" /><path d="M8 9h8M8 13h6" /></>,
  calendar: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c1.8.8 3 2.6 3 5.6" /></>,
  approvals: <><path d="M9 12l2 2 4-4" /><rect x="3" y="4" width="18" height="16" rx="2" /></>,
}
export default function DxIcon({ name }: { name: keyof typeof PATHS | string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="dx-ico">{PATHS[name] ?? PATHS.leave}</svg>
}
// Soft tint behind each icon: the tile color an admin picked (Portal Settings), rendered as a light wash with the color as the glyph.
export function tint(hex: string) { return { backgroundColor: `${hex}1f`, color: hex } }
