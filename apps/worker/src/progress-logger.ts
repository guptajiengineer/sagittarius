import fs from 'fs'
import path from 'path'

const logFile = path.join(__dirname, '../../../progress_log.txt')
fs.writeFileSync(logFile, '--- Sagittarius Scan Progress Log ---\n\n')

const originalLog = console.log
const originalError = console.error

console.log = function (...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
  fs.appendFileSync(logFile, `[LOG] ${new Date().toISOString()} - ${msg}\n`)
  originalLog.apply(console, args)
}

console.error = function (...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
  fs.appendFileSync(logFile, `[ERROR] ${new Date().toISOString()} - ${msg}\n`)
  originalError.apply(console, args)
}
