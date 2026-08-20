'use client'

import { useEffect, useState } from 'react'

export function SplashScreen() {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out' | 'done'>('in')

  useEffect(() => {
    // Only show once per session
    if (sessionStorage.getItem('orbit-splash-shown')) {
      setPhase('done')
      return
    }
    sessionStorage.setItem('orbit-splash-shown', '1')

    const t1 = setTimeout(() => setPhase('hold'), 400)
    const t2 = setTimeout(() => setPhase('out'), 1300)
    const t3 = setTimeout(() => setPhase('done'), 1900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  if (phase === 'done') return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0A0A0C',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        transition: phase === 'out'
          ? 'opacity 0.55s cubic-bezier(0.4,0,0.2,1)'
          : 'none',
        opacity: phase === 'out' ? 0 : 1,
        pointerEvents: 'none',
      }}
    >
      {/* Logo */}
      <div
        style={{
          transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.18,0.64,1)',
          opacity: phase === 'in' ? 0 : 1,
          transform: phase === 'in' ? 'scale(0.82)' : 'scale(1)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.png"
          alt="OrbitOps"
          width={88}
          height={88}
          style={{
            borderRadius: 22,
            display: 'block',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 8px 48px rgba(193,18,31,0.22), 0 2px 16px rgba(0,0,0,0.6)',
          }}
        />
      </div>

      {/* Wordmark */}
      <p
        style={{
          fontFamily: "-apple-system, 'SF Pro Display', Inter, system-ui, sans-serif",
          fontSize: 15,
          fontWeight: 300,
          letterSpacing: '0.28em',
          color: 'rgba(245,245,247,0.55)',
          textTransform: 'uppercase',
          transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
          opacity: phase === 'in' ? 0 : 1,
          transform: phase === 'in' ? 'translateY(6px)' : 'translateY(0)',
          userSelect: 'none',
        }}
      >
        OrbitOps
      </p>
    </div>
  )
}
