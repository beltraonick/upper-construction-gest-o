interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  color?: 'red' | 'green' | 'blue' | 'amber'
}

const colors = {
  red: 'bg-brand',
  green: 'bg-green',
  blue: 'bg-blue',
  amber: 'bg-amber',
}

export function ProgressBar({ value, max = 100, color = 'red', className = '' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={['h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden', className].join(' ')}>
      <div
        className={['h-full rounded-full transition-all duration-500', colors[color]].join(' ')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
