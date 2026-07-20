// IndexedDB-backed queue for writes made while offline. Each queued
// action is replayed against Supabase once connectivity returns.

const DB_NAME = 'orbitops-offline'
const STORE = 'queue'

export interface QueuedAction {
  id: string
  table: string
  type: 'insert' | 'update'
  match?: Record<string, string>
  payload: Record<string, unknown>
  createdAt: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueueAction(action: Omit<QueuedAction, 'id' | 'createdAt'>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put({
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  })
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueue(): Promise<QueuedAction[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as QueuedAction[])
    req.onerror = () => reject(req.error)
  })
}

async function removeAction(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(id)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// A network failure is exactly what should be retried later; a real
// data/validation error (bad payload, RLS denial, missing column)
// should not — queueing that would just retry-fail forever.
function looksLikeNetworkFailure(err: unknown): boolean {
  return !navigator.onLine || err instanceof TypeError
}

export async function queueIfOffline(
  action: Omit<QueuedAction, 'id' | 'createdAt'>,
  err: unknown
): Promise<boolean> {
  if (!looksLikeNetworkFailure(err)) return false
  await enqueueAction(action)
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function flushQueue(supabase: any): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue()
  let synced = 0
  let failed = 0
  for (const action of queue) {
    try {
      if (action.type === 'insert') {
        const { error } = await supabase.from(action.table).insert(action.payload)
        if (error) throw error
      } else {
        let query = supabase.from(action.table).update(action.payload)
        for (const [key, value] of Object.entries(action.match ?? {})) {
          query = query.eq(key, value)
        }
        const { error } = await query
        if (error) throw error
      }
      await removeAction(action.id)
      synced++
    } catch {
      failed++
    }
  }
  return { synced, failed }
}
