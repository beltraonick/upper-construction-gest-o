'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/lib/theme-context'

interface ThemeToggleProps {
  className?: string
  /** 'icon' = compact icon button (header); 'nav' = vertical icon+label (bottom nav); 'sidebar' = horizontal icon+label (desktop sidebar) */
  layout?: 'icon' | 'nav' | 'sidebar'
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  )
}

export function ThemeToggle({ className = '', layout = 'icon' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && theme === 'dark'
  const icon = mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <span className="w-[18px] h-[18px] block" />
  const label = mounted ? (isDark ? 'Light' : 'Dark') : ''

  if (layout === 'nav') {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={[
          'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-tertiary hover:text-secondary transition-colors duration-150',
          className,
        ].join(' ')}
      >
        <span className="text-tertiary">{icon}</span>
        {label}
      </button>
    )
  }

  if (layout === 'sidebar') {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium text-secondary hover:text-primary hover:bg-surface-elevated transition-colors duration-150',
          className,
        ].join(' ')}
      >
        <span className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center text-tertiary">{icon}</span>
        {isDark ? 'Light mode' : 'Dark mode'}
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={[
        'p-2 rounded-button text-secondary hover:text-primary hover:bg-surface-elevated transition-colors duration-150 flex-shrink-0',
        className,
      ].join(' ')}
    >
      {icon}
    </button>
  )
}
