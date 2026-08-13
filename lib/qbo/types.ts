export interface QBOEmployee {
  Id: string
  DisplayName: string
  Active: boolean
  PrimaryEmailAddr?: { Address: string }
}

export interface QBOTimeActivityPayload {
  NameOf: 'Employee'
  EmployeeRef: { value: string; name?: string }
  TxnDate: string        // YYYY-MM-DD
  StartTime?: string     // hh:mm:ssZ
  EndTime?: string       // hh:mm:ssZ
  Hours: number
  Minutes: number
  Description?: string
  BillableStatus: 'NotBillable'
}

export interface QBOConnection {
  id: string
  company_id: string
  realm_id: string
  access_token_enc: string
  refresh_token_enc: string
  token_expires_at: string
  connected_at: string
  connected_by: string | null
  is_active: boolean
}

export interface QBOEmployeeMap {
  id: string
  company_id: string
  profile_id: string
  qbo_employee_id: string
  qbo_employee_name: string | null
  mapped_at: string
}

export interface QBOSyncLog {
  id: string
  company_id: string
  time_entry_id: string | null
  qbo_time_activity_id: string | null
  status: 'pending' | 'success' | 'failed' | 'skipped'
  error_message: string | null
  attempted_at: string
  synced_at: string | null
}
