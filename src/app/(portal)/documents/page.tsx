export default function DocumentsPage() {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-[#e0f5f8] rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl">📁</div>
        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Phase 2</span>
        <h1 className="text-[22px] font-bold text-[#0b2b35] mt-4 mb-2">Document Library</h1>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
          A central repository for HR policies, benefits guides, compliance notices, and onboarding templates.
          Documents will be organized by category and accessible based on role.
        </p>
        <div className="bg-[#f8fcfd] border border-[#d4eef2] rounded-xl p-4 text-left space-y-2.5">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Planned Categories</p>
          {[
            'HR Policies — Leave, Code of Conduct, Anti-Harassment',
            'Benefits & Compensation — Health, PTO, 401(k)',
            'Onboarding Templates — Handbook, W-4, I-9',
            'Compliance — FMLA, FLSA, ADA notices',
            'Admin uploads new documents; role-based access controls',
          ].map(f => (
            <div key={f} className="flex gap-2 text-[12px] text-gray-500">
              <span className="text-gray-300 flex-shrink-0">›</span>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
