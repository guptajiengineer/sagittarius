import { NextResponse } from 'next/server'
import { db } from '@sagittarius/db'

export async function GET() {
  let dbStatus: 'ok' | 'degraded' = 'ok'

  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'degraded'
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    services: {
      database: dbStatus,
    },
  })
}
