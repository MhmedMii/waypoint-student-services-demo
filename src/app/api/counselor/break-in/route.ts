import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { breakIn } from '../../../../application/useCases/breakIn'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresBreakRepository } from '../../../../adapters/repositories/postgresBreakRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'

export async function POST() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const result = await breakIn(session!.user!.id, {
    breakRepository: createPostgresBreakRepository(pool),
    clock: systemClock,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
