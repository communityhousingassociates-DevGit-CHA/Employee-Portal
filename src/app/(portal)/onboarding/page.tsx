export default function OnboardingPage() {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-[#e0f5f8] rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl">📋</div>
        <span className="text-[10px] uppercase tracking-widest font-bold text-[#02ACC0] bg-[#e0f5f8] px-3 py-1 rounded-full">Coming Soon</span>
        <h1 className="text-[22px] font-bold text-[#0b2b35] mt-4 mb-2">Onboarding Forms</h1>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
          Digital new hire packets — W-4, direct deposit, emergency contacts, handbook acknowledgment, and I-9 checklist.
          New hires will receive a link by email and complete all forms here with a digital signature.
        </p>
        <div className="bg-[#f8fcfd] border border-[#d4eef2] rounded-xl p-4 text-left space-y-2.5">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Planned Features</p>
          {[
            'Unique link sent to new hire personal email',
            'W-4, Direct Deposit, Emergency Contact, Handbook, I-9',
            'Digital signature on each form',
            'Completion tracking for HR and Accounting',
            'Completed packets accessible by employee, Accounting Manager, and CEO',
          ].map(f => (
            <div key={f} className="flex gap-2 text-[12px] text-gray-500">
              <span className="text-[#02ACC0] flex-shrink-0">›</span>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
