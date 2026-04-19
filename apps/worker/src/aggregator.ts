import type { ModuleResult, Finding } from '@sagittarius/shared-types'
import { mapToDpdp } from './dpdp-mapper'

export type NormalizedFinding = Omit<Finding, 'id' | 'scanId' | 'createdAt'>

/**
 * Merges all module results into a single findings array.
 * Calculates overall security score (0-100).
 * Applies DPDP mapping to each finding.
 */
export function aggregateResults(moduleResults: ModuleResult[]): {
  findings: NormalizedFinding[]
  score: number
  errors: string[]
} {
  const findings: NormalizedFinding[] = []
  const errors: string[] = []

  for (const result of moduleResults) {
    if (result.error) {
      errors.push(`[${result.module}] ${result.error}`)
    }
    for (const f of result.findings) {
      const dpdp = mapToDpdp(f.module)
      findings.push({
        ...f,
        dpdpSection: f.dpdpSection ?? dpdp.dpdpSection,
        dpdpFineRange: f.dpdpFineRange ?? dpdp.dpdpFineRange,
        dpdpImplication: f.dpdpImplication ?? dpdp.dpdpImplication,
      })
    }
  }

  // Score calculation
  let score = 100
  for (const f of findings) {
    switch (f.severity) {
      case 'critical': score -= 25; break
      case 'high':     score -= 15; break
      case 'medium':   score -= 8;  break
      case 'low':      score -= 3;  break
      // info: no penalty
    }
  }
  score = Math.max(0, Math.min(100, score))

  return { findings, score, errors }
}
