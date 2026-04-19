import { NextResponse } from 'next/server'
import { db } from '@sagittarius/db'

/**
 * GET /api/v1/scans/[id] — Get full scan results with findings and report
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const scan = await db.scan.findUnique({
      where: { id: params.id },
      include: {
        findings: {
          orderBy: [
            { severity: 'asc' },
            { createdAt: 'asc' },
          ],
        },
        report: true,
      },
    })

    if (!scan) {
      return NextResponse.json(
        { error: 'not_found', message: 'Scan not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: scan.id,
      target_url: scan.targetUrl,
      target_domain: scan.targetDomain,
      status: scan.status,
      score: scan.score,
      created_at: scan.createdAt.toISOString(),
      started_at: scan.startedAt?.toISOString() || null,
      completed_at: scan.completedAt?.toISOString() || null,
      duration_ms: scan.durationMs,
      error_message: scan.errorMessage,
      findings: scan.findings.map((f: any) => ({
        id: f.id,
        module: f.module,
        title: f.title,
        description: f.description,
        severity: f.severity,
        dpdp_section: f.dpdpSection,
        dpdp_fine_range: f.dpdpFineRange,
        dpdp_implication: f.dpdpImplication,
        recommendation: f.recommendation,
      })),
      report: scan.report ? {
        summary: scan.report.summary,
        model: scan.report.llmModel,
        generated_at: scan.report.createdAt.toISOString(),
      } : null,
    })
  } catch (error) {
    console.error('[scans/id] GET error:', error)
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to get scan' },
      { status: 500 }
    )
  }
}
