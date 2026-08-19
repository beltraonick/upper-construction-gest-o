'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPendingPhotos, removePendingPhoto } from '@/lib/offline-photo-queue'

export function useOfflinePhotoSync(companyId: string | null) {
  const syncing = useRef(false)

  async function flushQueue() {
    if (syncing.current || !companyId || !navigator.onLine) return
    syncing.current = true
    try {
      const pending = await getPendingPhotos()
      if (pending.length === 0) return
      const supabase = createClient()
      for (const item of pending) {
        try {
          const file = new File([item.fileData], item.fileName, { type: item.fileType })
          const ext = item.fileName.split('.').pop() ?? 'jpg'
          const path = `tasks/${item.taskId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('task-photos')
            .upload(path, file, { upsert: false })
          if (!upErr) {
            await supabase.from('task_media').insert({
              task_id: item.taskId,
              company_id: item.companyId,
              storage_path: path,
              media_type: 'photo',
              photo_category: item.photoCategory,
            })
          }
          await removePendingPhoto(item.id)
        } catch {
          // Leave in queue to retry next time
        }
      }
    } finally {
      syncing.current = false
    }
  }

  useEffect(() => {
    window.addEventListener('online', flushQueue)

    // Listen for SW messages to trigger sync
    function handleSwMessage(e: MessageEvent) {
      if (e.data?.type === 'PROCESS_PHOTO_QUEUE') {
        flushQueue()
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    // Also try to flush on mount (in case we just came back online)
    flushQueue()

    return () => {
      window.removeEventListener('online', flushQueue)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])
}
