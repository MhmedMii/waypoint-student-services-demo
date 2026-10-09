import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { getCounselorAssignedVisits } from '../../../../../application/useCases/getCounselorAssignedVisits'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../../adapters/repositories/postgresVisitRepository'

export async function GET() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const visits = await getCounselorAssignedVisits(session!.user!.id, {
    visitRepository: createPostgresVisitRepository(pool),
  })
  return NextResponse.json(visits)
}
