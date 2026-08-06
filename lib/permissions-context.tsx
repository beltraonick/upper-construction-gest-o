'use client'

import { createContext, useContext } from 'react'
import type { EmployeePermissions } from './permissions'

const PermissionsContext = createContext<EmployeePermissions>({})

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: EmployeePermissions
  children: React.ReactNode
}) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>
}

// Reads the logged-in employee's permission toggles, set by the nearest
// layout from their profile row.
export function usePermissions(): EmployeePermissions {
  return useContext(PermissionsContext)
}
