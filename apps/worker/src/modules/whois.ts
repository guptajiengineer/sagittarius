import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * WhoisXML API — domain age, registrar, expiry.
 * Requires WHOIS_API_KEY.
 */
export async function runWhois(domain: string): Promise<ModuleResult> {
  const module = 'whois'
  const apiKey = process.env.WHOIS_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    return { module, findings: [], error: 'WHOIS_API_KEY not configured' }
  }

  try {
    const res = await fetch(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${encodeURIComponent(domain)}&outputFormat=JSON`,
      { signal: AbortSignal.timeout(15000) }
    )
    const data = await res.json()
    const whois = data.WhoisRecord || {}
    const findings: ModuleResult['findings'] = []

    // Check domain expiry
    const expiresDate = whois.registryData?.expiresDate || whois.expiresDate
    if (expiresDate) {
      const expiry = new Date(expiresDate)
      const daysUntilExpiry = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
        findings.push({
          module: 'whois', title: 'Domain Expiring Soon',
          description: `Your domain expires in ${daysUntilExpiry} days (${expiry.toISOString().split('T')[0]}).`,
          severity: 'medium', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'Renew your domain registration immediately.',
          rawData: { expiresDate, daysUntilExpiry },
        })
      }
    }

    // Check domain age
    const createdDate = whois.registryData?.createdDate || whois.createdDate
    if (createdDate) {
      const created = new Date(createdDate)
      const ageInDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))
      if (ageInDays < 30) {
        findings.push({
          module: 'whois', title: 'Very New Domain',
          description: `This domain is only ${ageInDays} days old. New domains have higher risk profiles.`,
          severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'Monitor your domain reputation as it builds trust.',
          rawData: { createdDate, ageInDays },
        })
      }
    }

    if (findings.length === 0) {
      findings.push({
        module: 'whois', title: 'Domain Registration OK',
        description: `Domain registered with ${whois.registrarName || 'unknown registrar'}. Expiry: ${expiresDate || 'unknown'}.`,
        severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'No action needed.',
        rawData: { registrar: whois.registrarName, created: createdDate, expires: expiresDate },
      })
    }

    return { module, findings }
  } catch (error) {
    return { module, findings: [], error: `Whois check failed: ${(error as Error).message}` }
  }
}
