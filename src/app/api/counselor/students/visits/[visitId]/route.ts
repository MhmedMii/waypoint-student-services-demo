import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../../infrastructure/auth/requireRole'
import { setVisitStudentStatus } from '../../../../../../application/useCases/setVisitStudentStatus'
import { NOT_YOUR_VISIT_REASON } from '../../../../../../application/useCases/closeVisitAndAdvance'
import { validateVisitStudentStatus } from '../../../../../../domain/validation/validateVisitStudentStatus'
import { validateFollowUpDueDate } from '../../../../../../domain/validation/validateFollowUpDueDate'
import { pool } from '../../../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../../../adapters/repositories/postgresVisitRepository'
import { logActivity } from '../../../../../../infrastructure/activity/logActivity'

export async function PATCH(request: NextRequest, props: { params: Promise<{ visitId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await request.json()
  const statusValidation = validateVisitStudentStatus(body.studentStatus)
  if (!statusValidation.isValid) {
    return NextResponse.json({ ok: false, reason: statusValidation.reason }, { status: 400 })
  }
  const dueDateValidation = validateFollowUpDueDate(body.studentStatus, body.followUpDueAt)
  if (!dueDateValidation.isValid) {
    return NextResponse.json({ ok: false, reason: dueDateValidation.reason }, { status: 400 })
  }

  const visitRepository = createPostgresVisitRepository(pool)
  const result = await setVisitStudentStatus(
    params.visitId,
    body.studentStatus,
    session!.user!.id,
    { visitRepository },
    dueDateValidation.date
  )
  if (!result.ok) {
    const statusCode = result.reason === NOT_YOUR_VISIT_REASON ? 403 : 400
    return NextResponse.json(result, { status: statusCode })
  }

  // كان تغيير حالة الطالب بالتعديل اليدوي ما ينسجل بأي مكان — لما ظهر تناقض
  // ما كان فيه طريقة نعرف مين غيّره ومتى
  const visit = await visitRepository.findById(params.visitId)
  if (visit) {
    await logActivity(
      pool,
      session!,
      'visit_status_changed',
      'visit',
      visit.id,
      `Changed student status for ${visit.name} to "${body.studentStatus}"`,
      `تم تغيير حالة الطالب لـ ${visit.name} إلى "${body.studentStatus}"`
    )
  }
  return NextResponse.json(result, { status: 200 })
}
