import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { getAdminNotifications } from '../../../../application/useCases/getAdminNotifications'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  // المستشار ما يشوف الجرس، والمسار يرفضه كمان — إخفاء الزر بالواجهة مو حماية
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const view = await getAdminNotifications({
    visitRepository: createPostgresVisitRepository(pool),
    userRepository: createPostgresUserRepository(pool),
    clock: systemClock,
  })
  return NextResponse.json(view)
}
