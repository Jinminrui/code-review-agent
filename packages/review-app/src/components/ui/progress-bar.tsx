import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
}

export function ProgressBar({ value, max = 100, className }: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      className={cn(
        'h-1.5 bg-bg-overlay rounded-full overflow-hidden',
        className
      )}
    >
      <div
        className="h-full rounded-full transition-all duration-300 ease-out animate-glow"
        style={{
          width: `${percentage}%`,
          background: 'linear-gradient(90deg, var(--accent-cyan-muted), var(--accent-cyan))',
        }}
      />
    </div>
  )
}
