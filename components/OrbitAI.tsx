'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function OrbitSphere({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="12.5" fill="none" stroke="rgba(193,18,31,0.5)" strokeWidth="1" />
      <circle cx="14" cy="14" r="8.5" fill="none" stroke="rgba(193,18,31,0.75)" strokeWidth="1.25" />
      <circle cx="14" cy="14" r="4.5" fill="none" stroke="rgba(193,18,31,1)" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="1.5" fill="rgba(193,18,31,0.9)" />
    </svg>
  )
}

export function OrbitAI() {
  const pathname = usePathname()

  // Dashboard has its own embedded OrbitAIHub, and /admin/ai is the full
  // chat page itself — no floating button needed on either.
  if (pathname === '/admin/dashboard' || pathname === '/admin/ai') return null

  return (
    <Link
      href="/admin/ai"
      aria-label="Open OrbitOps AI"
      className="hidden md:flex fixed z-50 w-14 h-14 rounded-full items-center justify-center orbit-ai-btn md:right-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
    >
      <div className="transition-transform duration-300 hover:scale-110">
        <OrbitSphere size={36} />
      </div>
    </Link>
  )
}
