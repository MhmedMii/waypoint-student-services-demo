// scripts/addRateLimitLockoutsTable.ts
// ينشئ جدول حظر محاولات الدخول. لازم يشتغل على قاعدة البيانات قبل نشر الكود —
// الكود يسأل الجدول من أول محاولة دخول، فلو ما كان موجود يطيح تسجيل الدخول كله.
// آمن يتكرر: IF NOT EXISTS، وما يلمس أي جدول ثاني.
import { Pool } from 'pg'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Run with: npx tsx --env-file=.env <this file>')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_lockouts (
        lockout_key TEXT PRIMARY KEY,
        failure_count INTEGER NOT NULL DEFAULT 0,
        blocked_until TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS rate_limit_lockouts_updated_at_idx
        ON rate_limit_lockouts (updated_at)
    `)

    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'rate_limit_lockouts' ORDER BY ordinal_position`
    )
    console.log('rate_limit_lockouts is ready. Columns:')
    for (const row of check.rows) console.log(`  - ${row.column_name}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
