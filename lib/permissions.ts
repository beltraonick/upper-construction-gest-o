// Flexible permission toggles that can be granted to individual employees
// (e.g. to turn one into a "Supervisor") without a separate user role.
// Stored in profiles.permissions (jsonb). Add new keys here as new
// capabilities are built — no schema change needed.

export interface EmployeePermissions {
  checkin_team?: boolean
  delete_team_photos?: boolean
  create_extras?: boolean
  close_payroll?: boolean
}

export const PERMISSION_KEYS = [
  'checkin_team',
  'delete_team_photos',
  'create_extras',
  'close_payroll',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export function hasPermission(permissions: EmployeePermissions | null | undefined, key: PermissionKey): boolean {
  return permissions?.[key] === true
}

export function hasAnyPermission(permissions: EmployeePermissions | null | undefined): boolean {
  return PERMISSION_KEYS.some(key => hasPermission(permissions, key))
}
