import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../infrastructure/auth/requireRole'
import { recordHeartbeat } from '../../../application/useCases/recordHeartbeat'
import { pool } from '../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../adapters/repositories/postgresUserRepository'
import { createPostgresOnlineSessionRepository } from '../../../adapters/repositories/postgresOnlineSessionRepository'
import { systemClock } from '../../../infrastructure/db/systemClock'

export async function POST() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor', 'admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const userId = session!.user!.id as string
  await recordHeartbeat(userId, {
    userRepository: createPostgresUserRepository(pool),
    onlineSessionRepository: createPostgresOnlineSessionRepository(pool),
    clock: systemClock,
  })

  return NextResponse.json({ ok: true })
}
