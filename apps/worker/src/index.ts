import 'dotenv/config'
import './progress-logger'
import { createScanWorker } from '@sagittarius/queue'
import { orchestrateScan } from './orchestrator'

const worker = createScanWorker(orchestrateScan)

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed (scan: ${job.data.scanId})`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed (scan: ${job?.data?.scanId}):`, err.message)
})

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err)
})

console.log('[worker] Sagittarius worker started. Waiting for scan jobs...')
