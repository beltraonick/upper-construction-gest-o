'use client'

import { useState } from 'react'

// Falls back to a clean placeholder instead of a browser's broken-image
// icon + raw alt text when a storage object is missing (404) — which
// happens for photos uploaded during earlier testing that were never
// actually persisted to storage.
export function PhotoThumb({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-elevated text-tertiary ${className ?? ''}`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-1/3 h-1/3">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  )
}
