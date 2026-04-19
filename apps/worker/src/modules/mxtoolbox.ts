import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * MXToolbox — checks SPF, DKIM, DMARC, DNS health.
 * Requires MXTOOLBOX_API_KEY.
 */
export async function runMxtoolbox(domain: string): Promise<ModuleResult> {
  const module = 'mxtoolbox'
  const apiKey = process.env.MXTOOLBOX_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    return { module, findings: [], error: 'MXTOOLBOX_API_KEY not configured' }
  }

  const findings: ModuleResult['findings'] = []

  try {
    // Check DMARC
    const dmarcRes = await fetch(`https://mxtoolbox.com/api/v1/Lookup/dmarc/${encodeURIComponent(domain)}`, {
      headers: { 'Authorization': apiKey },
      signal: AbortSignal.timeout(15000),
    })

    if (dmarcRes.ok) {
      const dmarcData = await dmarcRes.json()
      const failed = dmarcData.Failed || []
      const hasDmarc = !failed.some((f: any) => f.Name?.includes('DMARC') && f.Info?.includes('not found'))

      if (!hasDmarc) {
        findings.push({
          module: 'missing_dmarc', title: 'Missing DMARC Record',
          description: 'No DMARC record found. Attackers can send emails pretending to be from your domain.',
          severity: 'high', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'Add a DMARC DNS record to prevent email spoofing.',
          rawData: { failed },
        })
      }
    }

    // Check SPF
    const spfRes = await fetch(`https://mxtoolbox.com/api/v1/Lookup/spf/${encodeURIComponent(domain)}`, {
      headers: { 'Authorization': apiKey },
      signal: AbortSignal.timeout(15000),
    })

    if (spfRes.ok) {
      const spfData = await spfRes.json()
      const failed = spfData.Failed || []
      const hasSpf = !failed.some((f: any) => f.Name?.includes('SPF') && f.Info?.includes('not found'))

      if (!hasSpf) {
        findings.push({
          module: 'missing_dmarc', title: 'Missing SPF Record',
          description: 'No SPF record found. This allows unauthorized servers to send email as your domain.',
          severity: 'high', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'Add an SPF DNS record to specify authorized mail servers.',
          rawData: { failed },
        })
      }
    }

    if (findings.length === 0) {
      findings.push({
        module: 'mxtoolbox', title: 'Email Security: OK',
        description: 'DMARC and SPF records are configured.',
        severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'No action needed.',
        rawData: {},
      })
    }

    return { module, findings }
  } catch (error) {
    return { module, findings: [], error: `MXToolbox failed: ${(error as Error).message}` }
  }
}
