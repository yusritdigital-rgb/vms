'use client'

import { createContext, useContext } from 'react'

export interface AdminContextType {
  selectedCompanyId: string | null
  selectedCompanyName: string
  setSelectedCompanyId: (id: string | null) => void
}

export const AdminContext = createContext<AdminContextType>({
  selectedCompanyId: null,
  selectedCompanyName: '',
  setSelectedCompanyId: () => {},
})

export function useAdminContext() {
  return useContext(AdminContext)
}
