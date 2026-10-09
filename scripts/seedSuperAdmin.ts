import bcrypt from 'bcryptjs'
import { pool } from '../src/infrastructure/db/pool'
import { validateEmailAddress } from '../src/domain/validation/validateEmailAddress'

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]
  const name = process.argv[4] ?? 'Super Admin'
  if (!email || !password) {
    console.error('Usage: tsx scripts/seedSuperAdmin.ts <email> <password> [name]')
    process.exit(1)
  }

  const emailResult = validateEmailAddress(email)
  if (!emailResult.isValid) {
    console.error(emailResult.reason)
    process.exit(1)
  }

  const existing = await pool.query("SELECT id FROM users WHERE role = 'super_admin'")
  if (existing.rows.length > 0) {
    console.error('A super_admin already exists — the DB only allows one.')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await pool.query(
    "INSERT INTO users (name, role, email, password_hash) VALUES ($1, 'super_admin', $2, $3)",
    [name, email, passwordHash]
  )
  console.log(`super_admin '${email}' created.`)
  await pool.end()
}

main()
