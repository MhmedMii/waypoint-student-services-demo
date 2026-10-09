import type { Pool } from 'pg'
import type { Session } from 'next-auth'
import type { ActivityAction } from '../../domain/entities/activityLog'
import { SYSTEM_ACTOR_NAME } from '../../domain/entities/activityLog'
import { createPostgresActivityLogRepository } from '../../adapters/repositories/postgresActivityLogRepository'
import type { CreateActivityLogInput } from '../../application/ports/ActivityLogRepository'

// الجلسة تجي null بالمسارات اللي يفتحها العميل نفسه — كشك الاستقبال وفورم التقديم
// العام. قبل كنا نتخطى التسجيل كامل بهالحالة، فصار السجل ما يعرف مين أنشأ أي زيارة.
function actorFrom(
  session: Session | null
): Pick<CreateActivityLogInput, 'actorId' | 'actorName' | 'actorRole'> {
  if (!session) {
    return { actorId: null, actorName: SYSTEM_ACTOR_NAME, actorRole: 'system' }
  }
  // جلسة بلا مستخدم = توكن منزوع (حساب معطّل). كانت ترمي هنا لأن الـ any
  // خفّى إن user ممكن تكون undefined — نسجّلها كنظام بدل ما ننهار
  const user = session.user
  if (!user) {
    return { actorId: null, actorName: SYSTEM_ACTOR_NAME, actorRole: 'system' }
  }
  return { actorId: user.id, actorName: user.name ?? SYSTEM_ACTOR_NAME, actorRole: user.role }
}

export async function logActivity(
  pool: Pool,
  session: Session | null,
  action: ActivityAction,
  targetType: 'account' | 'visit' | 'application',
  targetId: string,
  details: string | null = null,
  detailsAr: string | null = null
): Promise<void> {
  await createPostgresActivityLogRepository(pool).create({
    ...actorFrom(session),
    action,
    targetType,
    targetId,
    details,
    detailsAr,
  })
}
