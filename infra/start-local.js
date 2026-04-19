/**
 * Start embedded PostgreSQL for local development.
 * Run this script, then keep it running in the background.
 */
const EmbeddedPostgres = require('embedded-postgres').default
const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, '.local-infra', 'pg-data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

async function main() {
  console.log('📦 Starting embedded PostgreSQL...')
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'sagittarius',
    password: 'sagittarius_dev_password',
    port: 5432,
    persistent: true,
  })

  try {
    await pg.initialise()
    console.log('   Initialised fresh data directory')
  } catch (e) {
    console.log('   Using existing data directory')
  }

  await pg.start()
  console.log('✅ PostgreSQL running on port 5432')

  try {
    await pg.createDatabase('sagittarius_dev')
    console.log('   Created database: sagittarius_dev')
  } catch (e) {
    console.log('   Database sagittarius_dev already exists')
  }

  console.log('\n🎯 Connection string:')
  console.log('   postgresql://sagittarius:sagittarius_dev_password@localhost:5432/sagittarius_dev')
  console.log('\nKeep this terminal open. Press Ctrl+C to stop.\n')

  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping PostgreSQL...')
    await pg.stop()
    process.exit(0)
  })
}

main().catch(e => { console.error('❌ Failed:', e.message); process.exit(1) })
