export type Role = 'admin' | 'employee'
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type PayrollStatus = 'pending' | 'paid'
export type PhotoTag = 'before' | 'progress' | 'after'
export type Language = 'en' | 'pt' | 'es'
export type ProfileStatus = 'active' | 'archived'

export interface Company {
  id: string
  name: string
  logo_url: string | null
  language: Language
  created_at: string
}

export interface Profile {
  id: string
  company_id: string
  role: Role
  full_name: string
  position: string | null
  hourly_rate: number
  avatar_url: string | null
  phone: string | null
  status: ProfileStatus
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  company_id: string
  name: string
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  address: string | null
  description: string | null
  progress: number
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string
  assigned_to: string | null
  title: string
  description: string | null
  status: TaskStatus
  progress: number
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  employee_id: string
  project_id: string | null
  company_id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number | null
  is_manual_entry: boolean
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface PayrollRecord {
  id: string
  employee_id: string
  company_id: string
  period_start: string
  period_end: string
  total_hours: number
  hourly_rate: number
  total_amount: number
  status: PayrollStatus
  paid_at: string | null
  notes: string | null
  created_at: string
}

export interface ProjectPhoto {
  id: string
  project_id: string
  company_id: string
  uploaded_by: string | null
  storage_path: string
  tag: PhotoTag
  caption: string | null
  taken_at: string | null
  created_at: string
}

export interface Report {
  id: string
  project_id: string
  company_id: string
  generated_by: string | null
  storage_path: string | null
  sent_to_email: string | null
  sent_at: string | null
  created_at: string
}
