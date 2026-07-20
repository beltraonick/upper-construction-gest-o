'use client'

import { createContext, useContext } from 'react'

const CompanyContext = createContext<string | null>(null)

export function CompanyProvider({ companyId, children }: { companyId: string; children: React.ReactNode }) {
  return <CompanyContext.Provider value={companyId}>{children}</CompanyContext.Provider>
}

// Reads the logged-in user's company_id, set by the nearest layout from
// their session. Every page that used to hardcode a single company id
// should read this instead, so multiple companies can use the app
// without seeing each other's data.
export function useCompanyId(): string {
  const companyId = useContext(CompanyContext)
  if (!companyId) throw new Error('useCompanyId() called outside a CompanyProvider')
  return companyId
}
