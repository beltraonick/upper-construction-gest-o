'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Overview', href: '/client' },
  { label: 'Change Orders', href: '/client/change-orders' },
]

export function ClientNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 px-4 border-b border-[rgba(255,255,255,0.07)] bg-surface">
      {TABS.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              'px-3 py-3 text-sm font-medium border-b-2 transition-colors duration-150',
              active
                ? 'border-brand text-primary'
                : 'border-transparent text-secondary hover:text-primary',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
