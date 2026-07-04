export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <div>
        <h2 className="text-sm font-bold text-brand-800 leading-tight">VET MANAGE</h2>
        <p className="text-[10px] text-gray-400 leading-tight">Printer Driver</p>
      </div>
    </div>
  )
}
