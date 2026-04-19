import type { NormalizedFinding } from './aggregator'

interface ReportResult {
  summary: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

/**
 * Generates a plain-English security report using Google Gemini.
 * Falls back gracefully if API is unavailable.
 */
export async function generateReport(
  domain: string,
  score: number,
  findings: NormalizedFinding[]
): Promise<ReportResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    console.log('[reporter] GEMINI_API_KEY not configured, skipping report generation')
    return null
  }

  const systemPrompt = `You are a cybersecurity advisor writing a report for an Indian small business owner who has no technical background. 
Write in plain, simple English. Avoid all technical jargon.
Explain what was found, why it matters to their business and customers, and what they should do first.
If any findings violate India's DPDP Act 2023, explain the legal risk in plain terms.
Your report should be 300-500 words. Start with the most important finding.
Do not mention tool names, API names, or technical terms like SSL, HSTS, CORS, etc.
Translate technical terms into business terms:
- "SSL expired" -> "your website's security certificate has expired, meaning customer data is no longer protected"
- "Missing HSTS" -> "customers can be tricked into visiting an insecure version of your website"
- "Missing CSP" -> "your website is vulnerable to attacks that could steal customer information"`

  const findingsSummary = findings
    .filter(f => f.severity !== 'info')
    .map(f => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}${f.dpdpSection ? ` (DPDP ${f.dpdpSection})` : ''}`)
    .join('\n')

  const userPrompt = `Domain: ${domain}
Security Score: ${score}/100

Findings:
${findingsSummary || 'No significant security issues found.'}

Write a plain-English security report for this business owner.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[reporter] Gemini API error:', res.status, errText)
      return null
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const usage = data.usageMetadata || {}
    const inputTokens = usage.promptTokenCount || 0
    const outputTokens = usage.candidatesTokenCount || 0
    // Gemini Flash pricing: $0.075/1M input, $0.30/1M output
    const costUsd = (inputTokens / 1_000_000 * 0.075) + (outputTokens / 1_000_000 * 0.30)

    console.log(`[reporter] Generated report: ${inputTokens} in, ${outputTokens} out, $${costUsd.toFixed(6)}`)

    return {
      summary: text,
      model: 'gemini-2.0-flash',
      inputTokens,
      outputTokens,
      costUsd,
    }
  } catch (error) {
    console.error('[reporter] Gemini report generation failed:', (error as Error).message)
    return null
  }
}
