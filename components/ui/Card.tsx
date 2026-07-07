import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({ padding = 'md', className = '', children, ...props }: CardProps) {
  return (
    <div
      className={[
        'bg-surface rounded-card border border-[rgba(255,255,255,0.07)]',
        paddings[padding],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}
