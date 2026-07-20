'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/lib/company-context'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'

const BUCKET = 'project-photos'

interface PhotoRecord {
  id: string
  project_id: string | null
  employee_id: string | null
  storage_path: string
  caption: string | null
  created_at: string
  url?: string
  project?: { name: string } | null
  profile?: { full_name: string } | null
}

interface Project { id: string; name: string }

export default function PhotosPage() {
  const companyId = useCompanyId()
  const [photos, setPhotos] = useState<PhotoRecord[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [projectFilter, setProjectFilter] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [{ data: projs }, { data: photoRows }] = await Promise.all([
      supabase.from('projects').select('id, name').eq('company_id', companyId).order('name'),
      supabase
        .from('project_photos')
        .select('id, project_id, employee_id, storage_path, caption, created_at, project:project_id(name), profile:employee_id(full_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    setProjects(projs ?? [])

    const rows = (photoRows ?? []) as unknown as PhotoRecord[]
    const withUrls = rows.map(r => {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(r.storage_path)
      return { ...r, url: data.publicUrl }
    })
    setPhotos(withUrls)
    setLoading(false)
  }, [companyId])

  useEffect(() => { load() }, [load])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const supabase = createClient()

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file)
      if (!uploadErr) {
        await supabase.from('project_photos').insert({
          company_id: companyId,
          project_id: selectedProject || null,
          storage_path: path,
        })
      }
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  async function deletePhoto(photo: PhotoRecord) {
    if (!window.confirm('Delete this photo?')) return
    const supabase = createClient()
    await Promise.all([
      supabase.storage.from(BUCKET).remove([photo.storage_path]),
      supabase.from('project_photos').delete().eq('id', photo.id),
    ])
    load()
  }

  const projectOptions = [
    { value: '', label: 'All projects' },
    ...projects.map(p => ({ value: p.id, label: p.name })),
  ]
  const uploadProjectOptions = [
    { value: '', label: 'No project' },
    ...projects.map(p => ({ value: p.id, label: p.name })),
  ]

  const filtered = projectFilter ? photos.filter(p => p.project_id === projectFilter) : photos

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Photos</h1>
          <p className="text-sm text-secondary mt-1">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-44">
            <Select
              options={uploadProjectOptions}
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
            />
          </div>
          <Button onClick={() => fileRef.current?.click()} loading={uploading}>
            + Upload Photos
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        </div>
      </div>

      <div className="mb-4 w-52">
        <Select
          options={projectOptions}
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-secondary text-center py-16">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-tertiary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <p className="text-sm font-medium text-secondary">No photos yet</p>
          <p className="text-xs text-tertiary">Upload photos from job sites to keep a visual record</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(photo => (
            <div key={photo.id} className="group relative aspect-square rounded-card overflow-hidden bg-surface-elevated">
              {photo.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={photo.caption ?? 'Project photo'}
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                  onClick={() => setLightbox(photo.url ?? null)}
                />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white/80 truncate">
                  {(photo.project as unknown as { name: string } | null)?.name ?? 'No project'}
                </p>
                <p className="text-[10px] text-white/60 truncate">
                  {new Date(photo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => deletePhoto(photo)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/80"
                title="Delete"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-card"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
