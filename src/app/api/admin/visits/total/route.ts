import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresApplicationRepository } from '../../../../../adapters/repositories/postgresApplicationRepository'

// العدّاد لازم يقول إن فيه سجلات خارج الفترة المعروضة — بدونه "٥٨" تنقرأ
// كأنها كل شي بالنظام، وهذا بالضبط اللي ضلّل الإدارة قبل
export async function GET() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const [visits, applications] = await Promise.all([
    createPostgresVisitRepository(pool).countAll(),
    createPostgresApplicationRepository(pool).countAll(),
  ])
  return NextResponse.json({ total: visits + applications })
}
