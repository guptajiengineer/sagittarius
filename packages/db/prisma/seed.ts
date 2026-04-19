import { PrismaClient, ScanStatus, Severity } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email: 'dev@sagittarius.local' },
    update: {},
    create: {
      email: 'dev@sagittarius.local',
      passwordHash: 'test1234',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })

  // Upsert API Key
  await prisma.apiKey.upsert({
    where: { keyHash: 'stub-hash-for-dev-key' },
    update: {},
    create: {
      userId: user.id,
      name: 'Dev Key',
      keyHash: 'stub-hash-for-dev-key',
      keyPrefix: 'dev_',
    },
  })

  // Seeding Scans
  const completeScanId = '11111111-1111-1111-1111-111111111111'
  const runningScanId = '22222222-2222-2222-2222-222222222222'
  const failedScanId = '33333333-3333-3333-3333-333333333333'

  await prisma.scan.upsert({
    where: { id: completeScanId },
    update: {},
    create: {
      id: completeScanId,
      userId: user.id,
      targetUrl: 'https://complete-scan.example.com',
      targetDomain: 'complete-scan.example.com',
      status: ScanStatus.complete,
      score: 85,
      subdomainsFound: 3,
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
      findings: {
        create: [
          {
            module: 'ssl',
            title: 'SSL Missing',
            description: 'No valid SSL certificate found',
            severity: Severity.high,
            dpdpSection: 'Section 8(4)',
            dpdpFineRange: 'Up to ₹50 crore',
            dpdpImplication: 'Inadequate security safeguard.',
            recommendation: 'Install SSL',
            rawData: {}
          },
          {
            module: 'headers',
            title: 'Missing HSTS',
            description: 'HSTS header missing',
            severity: Severity.medium,
            dpdpSection: 'Section 8(4)',
            dpdpFineRange: 'Up to ₹50 crore',
            dpdpImplication: 'Connections can be downgraded',
            recommendation: 'Enable HSTS',
            rawData: {}
          },
          {
            module: 'headers',
            title: 'Missing CSP',
            description: 'Content Security Policy missing',
            severity: Severity.medium,
            dpdpSection: 'Section 8(4)',
            dpdpFineRange: 'Up to ₹50 crore',
            dpdpImplication: 'Vulnerable to XSS',
            recommendation: 'Add CSP header',
            rawData: {}
          }
        ]
      }
    }
  })

  await prisma.scan.upsert({
    where: { id: runningScanId },
    update: {},
    create: {
      id: runningScanId,
      userId: user.id,
      targetUrl: 'https://running-scan.example.com',
      targetDomain: 'running-scan.example.com',
      status: ScanStatus.running,
      startedAt: new Date(),
    }
  })

  await prisma.scan.upsert({
    where: { id: failedScanId },
    update: {},
    create: {
      id: failedScanId,
      userId: user.id,
      targetUrl: 'https://failed-scan.example.com',
      targetDomain: 'failed-scan.example.com',
      status: ScanStatus.failed,
      errorMessage: 'DNS resolution failed',
      startedAt: new Date(Date.now() - 30000),
      completedAt: new Date(),
    }
  })

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
