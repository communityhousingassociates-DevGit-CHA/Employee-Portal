'use client'

export default function ExportPdfButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors flex items-center gap-2 print:hidden"
    >
      ⬇ Export PDF
    </button>
  )
}
