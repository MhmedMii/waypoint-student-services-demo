import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { addAccount } from '../../../../application/useCases/addAccount'
import { listAccounts } from '../../../../application/useCases/listAccounts'
import { toSafeUser } from '../../../../domain/entities/user'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { createPostgresSpecializationRepository } from '../../../../adapters/repositories/postgresSpecializationRepository'
import { logActivity } from '../../../../infrastructure/activity/logActivity'
import { translations } from '../../../../i18n/translations'

export async function GET() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const accounts = await listAccounts({
    userRepository: createPostgresUserRepository(pool),
    specializationRepository: createPostgresSpecializationRepository(pool),
  })
  return NextResponse.json(accounts)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await request.json()
  const role = session!.user!.role
  const result = await addAccount(role, body, {
    userRepository: createPostgresUserRepository(pool),
    specializationRepository: createPostgresSpecializationRepository(pool),
  })
  if (!result.ok)
    return NextResponse.json(result, { status: result.code === 'forbidden' ? 403 : 400 })

  await logActivity(
    pool,
    session!,
    'account_created',
    'account',
    result.user.id,
    `Created ${result.user.role} account for ${result.user.name} (${result.user.email})`,
    `تم إنشاء حساب ${translations.ar.nav[result.user.role]} لـ ${result.user.name} (${result.user.email})`
  )
  return NextResponse.json({ ok: true, user: toSafeUser(result.user) }, { status: 200 })
}
