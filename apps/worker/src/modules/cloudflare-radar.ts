import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * Cloudflare Radar — domain categories and threat score.
 * Requires CLOUDFLARE_API_TOKEN.
 */
export async function runCloudflareRadar(domain: string): Promise<ModuleResult> {
  const module = 'cloudflare-radar'
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token || token === 'your_key_here') {
    return { module, findings: [], error: 'CLOUDFLARE_API_TOKEN not configured' }
  }

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/radar/domains/${encodeURIComponent(domain)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    const findings: ModuleResult['findings'] = []

    if (data.success && data.result) {
      const categories = data.result.categories || []
      const riskTypes = data.result.risk_types || []

      if (riskTypes.length > 0) {
        findings.push({
          module: 'cloudflare-radar', title: 'Risk Flags Detected',
          description: `Cloudflare Radar flagged risks: ${riskTypes.join(', ')}.`,
          severity: 'high', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'Investigate flagged risks and ensure your domain is not compromised.',
          rawData: { categories, riskTypes },
        })
      } else {
        findings.push({
          module: 'cloudflare-radar', title: 'Cloudflare Radar: Clean',
          description: `Domain categorized as: ${categories.join(', ') || 'uncategorized'}. No risk flags.`,
          severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'No action needed.',
          rawData: { categories },
        })
      }
    } else {
      findings.push({
        module: 'cloudflare-radar', title: 'Cloudflare Radar: No Data',
        description: 'No Cloudflare Radar data available for this domain.',
        severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'No action needed.',
        rawData: {},
      })
    }

    return { module, findings }
  } catch (error) {
    return { module, findings: [], error: `Cloudflare Radar failed: ${(error as Error).message}` }
  }
}
