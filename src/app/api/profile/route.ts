import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../infrastructure/auth/requireRole'
import { pool } from '../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../adapters/repositories/postgresUserRepository'

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ ok: false, reason: 'nameRequired' }, { status: 400 })

  const userId = session!.user!.id as string
  const userRepository = createPostgresUserRepository(pool)
  await userRepository.setName(userId, name)

  return NextResponse.json({ ok: true, name })
}
