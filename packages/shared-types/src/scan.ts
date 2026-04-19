export type ScanStatus = 'queued' | 'running' | 'complete' | 'failed'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Finding {
  id: string
  scanId: string
  module: string
  title: string
  description: string
  severity: Severity
  dpdpSection: string | null
  dpdpFineRange: string | null
  dpdpImplication: string | null
  recommendation: string
  rawData: Record<string, unknown>
  createdAt: Date
}

export interface ScanJob {
  scanId: string
  targetUrl: string
  userId: string
  enqueuedAt: string
}

export interface ModuleResult {
  module: string
  findings: Omit<Finding, 'id' | 'scanId' | 'createdAt'>[]
  error?: string
}
