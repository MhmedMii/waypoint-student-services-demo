import { pool } from '../src/infrastructure/db/pool'
import { createPostgresUserRepository } from '../src/adapters/repositories/postgresUserRepository'
import { createPostgresSpecializationRepository } from '../src/adapters/repositories/postgresSpecializationRepository'
import { addAccount } from '../src/application/useCases/addAccount'
import type { SpecializationScope } from '../src/domain/entities/counselor'

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]
  const name = process.argv[4] ?? 'Test Counselor'
  const scope = (process.argv[5] ?? 'USA') as SpecializationScope
  if (!email || !password) {
    console.error('Usage: tsx scripts/seedCounselor.ts <email> <password> [name] [scope]')
    process.exit(1)
  }

  const result = await addAccount(
    'super_admin',
    { name, role: 'counselor', email, password, scopes: [scope] },
    {
      userRepository: createPostgresUserRepository(pool),
      specializationRepository: createPostgresSpecializationRepository(pool),
    }
  )

  if (!result.ok) {
    console.error(result.reason)
    process.exit(1)
  }

  console.log(`counselor '${email}' created with scope '${scope}'.`)
  await pool.end()
}

main()
