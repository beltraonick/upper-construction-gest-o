'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface ClockButtonsProps {
  employeeId: string
  openEntryId: string | null
  clockInTime: string | null
}

function formatElapsed(clockInISO: string) {
  const diff = Math.floor((Date.now() - new Date(clockInISO).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ClockButtons({ employeeId, openEntryId, clockInTime }: ClockButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!clockInTime) return
    const tick = () => setElapsed(formatElapsed(clockInTime))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [clockInTime])

  async function clockIn() {
    setLoading(true)
    const supabase = createClient()
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', employeeId).single()
    await supabase.from('time_entries').insert({
      employee_id: employeeId,
      company_id: profile?.company_id,
      clock_in: new Date().toISOString(),
    })
    router.refresh()
    setLoading(false)
  }

  async function clockOut() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('time_entries').update({ clock_out: new Date().toISOString() }).eq('id', openEntryId)
    router.refresh()
    setLoading(false)
  }

  if (clockInTime) {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          <span className="text-sm text-green font-medium">Clocked In</span>
        </div>
        <p className="text-4xl font-bold text-primary tracking-widest font-mono">{elapsed}</p>
        <p className="text-xs text-secondary">
          Since {new Date(clockInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <Button variant="danger" size="lg" onClick={clockOut} loading={loading} className="w-full mt-1">
          Clock Out
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <p className="text-sm text-secondary">You are not clocked in</p>
      <Button size="lg" onClick={clockIn} loading={loading} className="w-full">
        Clock In
      </Button>
    </div>
  )
}
