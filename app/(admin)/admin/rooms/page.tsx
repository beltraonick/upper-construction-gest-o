'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/lib/company-context'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface Project { id: string; name: string }
interface Room { id: string; floor: string | null; label: string; created_at: string }
interface TaskLite { id: string; room_id: string | null; status: string }

type RoomStatus = 'not_started' | 'in_progress' | 'completed'

function roomStatus(roomId: string, tasks: TaskLite[]): RoomStatus {
  const linked = tasks.filter(t => t.room_id === roomId)
  if (linked.length === 0) return 'not_started'
  if (linked.every(t => t.status === 'completed')) return 'completed'
  if (linked.some(t => t.status !== 'pending')) return 'in_progress'
  return 'not_started'
}

export default function RoomsPage() {
  const companyId = useCompanyId()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [tasks, setTasks] = useState<TaskLite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [single, setSingle] = useState({ floor: '', label: '' })
  const [bulk, setBulk] = useState({ floor: '', from: '', to: '' })

  const loadProjects = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('projects').select('id, name').eq('company_id', companyId).order('name')
    setProjects(data ?? [])
    if (data && data.length > 0 && !projectId) setProjectId(data[0].id)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const loadRooms = useCallback(async (pid: string) => {
    if (!pid) { setRooms([]); setTasks([]); return }
    const supabase = createClient()
    const [{ data: r }, { data: t }] = await Promise.all([
      supabase.from('project_rooms').select('id, floor, label, created_at').eq('project_id', pid).order('floor').order('label'),
      supabase.from('tasks').select('id, room_id, status').eq('project_id', pid),
    ])
    setRooms(r ?? [])
    setTasks((t ?? []) as TaskLite[])
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => { if (projectId) loadRooms(projectId) }, [projectId, loadRooms])

  async function addSingle(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !single.label.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('project_rooms').insert({
      project_id: projectId,
      company_id: companyId,
      floor: single.floor || null,
      label: single.label.trim(),
    })
    setSingle({ floor: '', label: '' })
    setSaving(false)
    loadRooms(projectId)
  }

  async function addBulk(e: React.FormEvent) {
    e.preventDefault()
    const from = Number(bulk.from)
    const to = Number(bulk.to)
    if (!projectId || !bulk.from || !bulk.to || from > to) return
    setSaving(true)
    const supabase = createClient()
    const rows = []
    for (let n = from; n <= to; n++) {
      rows.push({ project_id: projectId, company_id: companyId, floor: bulk.floor || null, label: String(n) })
    }
    await supabase.from('project_rooms').insert(rows)
    setBulk({ floor: '', from: '', to: '' })
    setSaving(false)
    setShowModal(false)
    loadRooms(projectId)
  }

  async function deleteRoom(id: string) {
    if (!window.confirm('Delete this room? Tasks linked to it will keep their area text but lose the room link.')) return
    const supabase = createClient()
    await supabase.from('project_rooms').delete().eq('id', id)
    loadRooms(projectId)
  }

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }))
  const doneCount = rooms.filter(r => roomStatus(r.id, tasks) === 'completed').length

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Rooms</h1>
          <p className="text-sm text-secondary mt-1">
            {rooms.length > 0 ? `${doneCount} of ${rooms.length} rooms done` : 'A room grid — no blueprint needed'}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} disabled={!projectId}>+ Add Rooms</Button>
      </div>

      <div className="mb-5 w-64">
        <Select
          label="Project"
          options={projectOptions}
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-secondary text-center py-16">Loading…</p>
      ) : projects.length === 0 ? (
        <Card><p className="text-sm text-secondary text-center py-10">Create a project first.</p></Card>
      ) : rooms.length === 0 ? (
        <Card>
          <p className="text-sm text-secondary text-center py-10">
            No rooms yet for this project. Click &ldquo;+ Add Rooms&rdquo; to set up the floor grid — e.g. Floor 3, rooms 301 to 320.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {rooms.map(r => {
            const status = roomStatus(r.id, tasks)
            const dot = status === 'completed' ? 'bg-green' : status === 'in_progress' ? 'bg-amber' : 'bg-[rgba(255,255,255,0.15)]'
            return (
              <Card key={r.id} padding="sm" className="relative group">
                <button
                  onClick={() => deleteRoom(r.id)}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-tertiary hover:text-danger transition-opacity"
                  title="Delete"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  <p className="text-sm font-semibold text-primary">{r.label}</p>
                  {r.floor && <p className="text-[10px] text-tertiary">{r.floor}</p>}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-surface rounded-card border border-[rgba(255,255,255,0.08)] w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-base font-semibold text-primary mb-4">Bulk generate rooms</h2>
                <form onSubmit={addBulk} className="space-y-3">
                  <Input
                    label="Floor label"
                    placeholder="e.g. Floor 3"
                    value={bulk.floor}
                    onChange={e => setBulk(f => ({ ...f, floor: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="From room #"
                      type="number"
                      placeholder="301"
                      required
                      value={bulk.from}
                      onChange={e => setBulk(f => ({ ...f, from: e.target.value }))}
                    />
                    <Input
                      label="To room #"
                      type="number"
                      placeholder="320"
                      required
                      value={bulk.to}
                      onChange={e => setBulk(f => ({ ...f, to: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" loading={saving} className="w-full">Generate</Button>
                </form>
              </div>

              <div className="pt-4 border-t border-[rgba(255,255,255,0.07)]">
                <h2 className="text-base font-semibold text-primary mb-4">Add a single room</h2>
                <form onSubmit={addSingle} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Floor"
                      placeholder="Optional"
                      value={single.floor}
                      onChange={e => setSingle(f => ({ ...f, floor: e.target.value }))}
                    />
                    <Input
                      label="Room label"
                      placeholder="e.g. Lobby"
                      required
                      value={single.label}
                      onChange={e => setSingle(f => ({ ...f, label: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" variant="secondary" loading={saving} className="w-full">Add Room</Button>
                </form>
              </div>

              <Button type="button" variant="ghost" onClick={() => setShowModal(false)} className="w-full">Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
