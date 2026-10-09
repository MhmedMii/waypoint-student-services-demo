import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { getAdminKpis } from '../../../../application/useCases/getAdminKpis'
import { validateDateQueryParam } from '../../../../domain/validation/validateDateQueryParam'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { createPostgresApplicationRepository } from '../../../../adapters/repositories/postgresApplicationRepository'

const DEFAULT_RANGE_DAYS_MS = 7 * 86400000

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const fromResult = validateDateQueryParam(
    request.nextUrl.searchParams.get('from'),
    new Date(Date.now() - DEFAULT_RANGE_DAYS_MS)
  )
  if (!fromResult.isValid)
    return NextResponse.json({ ok: false, reason: fromResult.reason }, { status: 400 })

  const toResult = validateDateQueryParam(request.nextUrl.searchParams.get('to'), new Date())
  if (!toResult.isValid)
    return NextResponse.json({ ok: false, reason: toResult.reason }, { status: 400 })

  const kpis = await getAdminKpis(
    { from: fromResult.date, to: toResult.date },
    {
      visitRepository: createPostgresVisitRepository(pool),
      userRepository: createPostgresUserRepository(pool),
      applicationRepository: createPostgresApplicationRepository(pool),
    }
  )
  return NextResponse.json(kpis)
}
