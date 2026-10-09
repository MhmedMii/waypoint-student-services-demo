import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { startVisitTimer } from '../../../../application/useCases/startVisitTimer'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'
import { logActivity } from '../../../../infrastructure/activity/logActivity'

export async function POST() {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const result = await startVisitTimer(session!.user!.id, {
    visitRepository: createPostgresVisitRepository(pool),
    clock: systemClock,
  })
  // بدون هالصف، السجل يعرف إن الزيارة انفتحت وانقفلت وما يعرف متى جلس العميل
  // فعلاً — وهي اللحظة اللي يُقاس عليها وقت المعالجة
  if (result.ok) {
    await logActivity(
      pool,
      session,
      'visit_picked_up',
      'visit',
      result.visit.id,
      `Picked up ${result.visit.name}`,
      `استلام ${result.visit.name}`
    )
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
