import 'dotenv/config'
import { orchestrateScan } from './orchestrator'
import { db } from '@sagittarius/db'
import { v4 as uuidv4 } from 'uuid'

async function main() {
  const targetUrl = process.argv[2] || 'https://example.com'
  const domain = new URL(targetUrl).hostname
  
  console.log(`\n🚀 Starting manual test scan for: ${targetUrl} (${domain})`)
  console.log('--------------------------------------------------')

  const scanId = uuidv4()
  const userId = '00000000-0000-0000-0000-000000000000'

  // Ensure anonymous user exists
  await db.user.upsert({
    where: { id: userId },
    create: { id: userId, email: 'anonymous@sagittarius.local', passwordHash: 'nologin' },
    update: {},
  })

  // Create scan record
  await db.scan.create({
    data: {
      id: scanId,
      userId,
      targetUrl,
      targetDomain: domain,
      status: 'running',
    },
  })

  // Mock BullMQ Job
  const mockJob: any = {
    data: {
      scanId,
      targetUrl,
      userId,
    }
  }

  try {
    await orchestrateScan(mockJob)
    
    // Fetch and display results
    const result = await db.scan.findUnique({
      where: { id: scanId },
      include: { findings: true, report: true }
    })

    console.log('\n✅ SCAN COMPLETE!')
    console.log(`Status: ${result?.status}`)
    console.log(`Score: ${result?.score}/100`)
    console.log(`Duration: ${result?.durationMs}ms`)
    console.log(`Findings count: ${result?.findings.length}`)
    
    console.log('\n--- FINDINGS ---')
    result?.findings.forEach(f => {
      console.log(`[${f.severity.toUpperCase()}] ${f.module}: ${f.title}`)
      console.log(`    ${f.description}`)
    })

    console.log('\n--- AI REPORT ---')
    console.log(result?.report?.summary || 'No report generated.')
    console.log('\n')

  } catch (error) {
    console.error('\n❌ SCAN FAILED FATALLY:')
    console.error(error)
  } finally {
    process.exit(0)
  }
}

main()
