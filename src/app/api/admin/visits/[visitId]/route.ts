import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { deleteVisit } from '../../../../../application/useCases/deleteVisit'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../../adapters/repositories/postgresVisitRepository'
import { logActivity } from '../../../../../infrastructure/activity/logActivity'

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ visitId: string }> }
) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const role = session!.user!.role
  const visitRepository = createPostgresVisitRepository(pool)
  const visit = await visitRepository.findById(params.visitId)

  try {
    const result = await deleteVisit(role, params.visitId, { visitRepository })
    if (result.ok) {
      await logActivity(
        pool,
        session!,
        'visit_deleted',
        'visit',
        params.visitId,
        visit ? `Deleted visit for ${visit.name}` : null,
        visit ? `تم حذف الزيارة لـ ${visit.name}` : null
      )
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 403 })
  } catch (error: any) {
    // انتهاك مفتاح أجنبي (23503) معناه هالزيارة مربوطة بزيارة متابعة ثانية —
    // نرفض الحذف بدل ما نكسر تاريخ البيانات
    if (error?.code === '23503') {
      return NextResponse.json({ ok: false, reason: 'visitLinkedToOtherVisits' }, { status: 409 })
    }
    throw error
  }
}
