import { db } from './client'
import { Prisma, ScanStatus, Severity, type User, type ApiKey, type Scan, type ConsentLog, type Finding } from '@prisma/client'

export type CreateFindingInput = Omit<Prisma.FindingCreateInput, 'id' | 'createdAt' | 'scan'>

export type ScanWithReport = Scan & { report: any }

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    return await db.user.findUnique({ where: { email } })
  } catch (error) {
    throw new Error(`Failed to get user by email: ${error}`)
  }
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  try {
    return await db.user.findUnique({ where: { id } })
  } catch (error) {
    throw new Error(`Failed to get user by id: ${error}`)
  }
}

/**
 * Create a new user
 */
export async function createUser(email: string, passwordHash: string): Promise<User> {
  try {
    return await db.user.create({ data: { email, passwordHash } })
  } catch (error) {
    throw new Error(`Failed to create user: ${error}`)
  }
}

/**
 * Get API key by hash
 */
export async function getApiKeyByHash(keyHash: string): Promise<(ApiKey & { user: User }) | null> {
  try {
    return await db.apiKey.findUnique({ where: { keyHash }, include: { user: true } })
  } catch (error) {
    throw new Error(`Failed to get api key: ${error}`)
  }
}

/**
 * Create a scan
 */
export async function createScan(userId: string, targetUrl: string, targetDomain: string): Promise<Scan> {
  try {
    return await db.scan.create({ data: { userId, targetUrl, targetDomain } })
  } catch (error) {
    throw new Error(`Failed to create scan: ${error}`)
  }
}

/**
 * Update scan status
 */
export async function updateScanStatus(scanId: string, status: ScanStatus, extra?: Partial<Scan>): Promise<void> {
  try {
    await db.scan.update({
      where: { id: scanId },
      data: { status, ...extra }
    })
  } catch (error) {
    throw new Error(`Failed to update scan status: ${error}`)
  }
}

/**
 * Create consent log
 */
export async function createConsentLog(scanId: string, userId: string, targetUrl: string, clientIp: string, userAgent: string | null): Promise<ConsentLog> {
  try {
    return await db.consentLog.create({
      data: {
        scanId,
        userId,
        targetUrl,
        clientIp,
        userAgent,
        consentedAt: new Date()
      }
    })
  } catch (error) {
    throw new Error(`Failed to create consent log: ${error}`)
  }
}

/**
 * Create findings for a scan
 */
export async function createFindings(scanId: string, findings: CreateFindingInput[]): Promise<void> {
  try {
    await db.finding.createMany({
      data: findings.map(f => ({ ...f, scanId }))
    })
  } catch (error) {
    throw new Error(`Failed to create findings: ${error}`)
  }
}

/**
 * Create scan report
 */
export async function createScanReport(scanId: string, summary: string, model: string, inputTokens: number, outputTokens: number, costUsd: number): Promise<void> {
  try {
    await db.scanReport.create({
      data: {
        scanId,
        summary,
        llmModel: model,
        llmInputTokens: inputTokens,
        llmOutputTokens: outputTokens,
        llmCostUsd: costUsd
      }
    })
  } catch (error) {
    throw new Error(`Failed to create scan report: ${error}`)
  }
}

/**
 * Get scans by user ID, paginated
 */
export async function getScansByUserId(userId: string, page: number, limit: number): Promise<{ scans: Scan[], total: number }> {
  try {
    const [scans, total] = await Promise.all([
      db.scan.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      db.scan.count({ where: { userId } })
    ])
    return { scans, total }
  } catch (error) {
    throw new Error(`Failed to get scans: ${error}`)
  }
}

/**
 * Get scan with report
 */
export async function getScanWithReport(scanId: string, userId: string): Promise<ScanWithReport | null> {
  try {
    return await db.scan.findFirst({
      where: { id: scanId, userId },
      include: { report: true }
    })
  } catch (error) {
    throw new Error(`Failed to get scan with report: ${error}`)
  }
}

/**
 * Count scans created by a user in the last rolling 24 hours
 */
export async function countScansInLast24Hours(userId: string): Promise<number> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return await db.scan.count({
      where: {
        userId,
        createdAt: {
          gte: twentyFourHoursAgo
        }
      }
    })
  } catch (error) {
    throw new Error(`Failed to count scans: ${error}`)
  }
}
