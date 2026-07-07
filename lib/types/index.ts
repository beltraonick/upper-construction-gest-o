export type UserRole = 'admin' | 'employee'
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type PayrollStatus = 'pending' | 'paid'
export type PhotoTag = 'before' | 'progress' | 'after'

export interface Company {
  id: string
  name: string
  logo_url: string | null
  language: string
  created_at: string
}

export interface Profile {
  id: string
  company_id: string
  role: UserRole
  full_name: string
  position: string | null
  hourly_rate: number
  avatar_url: string | null
  phone: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  email?: string
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
  assigned_employees?: Profile[]
  task_count?: number
  photo_count?: number
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
  assignee?: Profile
  project?: Project
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
  created_at: string
  employee?: Profile
  project?: Project
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
  employee?: Profile
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
  url?: string
  uploader?: Profile
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
  project?: Project
  generator?: Profile
}

export interface DashboardStats {
  employees_working_today: number
  hours_worked_today: number
  payroll_this_week: number
  projects_in_progress: number
  tasks_completed_today: number
}
