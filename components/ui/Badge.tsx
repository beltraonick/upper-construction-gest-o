type BadgeVariant = 'default' | 'green' | 'amber' | 'red' | 'blue' | 'gray'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-elevated text-secondary border-[rgba(255,255,255,0.08)]',
  green: 'bg-green/10 text-green border-green/20',
  amber: 'bg-amber/10 text-amber border-amber/20',
  red: 'bg-danger/10 text-danger border-danger/20',
  blue: 'bg-blue/10 text-blue border-blue/20',
  gray: 'bg-surface-elevated text-tertiary border-[rgba(255,255,255,0.06)]',
}

export function Badge({ variant = 'default', className = '', children }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variants[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
