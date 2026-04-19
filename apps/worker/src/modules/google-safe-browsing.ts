import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * Google Safe Browsing API v4 — checks for malware/phishing.
 * Requires GOOGLE_SAFE_BROWSING_API_KEY.
 */
export async function runGoogleSafeBrowsing(url: string): Promise<ModuleResult> {
  const module = 'google-safe-browsing'
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    return { module, findings: [], error: 'GOOGLE_SAFE_BROWSING_API_KEY not configured' }
  }

  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'sagittarius', clientVersion: '1.0.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
        signal: AbortSignal.timeout(15000),
      }
    )

    const data = await res.json()
    const findings: ModuleResult['findings'] = []

    if (data.matches && data.matches.length > 0) {
      for (const match of data.matches) {
        const isMalware = match.threatType === 'MALWARE'
        findings.push({
          module: isMalware ? 'malware_detected' : 'malware_detected',
          title: isMalware ? 'Malware Detected' : `Threat Detected: ${match.threatType}`,
          description: `Google Safe Browsing flagged this URL as ${match.threatType.toLowerCase().replace(/_/g, ' ')}.`,
          severity: 'critical',
          dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'Investigate and remove any malicious content immediately. Consider a professional security audit.',
          rawData: { threatType: match.threatType, platformType: match.platformType },
        })
      }
    } else {
      findings.push({
        module: 'google-safe-browsing', title: 'No Threats Found',
        description: 'Google Safe Browsing did not flag this URL.',
        severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'No action needed.',
        rawData: { clean: true },
      })
    }

    return { module, findings }
  } catch (error) {
    return { module, findings: [], error: `Google Safe Browsing failed: ${(error as Error).message}` }
  }
}
