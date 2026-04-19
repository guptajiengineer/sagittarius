import type { ModuleResult } from '@sagittarius/shared-types'

/**
 * SecurityHeaders.com — checks HTTP security headers.
 * No API key needed.
 */
export async function runSecurityHeaders(url: string): Promise<ModuleResult> {
  const module = 'security-headers'
  try {
    const apiUrl = `https://securityheaders.com/?q=${encodeURIComponent(url)}&followRedirects=on`
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    })
    const headers = Object.fromEntries(res.headers.entries())
    const grade = headers['x-grade'] || 'Unknown'
    const findings: ModuleResult['findings'] = []

    // Check key security headers from the response headers
    const responseHeaders = headers
    const securityChecks = [
      { header: 'content-security-policy', finding: 'no_csp', title: 'Missing Content Security Policy', severity: 'high' as const, rec: 'Add a Content-Security-Policy header to prevent XSS attacks.' },
      { header: 'strict-transport-security', finding: 'missing_hsts', title: 'Missing HSTS Header', severity: 'high' as const, rec: 'Add Strict-Transport-Security header to enforce HTTPS connections.' },
      { header: 'x-frame-options', finding: 'missing_xframe', title: 'Missing X-Frame-Options', severity: 'medium' as const, rec: 'Add X-Frame-Options: DENY to prevent clickjacking attacks.' },
      { header: 'x-content-type-options', finding: 'missing_xcontent', title: 'Missing X-Content-Type-Options', severity: 'low' as const, rec: 'Add X-Content-Type-Options: nosniff header.' },
    ]

    // Also try to fetch the actual site headers
    try {
      const siteRes = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) })
      const siteHeaders = Object.fromEntries(siteRes.headers.entries())
      for (const check of securityChecks) {
        if (!siteHeaders[check.header]) {
          findings.push({
            module: check.finding,
            title: check.title,
            description: `Your website is missing the ${check.header} security header.`,
            severity: check.severity,
            dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
            recommendation: check.rec,
            rawData: { grade, missingHeader: check.header },
          })
        }
      }
    } catch {
      // Fallback: use grade-based assessment
      if (['D', 'E', 'F'].includes(grade.toUpperCase())) {
        findings.push({
          module: 'no_csp', title: 'Poor Security Headers',
          description: `SecurityHeaders.com rated your site: ${grade}. Multiple security headers are likely missing.`,
          severity: 'high', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
          recommendation: 'Add CSP, HSTS, X-Frame-Options, and X-Content-Type-Options headers.',
          rawData: { grade },
        })
      }
    }

    if (findings.length === 0) {
      findings.push({
        module: 'security-headers', title: 'Security Headers OK',
        description: `SecurityHeaders grade: ${grade}. Good header configuration.`,
        severity: 'info', dpdpSection: null, dpdpFineRange: null, dpdpImplication: null,
        recommendation: 'No action needed.',
        rawData: { grade },
      })
    }

    return { module, findings }
  } catch (error) {
    return { module, findings: [], error: `Security headers check failed: ${(error as Error).message}` }
  }
}
