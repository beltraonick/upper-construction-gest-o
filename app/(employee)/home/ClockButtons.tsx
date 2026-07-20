'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { queueIfOffline } from '@/lib/offline-queue'
import { Button } from '@/components/ui/Button'

interface ClockButtonsProps {
  employeeId: string
  companyId: string
  openEntryId: string | null
  clockInTime: string | null
}

function formatElapsed(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function getLocation() {
  return new Promise<{ latitude: number; longitude: number; city: string; state: string } | null>(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en-US' } }
          )
          const data = await res.json()
          const addr = data.address ?? {}
          const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? ''
          const state = addr.state ?? ''
          resolve({ latitude, longitude, city, state })
        } catch {
          resolve({ latitude, longitude, city: '', state: '' })
        }
      },
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true }
    )
  })
}

export function ClockButtons({ employeeId, companyId, openEntryId, clockInTime }: ClockButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState('')
  const [locationInfo, setLocationInfo] = useState('')

  // Optimistic local state — lets clock in/out work instantly even
  // offline, without waiting on (or depending on) a server round-trip.
  const [clockedIn, setClockedIn] = useState(!!clockInTime)
  const [localClockInTime, setLocalClockInTime] = useState(clockInTime)
  const [localEntryId, setLocalEntryId] = useState(openEntryId)

  useEffect(() => {
    if (!localClockInTime) return
    const tick = () => setElapsed(formatElapsed(localClockInTime))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [localClockInTime])

  async function clockIn() {
    setLoading(true)
    setLocationInfo('Getting location…')

    const loc = await getLocation()
    setLocationInfo(loc?.city ? `${loc.city}, ${loc.state}` : '')

    const entryId = newId()
    const clockInIso = new Date().toISOString()
    const payload = {
      id: entryId,
      employee_id: employeeId,
      company_id: companyId,
      clock_in: clockInIso,
      ...(loc && {
        latitude: loc.latitude,
        longitude: loc.longitude,
        city: loc.city,
        state: loc.state,
      }),
    }

    // Optimistic: reflect clocked-in state immediately, regardless of network.
    setClockedIn(true)
    setLocalClockInTime(clockInIso)
    setLocalEntryId(entryId)

    try {
      const supabase = createClient()
      const { error } = await supabase.from('time_entries').insert(payload)
      if (error) throw error
    } catch (err) {
      await queueIfOffline({ table: 'time_entries', type: 'insert', payload }, err)
    }

    router.refresh()
    setLoading(false)
    setLocationInfo('')
  }

  async function clockOut() {
    if (!localEntryId) return
    setLoading(true)
    const payload = { clock_out: new Date().toISOString() }

    setClockedIn(false)
    setLocalClockInTime(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.from('time_entries').update(payload).eq('id', localEntryId)
      if (error) throw error
    } catch (err) {
      await queueIfOffline({ table: 'time_entries', type: 'update', match: { id: localEntryId }, payload }, err)
    }

    setLocalEntryId(null)
    router.refresh()
    setLoading(false)
  }

  if (clockedIn) {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          <span className="text-sm text-green font-medium">Clocked In</span>
        </div>
        <p className="text-4xl font-bold text-primary tracking-widest font-mono">{elapsed}</p>
        {localClockInTime && (
          <p className="text-xs text-secondary">
            Since {new Date(localClockInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        <Button variant="danger" size="lg" onClick={clockOut} loading={loading} className="w-full mt-1">
          Clock Out
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <p className="text-sm text-secondary">You are not clocked in</p>
      {locationInfo && (
        <p className="text-xs text-secondary flex items-center gap-1.5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-brand">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          {locationInfo}
        </p>
      )}
      <Button size="lg" onClick={clockIn} loading={loading} className="w-full">
        Clock In
      </Button>
    </div>
  )
}
