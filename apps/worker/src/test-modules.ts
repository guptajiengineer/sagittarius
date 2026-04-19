import 'dotenv/config'
import { runSslLabs } from './modules/ssl-labs'
import { runSecurityHeaders } from './modules/security-headers'
import { runCrtSh } from './modules/crt-sh'
import { runVirusTotal } from './modules/virustotal'
import { runHibp } from './modules/have-i-been-pwned'
import { runCloudflareRadar } from './modules/cloudflare-radar'
import { runUrlscan } from './modules/urlscan'
import { runMxtoolbox } from './modules/mxtoolbox'
import { runWhois } from './modules/whois'

const TARGET_URL = 'https://www.cappio.app'
const DOMAIN = new URL(TARGET_URL).hostname

async function testModule(name: string, fn: () => Promise<any>) {
  console.log(`\n===========================================`)
  console.log(`🧪 Testing: ${name}`)
  console.log(`===========================================`)
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    console.log(`✅ SUCCESS (${duration}ms)`)
    console.log(JSON.stringify(result, null, 2))
    return { status: 'success', duration, error: null }
  } catch (error: any) {
    const duration = Date.now() - start
    console.log(`❌ FAILED (${duration}ms)`)
    console.error(error.message || error)
    return { status: 'failed', duration, error: error.message || error }
  }
}

async function main() {
  console.log(`Starting sequential module test for: ${TARGET_URL}`)
  
  const results: any = {}

  results['ssl-labs'] = await testModule('SSL Labs', () => runSslLabs(TARGET_URL))
  results['security-headers'] = await testModule('SecurityHeaders', () => runSecurityHeaders(TARGET_URL))
  results['crt-sh'] = await testModule('crt.sh', () => runCrtSh(DOMAIN))
  results['virustotal'] = await testModule('VirusTotal', () => runVirusTotal(DOMAIN))
  results['hibp'] = await testModule('Have I Been Pwned', () => runHibp(DOMAIN))
  results['cloudflare-radar'] = await testModule('Cloudflare Radar', () => runCloudflareRadar(TARGET_URL))
  results['urlscan'] = await testModule('URLScan.io', () => runUrlscan(TARGET_URL))
  results['mxtoolbox'] = await testModule('MXToolbox', () => runMxtoolbox(DOMAIN))
  results['whois'] = await testModule('Whois', () => runWhois(DOMAIN))

  console.log(`\n\n🎯 ALL TESTS COMPLETED. Summary:`)
  console.table(
    Object.entries(results).map(([name, res]: any) => ({
      Module: name,
      Status: res.status,
      DurationMs: res.duration,
      Error: res.error || '-',
    }))
  )
  process.exit(0)
}

main()
