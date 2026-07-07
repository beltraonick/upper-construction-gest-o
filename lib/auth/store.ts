import type { AuthUser, Language, SessionUser } from './types'
import { hashPassword, generateId } from './crypto'

// ─── Seed accounts (always available, resets never remove these) ──────────────
const SEED_USERS: AuthUser[] = [
  {
    id: 'seed-admin-001',
    email: 'admin@upperconstruction.com',
    full_name: 'Tiago (Admin)',
    phone: null,
    role: 'admin',
    status: 'approved',
    language: 'en',
    password_hash: hashPassword('Admin123!'),
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-employee-001',
    email: 'employee@upperconstruction.com',
    full_name: 'Test Employee',
    phone: null,
    role: 'employee',
    status: 'approved',
    language: 'en',
    password_hash: hashPassword('Employee123!'),
    created_at: '2024-01-01T00:00:00.000Z',
  },
]

// ─── In-memory store (seed users survive restarts; new registrations until restart) ─
const users = new Map<string, AuthUser>(SEED_USERS.map(u => [u.id, u]))
const emailIndex = new Map<string, string>(SEED_USERS.map(u => [u.email.toLowerCase(), u.id]))

// ─── Public API ───────────────────────────────────────────────────────────────
export function findUserByEmail(email: string): AuthUser | null {
  const id = emailIndex.get(email.toLowerCase())
  return id ? (users.get(id) ?? null) : null
}

export function findUserById(id: string): AuthUser | null {
  return users.get(id) ?? null
}

export function getAllUsers(): AuthUser[] {
  return Array.from(users.values())
}

export function getPendingUsers(): AuthUser[] {
  return Array.from(users.values()).filter(u => u.status === 'pending')
}

export function createUser(data: {
  email: string
  full_name: string
  phone: string | null
  password_hash: string
  language: Language
}): AuthUser {
  const user: AuthUser = {
    id: generateId(),
    ...data,
    role: 'employee',
    status: 'pending',
    created_at: new Date().toISOString(),
  }
  users.set(user.id, user)
  emailIndex.set(data.email.toLowerCase(), user.id)
  return user
}

export function approveUser(id: string): boolean {
  const user = users.get(id)
  if (!user) return false
  users.set(id, { ...user, status: 'approved' })
  return true
}

export function suspendUser(id: string): boolean {
  const user = users.get(id)
  if (!user) return false
  users.set(id, { ...user, status: 'suspended' })
  return true
}

export function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    status: user.status,
    language: user.language,
  }
}
