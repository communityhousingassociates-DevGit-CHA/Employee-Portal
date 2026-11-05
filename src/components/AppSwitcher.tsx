// Top-level app tabs in the header. The portal is the full employee app; Doorstep is the next app over.
// Doorstep is a separate app, so its tab is a plain link to a route that signs the employee in there.
export default function AppSwitcher() {
  const base = 'px-3 py-1.5 rounded-md text-[12px] font-semibold tracking-wide transition-colors'
  return (
    <nav aria-label="Apps" className="hidden sm:flex items-center gap-1 ml-1 pl-3 border-l border-white/20">
      <span aria-current="page" className={`${base} bg-white/15 text-white`}>Employee Portal</span>
      <a href="/api/doorstep/launch" className={`${base} text-white/60 hover:text-white hover:bg-white/10`}>Doorstep</a>
    </nav>
  )
}
