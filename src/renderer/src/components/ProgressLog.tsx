import type { InstallProgress } from '../../../main/printer-engine/types'

interface ProgressLogProps {
  progress: InstallProgress[]
  isInstalling: boolean
}

export default function ProgressLog({ progress, isInstalling }: ProgressLogProps) {
  return (
    <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
      {progress.length === 0 && !isInstalling && (
        <p className="text-gray-500">พร้อมติดตั้ง...</p>
      )}
      {progress.map((p, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-gray-500 shrink-0">[{p.component.toUpperCase()}]</span>
          <span className={p.percent === 100 ? 'text-green-400' : 'text-green-300'}>
            {p.message}
          </span>
        </div>
      ))}
      {isInstalling && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-300">กำลังดำเนินการ...</span>
        </div>
      )}
    </div>
  )
}
