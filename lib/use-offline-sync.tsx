'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { flushQueue, getQueue } from '@/lib/offline-queue'

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  const refreshCount = useCallback(async () => {
    try {
      const q = await getQueue()
      setPendingCount(q.length)
    } catch {
      // IndexedDB unavailable (e.g. private browsing) — nothing to show
    }
  }, [])

  const sync = useCallback(async () => {
    try {
      const supabase = createClient()
      await flushQueue(supabase)
    } finally {
      refreshCount()
    }
  }, [refreshCount])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCount()

    function handleOnline() {
      setIsOnline(true)
      sync()
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (navigator.onLine) sync()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync, refreshCount])

  return { isOnline, pendingCount, sync }
}
