import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import {
  closeVisitAndAdvance,
  NOT_YOUR_VISIT_REASON,
} from '../../../../application/useCases/closeVisitAndAdvance'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'
import { logActivity } from '../../../../infrastructure/activity/logActivity'
import { validateNote } from '../../../../domain/validation/validateNote'
import { validateFinishStudentStatus } from '../../../../domain/validation/validateFinishStudentStatus'
import { validateFollowUpDueDate } from '../../../../domain/validation/validateFollowUpDueDate'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const { visitId, studentStatus, note, followUpDueAt } = await request.json()
  const statusValidation = validateFinishStudentStatus(studentStatus)
  if (!statusValidation.isValid) {
    return NextResponse.json({ ok: false, reason: statusValidation.reason }, { status: 400 })
  }
  const noteValidation = validateNote(note)
  if (!noteValidation.isValid) {
    return NextResponse.json({ ok: false, reason: noteValidation.reason }, { status: 400 })
  }
  const dueDateValidation = validateFollowUpDueDate(studentStatus, followUpDueAt)
  if (!dueDateValidation.isValid) {
    return NextResponse.json({ ok: false, reason: dueDateValidation.reason }, { status: 400 })
  }
  const counselorId = session!.user!.id
  const trimmedNote = typeof note === 'string' && note.trim() ? note.trim() : null
  const result = await closeVisitAndAdvance(
    visitId,
    studentStatus,
    counselorId,
    {
      visitRepository: createPostgresVisitRepository(pool),
      clock: systemClock,
    },
    trimmedNote,
    dueDateValidation.date
  )
  if (!result.ok) {
    const statusCode = result.reason === NOT_YOUR_VISIT_REASON ? 403 : 400
    return NextResponse.json(result, { status: statusCode })
  }
  await logActivity(
    pool,
    session!,
    'visit_closed',
    'visit',
    result.visit.id,
    `Closed visit for ${result.visit.name} — student status set to "${studentStatus}"`,
    `تم إغلاق الزيارة لـ ${result.visit.name} — حالة الطالب: "${studentStatus}"`
  )
  return NextResponse.json(result, { status: 200 })
}
