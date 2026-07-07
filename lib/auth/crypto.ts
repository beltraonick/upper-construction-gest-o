import { createHash, randomBytes } from 'crypto'

const SALT = 'upper_construction_2024'

export function hashPassword(password: string): string {
  return createHash('sha256').update(SALT + password).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export function generateId(): string {
  return randomBytes(16).toString('hex')
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}
