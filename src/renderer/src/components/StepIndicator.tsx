import { cn } from '../lib/utils'

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            i === currentStep ? 'bg-brand-600 text-white' : i < currentStep ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'
          )}>
            <span className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
              i === currentStep ? 'bg-white/20' : i < currentStep ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
            )}>
              {i + 1}
            </span>
            {label}
          </div>
          {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200" />}
        </div>
      ))}
    </div>
  )
}
