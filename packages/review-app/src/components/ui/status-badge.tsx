import { cn } from '@/lib/utils'
import { Icon } from './icon'
import { type LucideIcon, CheckCircle2, XCircle, AlertTriangle, Info, Loader2, Circle } from 'lucide-react'

export type Severity = 'high' | 'medium' | 'low'
export type Status = 'finished' | 'failed' | 'running' | 'pending' | 'idle' | 'streaming' | 'partial'

interface StatusBadgeProps {
  severity?: Severity
  status?: Status
  label: string
  className?: string
}

const severityConfig = {
  high: {
    background: 'bg-[rgba(248,81,73,0.1)]',
    text: 'text-accent-red',
    icon: AlertTriangle as LucideIcon,
  },
  medium: {
    background: 'bg-[rgba(210,153,34,0.1)]',
    text: 'text-accent-amber',
    icon: AlertTriangle as LucideIcon,
  },
  low: {
    background: 'bg-[rgba(110,118,129,0.1)]',
    text: 'text-text-tertiary',
    icon: Info as LucideIcon,
  },
}

const statusConfig = {
  finished: {
    background: 'bg-[rgba(63,185,80,0.1)]',
    text: 'text-accent-green',
    icon: CheckCircle2 as LucideIcon,
  },
  failed: {
    background: 'bg-[rgba(248,81,73,0.1)]',
    text: 'text-accent-red',
    icon: XCircle as LucideIcon,
  },
  running: {
    background: 'bg-[rgba(86,212,221,0.1)]',
    text: 'text-accent-cyan',
    icon: Loader2 as LucideIcon,
    spin: true,
  },
  pending: {
    background: 'bg-[rgba(110,118,129,0.1)]',
    text: 'text-text-disabled',
    icon: Circle as LucideIcon,
  },
  idle: {
    background: 'bg-[rgba(110,118,129,0.1)]',
    text: 'text-text-tertiary',
    icon: Circle as LucideIcon,
  },
  streaming: {
    background: 'bg-[rgba(86,212,221,0.1)]',
    text: 'text-accent-cyan',
    icon: Loader2 as LucideIcon,
    spin: true,
  },
  partial: {
    background: 'bg-[rgba(210,153,34,0.1)]',
    text: 'text-accent-amber',
    icon: AlertTriangle as LucideIcon,
  },
}

export function StatusBadge({ severity, status, label, className }: StatusBadgeProps) {
  const config = severity ? severityConfig[severity] : status ? statusConfig[status] : null

  if (!config) return null

  const shouldSpin = 'spin' in config && (config as { spin?: boolean }).spin === true

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-5 px-2 rounded font-mono text-[11px] font-medium tracking-wider uppercase',
        config.background,
        config.text,
        className
      )}
    >
      <Icon
        icon={config.icon}
        size="xs"
        className={cn(shouldSpin && 'icon-spin')}
      />
      {label}
    </span>
  )
}
