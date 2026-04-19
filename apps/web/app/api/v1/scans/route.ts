import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@sagittarius/db'
import { createScanQueue } from '@sagittarius/queue'
import type { ScanJob } from '@sagittarius/shared-types'

const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000'

/**
 * POST /api/v1/scans — Submit a new scan
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'URL is required' },
        { status: 400 }
      )
    }

    // Normalize URL
    let normalizedUrl = url.trim()
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    let parsed: URL
    try {
      parsed = new URL(normalizedUrl)
    } catch {
      return NextResponse.json(
        { error: 'validation_error', message: 'Invalid URL format' },
        { status: 400 }
      )
    }

    const domain = parsed.hostname.toLowerCase()

    // Reject private/local targets
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/i,
    ]
    if (privatePatterns.some(p => p.test(domain))) {
      return NextResponse.json(
        { error: 'validation_error', message: 'Cannot scan private/local addresses' },
        { status: 400 }
      )
    }

    // Ensure anonymous user exists in DB
    await db.user.upsert({
      where: { id: ANONYMOUS_USER_ID },
      create: {
        id: ANONYMOUS_USER_ID,
        email: 'anonymous@sagittarius.local',
        passwordHash: 'nologin',
      },
      update: {},
    })

    // Create scan record
    const scan = await db.scan.create({
      data: {
        userId: ANONYMOUS_USER_ID,
        targetUrl: normalizedUrl,
        targetDomain: domain,
        status: 'queued',
      },
    })

    // Enqueue BullMQ job — queue created and immediately closed after adding
    const queue = createScanQueue()
    const jobData: ScanJob = {
      scanId: scan.id,
      targetUrl: normalizedUrl,
      userId: ANONYMOUS_USER_ID,
      enqueuedAt: new Date().toISOString(),
    }
    await queue.add('scan', jobData, { jobId: scan.id })
    await queue.close()

    return NextResponse.json(
      {
        scan_id: scan.id,
        status: 'queued',
        target_url: normalizedUrl,
        target_domain: domain,
        created_at: scan.createdAt.toISOString(),
      },
      { status: 202 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/v1/scans] error:', msg)
    return NextResponse.json(
      { error: 'internal_error', message: msg },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/scans — List recent scans
 */
export async function GET() {
  try {
    const scans = await db.scan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        targetUrl: true,
        targetDomain: true,
        status: true,
        score: true,
        createdAt: true,
        completedAt: true,
        durationMs: true,
      },
    })

    return NextResponse.json({ scans })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[GET /api/v1/scans] error:', msg)
    return NextResponse.json(
      { error: 'internal_error', message: msg },
      { status: 500 }
    )
  }
}
