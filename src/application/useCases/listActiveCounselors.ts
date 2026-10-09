import type { UserRepository } from '../ports/UserRepository'
import type { Clock } from '../ports/Clock'
import { isCounselorVisibleNow } from '../../domain/time/isCounselorVisibleNow'

export interface ActiveCounselorView {
  id: string
  name: string
  nameAr: string | null
}

export interface ListActiveCounselorsDeps {
  userRepository: UserRepository
  clock: Clock
}

// نرجع بس id والاسم — ما نحتاج نرسل بيانات المستخدم الكاملة لدروب داون بسيط
// ونستبعد المستشارين المسائيين وقت ما يكونون خارج دوامهم المسموح بالفرونت ديسك
export async function listActiveCounselors(
  deps: ListActiveCounselorsDeps
): Promise<ActiveCounselorView[]> {
  const counselors = await deps.userRepository.findActiveCounselors()
  const now = deps.clock.now()
  return counselors
    .filter((counselor) => isCounselorVisibleNow(counselor.shift, now))
    .map((counselor) => ({
      id: counselor.id,
      name: counselor.name,
      nameAr: counselor.nameAr ?? null,
    }))
}
