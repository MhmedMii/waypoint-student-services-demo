import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresActivityLogRepository } from '../../../../adapters/repositories/postgresActivityLogRepository'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { markLogRowsForStrandedClients } from '../../../../application/useCases/markLogRowsForStrandedClients'
import { activityRangeStart } from './activityRange'

// سقف أمان بس — لو انضرب نقول للمستخدم صراحة إنه فيه أكثر، بدل ما نخليه
// يظن إنه شايف كل شي. قبل كان السقف ٢٠٠ وصامت
const MAX_ROWS = 1000

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const cutoff = activityRangeStart(request.nextUrl.searchParams.get('days'), new Date())
  const repository = createPostgresActivityLogRepository(pool)
  const [rows, totalInRange, totalAllTime] = await Promise.all([
    repository.findInRange(cutoff, MAX_ROWS),
    repository.countInRange(cutoff),
    repository.countAll(),
  ])

  // الصفوف القديمة ما تحمل سبب الغياب — الميزة ما كانت موجودة وقتها. بس
  // النتيجة نقدر نتأكد منها لأي صف: هل العميل لسا بدون مستشار
  const marked = await markLogRowsForStrandedClients(rows, createPostgresVisitRepository(pool))

  return NextResponse.json({ rows: marked, totalInRange, totalAllTime })
}
