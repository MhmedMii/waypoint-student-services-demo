import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { reassignVisit } from '../../../../application/useCases/reassignVisit'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { logActivity } from '../../../../infrastructure/activity/logActivity'
import { localizedName } from '../../../../i18n/localizedName'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const { visitId, counselorId } = await request.json()
  const role = session!.user!.role
  const result = await reassignVisit(role, visitId, counselorId, {
    visitRepository: createPostgresVisitRepository(pool),
  })
  if (result.ok) {
    const counselor = counselorId
      ? await createPostgresUserRepository(pool).findById(counselorId)
      : null
    const details = counselor ? `Reassigned visit to ${counselor.name}` : 'Unassigned visit'
    const detailsAr = counselor
      ? `تم إعادة تعيين الزيارة إلى ${localizedName(counselor.name, counselor.nameAr, 'ar')}`
      : 'تم إلغاء تعيين الزيارة'
    await logActivity(pool, session!, 'visit_reassigned', 'visit', visitId, details, detailsAr)
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 403 })
}
