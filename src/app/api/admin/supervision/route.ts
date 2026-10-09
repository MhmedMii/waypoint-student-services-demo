import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { getCounselorSupervision } from '../../../../application/useCases/getCounselorSupervision'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresBreakRepository } from '../../../../adapters/repositories/postgresBreakRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'

export async function GET() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const supervision = await getCounselorSupervision({
    userRepository: createPostgresUserRepository(pool),
    visitRepository: createPostgresVisitRepository(pool),
    breakRepository: createPostgresBreakRepository(pool),
    clock: systemClock,
  })

  return NextResponse.json(supervision)
}
