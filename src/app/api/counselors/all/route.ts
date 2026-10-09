import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { listAllCounselors } from '../../../../application/useCases/listAllCounselors'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'

export async function GET() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const counselors = await listAllCounselors({ userRepository: createPostgresUserRepository(pool) })
  return NextResponse.json(counselors)
}
