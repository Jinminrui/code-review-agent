import { type LucideIcon, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IconProps extends LucideProps {
  icon: LucideIcon
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'
  spin?: boolean
  pulse?: boolean
}

const sizeClasses = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
}

const variantClasses = {
  default: 'text-text-secondary',
  muted: 'text-text-tertiary',
  accent: 'text-accent-cyan',
  success: 'text-accent-green',
  warning: 'text-accent-amber',
  danger: 'text-accent-red',
}

export function Icon({
  icon: IconComponent,
  size = 'md',
  variant = 'default',
  spin = false,
  pulse = false,
  className,
  ...props
}: IconProps) {
  return (
    <IconComponent
      className={cn(
        sizeClasses[size],
        variantClasses[variant],
        spin && 'animate-spin',
        pulse && 'animate-pulse',
        className
      )}
      {...props}
    />
  )
}
