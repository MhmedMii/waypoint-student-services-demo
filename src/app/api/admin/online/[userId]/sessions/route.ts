import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../../infrastructure/auth/requireRole'
import { validateDateQueryParam } from '../../../../../../domain/validation/validateDateQueryParam'
import { getOnlineSessionsForDate } from '../../../../../../application/useCases/getOnlineSessionsForDate'
import { pool } from '../../../../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../../../../adapters/repositories/postgresUserRepository'
import { createPostgresOnlineSessionRepository } from '../../../../../../adapters/repositories/postgresOnlineSessionRepository'
import { startOfKuwaitDay } from '../../../../../../domain/time/kuwaitTime'

// كان يبني منتصف ليل UTC، فنافذة "٢٣ سبتمبر" تصير من الثالثة فجرًا لين
// الثالثة فجرًا بالكويت — جلسة مستشار مسائي ٠٠:٣٠ تُحسب على اليوم اللي قبله

export async function GET(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const actorRole = session!.user!.role
  const userRepository = createPostgresUserRepository(pool)
  const target = await userRepository.findById(params.userId)
  if (!target) return NextResponse.json({ ok: false, errors: ['User not found'] }, { status: 404 })
  if (target.role === 'super_admin' && actorRole !== 'super_admin') {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  const dateResult = validateDateQueryParam(request.nextUrl.searchParams.get('date'), new Date())
  if (!dateResult.isValid)
    return NextResponse.json({ ok: false, errors: [dateResult.reason] }, { status: 400 })

  const { sessions, totalSeconds } = await getOnlineSessionsForDate(
    params.userId,
    startOfKuwaitDay(dateResult.date),
    { onlineSessionRepository: createPostgresOnlineSessionRepository(pool) }
  )

  return NextResponse.json({
    ok: true,
    totalSeconds,
    sessions: sessions.map((s) => ({ startedAt: s.startedAt, endedAt: s.endedAt })),
  })
}
