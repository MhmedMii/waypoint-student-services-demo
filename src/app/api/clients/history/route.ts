import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { getClientHistory } from '../../../../application/useCases/getClientHistory'
import type { SpecializationScope } from '../../../../domain/entities/counselor'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresApplicationRepository } from '../../../../adapters/repositories/postgresApplicationRepository'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor', 'admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const phone = request.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ ok: false }, { status: 400 })

  // المستشار يمر من هنا كمان، فالهوية والنطاقات لازمة مو الدور بس: من غيرها
  // أي مستشار يقدر يسحب سجل أي عميل برقمه — وثمان خانات تُعدّ من أولها لآخرها
  const actor = {
    role: session!.user!.role,
    id: session!.user!.id,
    scopes: (session!.user!.scopes ?? []) as SpecializationScope[],
  }
  const result = await getClientHistory(actor, phone, {
    visitRepository: createPostgresVisitRepository(pool),
    applicationRepository: createPostgresApplicationRepository(pool),
    userRepository: createPostgresUserRepository(pool),
  })
  if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason }, { status: 403 })

  return NextResponse.json(result.entries)
}
