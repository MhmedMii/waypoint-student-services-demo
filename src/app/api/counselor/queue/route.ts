import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { getCounselorQueue } from '../../../../application/useCases/getCounselorQueue'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresBreakRepository } from '../../../../adapters/repositories/postgresBreakRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'

export async function GET() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const view = await getCounselorQueue(session!.user!.id, {
    visitRepository: createPostgresVisitRepository(pool),
    breakRepository: createPostgresBreakRepository(pool),
    clock: systemClock,
  })
  return NextResponse.json(view)
}
