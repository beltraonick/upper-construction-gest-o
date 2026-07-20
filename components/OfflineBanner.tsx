'use client'

import { useOfflineSync } from '@/lib/use-offline-sync'

export function OfflineBanner() {
  const { isOnline, pendingCount } = useOfflineSync()

  if (isOnline && pendingCount === 0) return null

  return (
    <div
      className={[
        'fixed top-0 inset-x-0 z-[60] text-center text-xs font-medium py-1.5 safe-top',
        isOnline ? 'bg-amber text-black' : 'bg-danger text-white',
      ].join(' ')}
    >
      {!isOnline
        ? "You're offline — changes will save and sync automatically"
        : `Syncing ${pendingCount} change${pendingCount !== 1 ? 's' : ''}…`}
    </div>
  )
}
