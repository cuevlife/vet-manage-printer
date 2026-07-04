import { ReactNode } from 'react'
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { cn } from '../lib/utils'

type Status = 'ok' | 'warning' | 'error' | 'loading' | 'idle'

interface StatusCardProps {
  title: string
  subtitle?: string
  status: Status
  actions?: ReactNode
  details?: string[]
}

const statusConfig = {
  ok: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  warning: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  loading: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  idle: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200' },
}

export default function StatusCard({ title, subtitle, status, actions, details }: StatusCardProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Card className={cn('border-2', config.bg)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={cn('mt-0.5 shrink-0', config.color, status === 'loading' && 'animate-spin')} size={20} />
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm">{title}</h4>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            {details && details.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {details.map((d, i) => (
                  <li key={i} className="text-xs text-gray-600 truncate">{d}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/50">
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export type { Status }
