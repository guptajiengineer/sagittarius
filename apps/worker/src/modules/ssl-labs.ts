import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * SSL Labs API — checks SSL/TLS strength, expiry, grade.
 * No API key needed. Async polling API.
 */
export async function runSslLabs(domain: string): Promise<ModuleResult> {
  const module = 'ssl-labs'
  try {
    const analyzeUrl = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(domain)}&publish=off&startNew=on&all=done`
    let res = await fetch(analyzeUrl)
    let data = await res.json()

    // Poll until ready (max 90s, every 10s)
    const maxAttempts = 9
    for (let i = 0; i < maxAttempts && data.status !== 'READY' && data.status !== 'ERROR'; i++) {
      await new Promise(r => setTimeout(r, 10000))
      const pollUrl = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(domain)}&all=done`
      res = await fetch(pollUrl)
      data = await res.json()
    }

    if (data.status === 'ERROR' || data.status !== 'READY') {
      return { module, findings: [], error: `SSL Labs returned status: ${data.status}` }
    }

    const findings: ModuleResult['findings'] = []
    const endpoints = data.endpoints || []
    for (const ep of endpoints) {
      const grade = ep.grade || 'Unknown'
      if (grade === 'F' || grade === 'T') {
        findings.push({
          module: 'ssl_expired',
          title: 'SSL Certificate Issue',
          description: `SSL Labs gave your site a grade of ${grade}. Your certificate may be expired or invalid.`,
          severity: 'critical',
          dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'Renew your SSL certificate immediately and ensure it is properly configured.',
          rawData: { grade, ipAddress: ep.ipAddress },
        })
      } else if (['C', 'D', 'E'].includes(grade)) {
        findings.push({
          module: 'ssl_weak',
          title: 'Weak SSL/TLS Configuration',
          description: `SSL Labs grade: ${grade}. Your SSL configuration has weaknesses.`,
          severity: 'high',
          dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'Upgrade to TLS 1.2+ and disable weak cipher suites.',
          rawData: { grade, ipAddress: ep.ipAddress },
        })
      }

      // Check certificate expiry
      if (ep.details?.cert?.notAfter) {
        const expiryDate = new Date(ep.details.cert.notAfter)
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysUntilExpiry < 0) {
          findings.push({
            module: 'ssl_expired', title: 'SSL Certificate Expired',
            description: `Your SSL certificate expired ${Math.abs(daysUntilExpiry)} days ago.`,
            severity: 'critical', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
            recommendation: 'Renew your SSL certificate immediately.',
            rawData: { expiryDate: expiryDate.toISOString(), daysUntilExpiry },
          })
        } else if (daysUntilExpiry < 30) {
          findings.push({
            module: 'ssl_weak', title: 'SSL Certificate Expiring Soon',
            description: `Your SSL certificate expires in ${daysUntilExpiry} days.`,
            severity: 'medium', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
            recommendation: 'Renew your SSL certificate before it expires.',
            rawData: { expiryDate: expiryDate.toISOString(), daysUntilExpiry },
          })
        }
      }
    }

    if (findings.length === 0) {
      findings.push({
        module: 'ssl-labs', title: 'SSL Configuration OK',
        description: `SSL Labs grade: ${endpoints[0]?.grade || 'A'}. Good SSL configuration.`,
        severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'No action needed. Continue monitoring.',
        rawData: { grade: endpoints[0]?.grade },
      })
    }

    return { module, findings }
  } catch (error) {
    return { module, findings: [], error: `SSL Labs check failed: ${(error as Error).message}` }
  }
}
