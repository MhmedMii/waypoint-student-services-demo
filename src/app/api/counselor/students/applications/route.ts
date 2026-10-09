import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { getCounselorAssignedApplications } from '../../../../../application/useCases/getCounselorAssignedApplications'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../../adapters/repositories/postgresApplicationRepository'

export async function GET() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const applications = await getCounselorAssignedApplications(session!.user!.id, {
    applicationRepository: createPostgresApplicationRepository(pool),
  })
  return NextResponse.json(applications)
}
