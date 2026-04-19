import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * crt.sh — Certificate Transparency log search.
 * Discovers subdomains. No API key needed.
 */
export async function runCrtSh(domain: string): Promise<ModuleResult> {
  const module = 'crt-sh'
  try {
    const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`, {
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      return { module, findings: [], error: `crt.sh returned ${res.status}` }
    }
    const data: Array<{ name_value: string; issuer_name: string }> = await res.json()

    // Deduplicate and filter subdomains
    const subdomains = [...new Set(
      data
        .flatMap(entry => entry.name_value.split('\n'))
        .map(s => s.trim().toLowerCase())
        .filter(s => s.endsWith(domain) && !s.startsWith('*.'))
    )].slice(0, 20)

    const findings: ModuleResult['findings'] = [{
      module: 'crt-sh',
      title: `Found ${subdomains.length} subdomains`,
      description: `Certificate Transparency logs reveal ${subdomains.length} subdomains for ${domain}.`,
      severity: 'info',
      dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
      recommendation: 'Review all subdomains to ensure they are intended and properly secured.',
      rawData: { subdomainCount: subdomains.length, subdomains: subdomains.slice(0, 10) },
    }]

    return { module, findings }
  } catch (error) {
    return { module, findings: [], error: `crt.sh check failed: ${(error as Error).message}` }
  }
}
