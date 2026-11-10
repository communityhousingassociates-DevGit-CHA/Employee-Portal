// Top-level app tabs in the header. The portal is the full employee app; Doorstep is the next app over.
// Doorstep is a separate app, so its tab is a plain link to a route that signs the employee in there.
// Same look as Doorstep's header: a bordered pill, a solid colour for the app you are in, white for the other.
// Each app keeps its own logo colour: the Employee Portal is the logo's purple (#705490), Doorstep the green.
export default function AppSwitcher() {
  const base = 'rounded-[6px] px-4 py-1 text-[13px] font-bold transition-colors'
  return (
    <nav aria-label="Apps" className="hidden sm:flex items-center gap-1 ml-1 rounded-lg border-2 border-white/70 bg-black/15 p-1">
      <span aria-current="page" className={`${base} bg-[#705490] text-white shadow`}>Employee Portal</span>
      <a href="/api/doorstep/launch" className={`${base} bg-white/90 text-[#017a38] hover:bg-white`}>Doorstep</a>
    </nav>
  )
}
