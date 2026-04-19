import { DPDP_RULES } from '@sagittarius/config'

/**
 * Maps a finding key to DPDP Act section, fine range, and implication.
 * Returns null fields if no DPDP mapping exists for this finding type.
 * Pure function — no side effects, no async.
 */
export function mapToDpdp(findingKey: string): {
  dpdpSection: string | null
  dpdpFineRange: string | null
  dpdpImplication: string | null
} {
  const rule = DPDP_RULES[findingKey]
  if (!rule) {
    return { dpdpSection: null, dpdpFineRange: null, dpdpImplication: null }
  }
  return {
    dpdpSection: rule.section,
    dpdpFineRange: rule.fineRange,
    dpdpImplication: rule.implication,
  }
}
