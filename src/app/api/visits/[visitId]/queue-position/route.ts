import { NextRequest, NextResponse } from 'next/server'
import { getVisitQueuePosition } from '../../../../../application/useCases/getVisitQueuePosition'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresUserRepository } from '../../../../../adapters/repositories/postgresUserRepository'
import { systemClock } from '../../../../../infrastructure/db/systemClock'

// نقطة عامة بدون تسجيل دخول — شاشة الانتظار بالكشك تسألها كل بضع ثواني،
// آمنة لأن visitId مُعرّف UUID غير قابل للتخمين ومارجّع غير موقع الانتظار والاسم
export async function GET(_request: NextRequest, props: { params: Promise<{ visitId: string }> }) {
  const params = await props.params
  const result = await getVisitQueuePosition(params.visitId, {
    visitRepository: createPostgresVisitRepository(pool),
    userRepository: createPostgresUserRepository(pool),
    clock: systemClock,
  })

  if (!result.ok) return NextResponse.json({ ok: false }, { status: 404 })
  return NextResponse.json(result)
}
