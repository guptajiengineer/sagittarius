import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * VirusTotal API v3 — domain reputation check.
 * Requires VIRUSTOTAL_API_KEY.
 */
export async function runVirusTotal(domain: string): Promise<ModuleResult> {
  const module = 'virustotal'
  const apiKey = process.env.VIRUSTOTAL_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    return { module, findings: [], error: 'VIRUSTOTAL_API_KEY not configured' }
  }

  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(15000),
    })

    if (res.status === 404) {
      return { module, findings: [{ module: 'virustotal', title: 'Domain Not Found in VirusTotal', description: 'No records for this domain.', severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null, recommendation: 'No action needed.', rawData: {} }] }
    }

    const data = await res.json()
    const stats = data?.data?.attributes?.last_analysis_stats || {}
    const malicious = stats.malicious || 0
    const suspicious = stats.suspicious || 0
    const findings: ModuleResult['findings'] = []

    if (malicious > 0) {
      findings.push({
        module: 'malware_detected',
        title: `VirusTotal: ${malicious} engines flagged as malicious`,
        description: `${malicious} out of ${(stats.harmless || 0) + malicious + suspicious + (stats.undetected || 0)} security engines flagged this domain as malicious.`,
        severity: malicious >= 3 ? 'critical' : 'high',
        dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'Investigate your website for malware. Run a full security scan and check for injected scripts.',
        rawData: { stats, malicious, suspicious },
      })
    } else if (suspicious > 0) {
      findings.push({
        module: 'virustotal', title: `VirusTotal: ${suspicious} engines flagged as suspicious`,
        description: `${suspicious} engines marked this domain as suspicious.`,
        severity: 'medium', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'Monitor your website. Some engines flagged suspicious activity.',
        rawData: { stats },
      })
    } else {
      findings.push({
        module: 'virustotal', title: 'VirusTotal: Clean',
        description: 'No security engines flagged this domain.',
        severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'No action needed.',
        rawData: { stats },
      })
    }

    return { module, findings }
  } catch (error) {
    return { module, findings: [], error: `VirusTotal failed: ${(error as Error).message}` }
  }
}
