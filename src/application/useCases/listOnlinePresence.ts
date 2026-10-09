import type { UserRole } from '../../domain/entities/user'
import type { UserRepository } from '../ports/UserRepository'
import type { Clock } from '../ports/Clock'
import { isOnlineNow } from '../../domain/time/presenceTiming'
import { kuwaitDayKey } from '../../domain/time/kuwaitTime'

export interface PresenceView {
  id: string
  name: string
  nameAr: string | null
  role: UserRole
  isOnline: boolean
  lastSeenAt: Date | null
  onlineSecondsToday: number
}

export interface ListOnlinePresenceDeps {
  userRepository: UserRepository
  clock: Clock
}

// كان يقارن مفتاحًا بـUTC مع عمود يكتبه الـSQL بساعة القاعدة — ساعتان
// مختلفتان، ولا وحدة منهما الكويت
function isoDate(date: Date): string {
  return kuwaitDayKey(date)
}

export async function listOnlinePresence(
  actorRole: UserRole,
  deps: ListOnlinePresenceDeps
): Promise<PresenceView[]> {
  const users = await deps.userRepository.findAll()
  const now = deps.clock.now()
  const today = isoDate(now)

  return (
    users
      .filter((u) => u.active)
      // الأدمن العادي ما يشوف إذا المدير العام أونلاين أو لا — حتى وجوده بالقائمة مخفي
      .filter((u) => actorRole === 'super_admin' || u.role !== 'super_admin')
      .map((u) => ({
        id: u.id,
        name: u.name,
        nameAr: u.nameAr ?? null,
        role: u.role,
        isOnline: isOnlineNow(u.lastSeenAt, now),
        lastSeenAt: u.lastSeenAt,
        // إذا آخر يوم مسجّل مو اليوم، معناه ما فيه نبضة اليوم بعد — نعرض صفر بدل رقم أمس القديم
        onlineSecondsToday: u.onlineDay === today ? u.onlineSecondsToday : 0,
      }))
  )
}
