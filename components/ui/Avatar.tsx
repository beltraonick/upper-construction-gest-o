interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

function getColor(name: string) {
  const colors = [
    'bg-brand/20 text-brand',
    'bg-blue/20 text-blue',
    'bg-green/20 text-green',
    'bg-amber/20 text-amber',
    'bg-purple-500/20 text-purple-400',
  ]
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={['rounded-full object-cover flex-shrink-0', sizes[size], className].join(' ')}
      />
    )
  }
  return (
    <div
      className={[
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0',
        sizes[size],
        getColor(name),
        className,
      ].join(' ')}
    >
      {getInitials(name)}
    </div>
  )
}
