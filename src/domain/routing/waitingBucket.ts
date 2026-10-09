import { hasSignedInToday, isCounselorAbsent } from './counselorAbsence'

// ليش عميل قاعد ينتظر. الجرس يعدّ بهذي، وصفحة الزيارات تفلتر بنفسها — رابط
// "٧٨ عميل" لازم يودّيك لنفس الـ٧٨ بالضبط، مو لعيّنة منهم
export type WaitingBucket = 'unassigned' | 'unknownCounselor' | 'absent' | 'quiet' | 'attended'

export const WAITING_BUCKETS: WaitingBucket[] = [
  'unassigned',
  'unknownCounselor',
  'absent',
  'quiet',
  'attended',
]

export function isWaitingBucket(value: string): value is WaitingBucket {
  return (WAITING_BUCKETS as string[]).includes(value)
}

// null = ما فيه مستشار على الزيارة. undefined = فيه معرّف بس ما لقينا الصف —
// حساب محذوف. الثاني أسوأ حالة ممكنة للعميل، فلازم يكون له اسم بدل ما ينسقط
export function waitingBucket(
  counselor: { lastSeenAt: Date | null } | null | undefined,
  now: Date
): WaitingBucket {
  if (counselor === null) return 'unassigned'
  if (counselor === undefined) return 'unknownCounselor'
  if (isCounselorAbsent(counselor.lastSeenAt, now)) return 'absent'
  if (!hasSignedInToday(counselor.lastSeenAt, now)) return 'quiet'
  return 'attended'
}
