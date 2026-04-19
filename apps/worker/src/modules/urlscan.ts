import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * URLScan.io — submits URL for scan, polls for results.
 * Requires URLSCAN_API_KEY.
 */
export async function runUrlscan(url: string): Promise<ModuleResult> {
  const module = 'urlscan'
  const apiKey = process.env.URLSCAN_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    return { module, findings: [], error: 'URLSCAN_API_KEY not configured' }
  }

  try {
    // Submit scan
    const submitRes = await fetch('https://urlscan.io/api/v1/scan/', {
      method: 'POST',
      headers: { 'API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, visibility: 'public' }),
      signal: AbortSignal.timeout(15000),
    })

    if (!submitRes.ok) {
      const err = await submitRes.text()
      return { module, findings: [], error: `URLScan submit failed: ${submitRes.status} ${err}` }
    }

    const submitData = await submitRes.json()
    const resultUrl = submitData.api

    // Poll for results (max 60s, every 10s)
    await new Promise(r => setTimeout(r, 10000)) // Initial wait
    let resultData: Record<string, unknown> | null = null
    for (let i = 0; i < 5; i++) {
      try {
        const pollRes = await fetch(resultUrl, { signal: AbortSignal.timeout(10000) })
        if (pollRes.ok) {
          resultData = await pollRes.json()
          break
        }
      } catch { /* not ready yet */ }
      await new Promise(r => setTimeout(r, 10000))
    }

    if (!resultData) {
      return { module, findings: [{ module: 'urlscan', title: 'URLScan.io: Scan Submitted', description: 'Scan was submitted but results are not yet available.', severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null, recommendation: `Check results at: ${submitData.result}`, rawData: { resultUrl: submitData.result } }] }
    }

    const findings: ModuleResult['findings'] = []
    const verdicts = (resultData as any).verdicts?.overall || {}

    if (verdicts.malicious) {
      findings.push({
        module: 'malware_detected', title: 'URLScan.io: Malicious',
        description: 'URLScan.io has classified this URL as malicious.',
        severity: 'critical', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'Your website may be compromised. Investigate immediately.',
        rawData: { verdicts, screenshot: (resultData as any).task?.screenshotURL },
      })
    } else {
      findings.push({
        module: 'urlscan', title: 'URLScan.io: Clean',
        description: 'URLScan.io did not detect malicious content.',
        severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'No action needed.',
        rawData: { score: verdicts.score, screenshot: (resultData as any).task?.screenshotURL },
      })
    }

    return { module, findings }
  } catch (error) {
    return { module, findings: [], error: `URLScan failed: ${(error as Error).message}` }
  }
}
