import type { Job } from 'bullmq'
import type { ScanJob } from '@sagittarius/shared-types'
import { updateScanStatus, createFindings, createScanReport } from '@sagittarius/db/src/helpers'
import { aggregateResults } from './aggregator'
import { generateReport } from './llm-reporter'
import { runSslLabs } from './modules/ssl-labs'
import { runSecurityHeaders } from './modules/security-headers'
import { runCrtSh } from './modules/crt-sh'
import { runGoogleSafeBrowsing } from './modules/google-safe-browsing'
import { runVirusTotal } from './modules/virustotal'
import { runHibp } from './modules/have-i-been-pwned'
import { runCloudflareRadar } from './modules/cloudflare-radar'
import { runUrlscan } from './modules/urlscan'
import { runMxtoolbox } from './modules/mxtoolbox'
import { runWhois } from './modules/whois'

/**
 * Main scan orchestration function.
 * Called by BullMQ worker for each scan job.
 * Runs all 10 scan modules in parallel, aggregates results, generates AI report.
 */
export async function orchestrateScan(job: Job<ScanJob>): Promise<void> {
  const { scanId, targetUrl, userId } = job.data
  const startTime = Date.now()

  console.log(`[orchestrator] Starting scan ${scanId} for ${targetUrl}`)

  try {
    // 1. Update status to running
    await updateScanStatus(scanId, 'running', { startedAt: new Date() })

    // 2. Extract domain from URL
    const domain = new URL(targetUrl).hostname

    // 3. Run all 10 modules in parallel
    console.log(`[orchestrator] Running 10 scan modules for ${domain}...`)
    const moduleResults = await Promise.all([
      runSslLabs(domain).catch(e => ({ module: 'ssl-labs', findings: [], error: String(e) })),
      runSecurityHeaders(targetUrl).catch(e => ({ module: 'security-headers', findings: [], error: String(e) })),
      runCrtSh(domain).catch(e => ({ module: 'crt-sh', findings: [], error: String(e) })),
      // Google Safe Browsing disabled — no API key configured
      // runGoogleSafeBrowsing(targetUrl).catch(e => ({ module: 'google-safe-browsing', findings: [], error: String(e) })),
      runVirusTotal(domain).catch(e => ({ module: 'virustotal', findings: [], error: String(e) })),
      runHibp(domain).catch(e => ({ module: 'hibp', findings: [], error: String(e) })),
      runCloudflareRadar(domain).catch(e => ({ module: 'cloudflare-radar', findings: [], error: String(e) })),
      runUrlscan(targetUrl).catch(e => ({ module: 'urlscan', findings: [], error: String(e) })),
      runMxtoolbox(domain).catch(e => ({ module: 'mxtoolbox', findings: [], error: String(e) })),
      runWhois(domain).catch(e => ({ module: 'whois', findings: [], error: String(e) })),
    ])

    console.log(`[orchestrator] All modules complete. Aggregating...`)

    // 4. Aggregate results and calculate score
    const { findings, score, errors } = aggregateResults(moduleResults)
    if (errors.length > 0) {
      console.log(`[orchestrator] Module errors: ${errors.join('; ')}`)
    }

    // 5. Bulk insert findings
    if (findings.length > 0) {
      await createFindings(scanId, findings.map(f => ({
        module: f.module,
        title: f.title,
        description: f.description,
        severity: f.severity,
        dpdpSection: f.dpdpSection,
        dpdpFineRange: f.dpdpFineRange,
        dpdpImplication: f.dpdpImplication,
        recommendation: f.recommendation,
        rawData: f.rawData,
      })))
      console.log(`[orchestrator] Inserted ${findings.length} findings`)
    }

    // 6. Generate AI report (non-blocking — scan completes even if this fails)
    const report = await generateReport(domain, score, findings)
    if (report) {
      await createScanReport(scanId, report.summary, report.model, report.inputTokens, report.outputTokens, report.costUsd)
      console.log(`[orchestrator] AI report generated`)
    }

    // 7. Update scan to complete
    const durationMs = Date.now() - startTime
    await updateScanStatus(scanId, 'complete', {
      score,
      completedAt: new Date(),
      durationMs,
    })

    console.log(`[orchestrator] Scan ${scanId} complete. Score: ${score}/100. Duration: ${durationMs}ms. Findings: ${findings.length}`)

  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error(`[orchestrator] Scan ${scanId} failed:`, error)
    await updateScanStatus(scanId, 'failed', {
      errorMessage: (error as Error).message,
      completedAt: new Date(),
      durationMs,
    }).catch(() => {}) // Don't let status update failure mask the real error
    throw error // Re-throw so BullMQ can retry
  }
}
