import { NextResponse } from 'next/server'
import { db } from '@sagittarius/db'

/**
 * GET /api/v1/scans/[id]/status — Quick status check for polling
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const scan = await db.scan.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        score: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
        errorMessage: true,
        _count: { select: { findings: true } },
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
      status: scan.status,
      score: scan.score,
      findings_count: scan._count.findings,
      started_at: scan.startedAt?.toISOString() || null,
      completed_at: scan.completedAt?.toISOString() || null,
      duration_ms: scan.durationMs,
      error_message: scan.errorMessage,
    })
  } catch (error) {
    console.error('[scans/id/status] GET error:', error)
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to get status' },
      { status: 500 }
    )
  }
}
