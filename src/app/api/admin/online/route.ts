import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { listOnlinePresence } from '../../../../application/useCases/listOnlinePresence'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'

export async function GET() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const role = session!.user!.role
  const presence = await listOnlinePresence(role, {
    userRepository: createPostgresUserRepository(pool),
    clock: systemClock,
  })

  return NextResponse.json(presence)
}
