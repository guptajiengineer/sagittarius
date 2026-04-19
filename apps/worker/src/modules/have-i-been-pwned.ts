import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * HaveIBeenPwned — checks if domain appears in breach databases.
 * Basic domain search doesn't require API key.
 */
export async function runHibp(domain: string): Promise<ModuleResult> {
  const module = 'hibp'
  try {
    const res = await fetch(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`, {
      headers: {
        'User-Agent': 'Sagittarius-Security-Scanner',
        ...(process.env.HIBP_API_KEY ? { 'hibp-api-key': process.env.HIBP_API_KEY } : {}),
      },
      signal: AbortSignal.timeout(15000),
    })

    if (res.status === 404 || res.status === 403) {
      // Try the public breaches endpoint as fallback
      const fallbackRes = await fetch('https://haveibeenpwned.com/api/v3/breaches', {
        headers: { 'User-Agent': 'Sagittarius-Security-Scanner' },
        signal: AbortSignal.timeout(15000),
      })
      if (!fallbackRes.ok) {
        return { module, findings: [{ module: 'hibp', title: 'No Breach Data Available', description: 'Could not check breach databases.', severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null, recommendation: 'Manually check haveibeenpwned.com.', rawData: {} }] }
      }
      const allBreaches: Array<{ Domain: string; Name: string; BreachDate: string; DataClasses: string[] }> = await fallbackRes.json()
      const domainBreaches = allBreaches.filter(b => b.Domain.toLowerCase() === domain.toLowerCase())

      if (domainBreaches.length > 0) {
        return {
          module,
          findings: domainBreaches.map(b => ({
            module: 'domain_in_breach',
            title: `Data Breach: ${b.Name}`,
            description: `Your domain was involved in the ${b.Name} breach (${b.BreachDate}). Exposed data: ${b.DataClasses.join(', ')}.`,
            severity: 'high' as const,
            dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
            recommendation: 'Notify affected users, reset credentials, and review your security practices.',
            rawData: { breachName: b.Name, breachDate: b.BreachDate, dataClasses: b.DataClasses },
          })),
        }
      }

      return { module, findings: [{ module: 'hibp', title: 'No Known Breaches', description: 'Domain not found in known breach databases.', severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null, recommendation: 'No action needed. Continue monitoring.', rawData: { clean: true } }] }
    }

    const breaches: Array<{ Name: string; BreachDate: string; DataClasses: string[] }> = await res.json()
    if (!breaches || breaches.length === 0) {
      return { module, findings: [{ module: 'hibp', title: 'No Known Breaches', description: 'Domain not found in breach databases.', severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null, recommendation: 'No action needed.', rawData: { clean: true } }] }
    }

    return {
      module,
      findings: breaches.slice(0, 5).map(b => ({
        module: 'domain_in_breach',
        title: `Data Breach: ${b.Name}`,
        description: `Breach on ${b.BreachDate}. Exposed: ${b.DataClasses.join(', ')}.`,
        severity: 'high' as const,
        dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'Notify affected users and reset credentials.',
        rawData: { breachName: b.Name, breachDate: b.BreachDate },
      })),
    }
  } catch (error) {
    return { module, findings: [], error: `HIBP check failed: ${(error as Error).message}` }
  }
}
