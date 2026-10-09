import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireScope } from '../../../../../infrastructure/auth/requireScope'
import { listVisitsForScope } from '../../../../../application/useCases/listVisitsForScope'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresUserRepository } from '../../../../../adapters/repositories/postgresUserRepository'
import type { VisitType } from '../../../../../domain/entities/visit'
import { systemClock } from '../../../../../infrastructure/db/systemClock'

export async function GET(_request: NextRequest, props: { params: Promise<{ type: string }> }) {
  const params = await props.params
  const type = params.type as VisitType
  if (type !== 'new' && type !== 'follow_up' && type !== 'visa')
    return NextResponse.json({ ok: false }, { status: 400 })

  const session = await getServerSession(authOptions)
  const access = requireScope(session, 'visa_services')
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const role = session!.user!.role
  const scopes = session!.user!.scopes ?? []
  const result = await listVisitsForScope(role, scopes, type, {
    visitRepository: createPostgresVisitRepository(pool),
    userRepository: createPostgresUserRepository(pool),
    clock: systemClock,
  })
  if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason }, { status: 403 })

  return NextResponse.json(result.visits)
}
