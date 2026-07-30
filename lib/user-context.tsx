'use client'

import { createContext, useContext } from 'react'

interface CurrentUser {
  id: string
  name: string
}

const UserContext = createContext<CurrentUser | null>(null)

export function UserProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useCurrentUser(): CurrentUser {
  const user = useContext(UserContext)
  if (!user) throw new Error('useCurrentUser() called outside a UserProvider')
  return user
}
