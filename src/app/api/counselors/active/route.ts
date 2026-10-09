import { NextResponse } from 'next/server'
import { listActiveCounselors } from '../../../../application/useCases/listActiveCounselors'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'

export const dynamic = 'force-dynamic'

export async function GET() {
  const counselors = await listActiveCounselors({
    userRepository: createPostgresUserRepository(pool),
    clock: systemClock,
  })
  return NextResponse.json(counselors)
}
