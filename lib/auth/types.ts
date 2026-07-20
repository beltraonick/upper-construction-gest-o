export type UserRole = 'admin' | 'employee' | 'client'
export type UserStatus = 'pending' | 'approved' | 'suspended'
export type Language = 'en' | 'pt' | 'es'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  status: UserStatus
  language: Language
  password_hash: string
  created_at: string
}

// Safe subset stored in session (no password)
export interface SessionUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: UserStatus
  language: Language
}
