import type { Shift } from './user'

// نفس قائمة الدول والفئات اللي تظهر بفورم الاستقبال (desiredCountry) بالضبط —
// نطاق تخصص المستشار الآن يطابق فئة بعينها، مو فئة عريضة
export const COUNTRY_SCOPES = [
  'Medicine',
  'USA',
  'UK & Ireland',
  'Australia & New Zealand',
  'Europe & Other Countries',
  'GCC',
  'Egypt',
] as const
export type CountryScope = (typeof COUNTRY_SCOPES)[number]

export type SpecializationScope = CountryScope | 'visa_services' | 'exam_services'

export interface CounselorCandidate {
  id: string
  scopes: SpecializationScope[]
  lastAssignedAt: Date | null
  shift?: Shift | null
  // آخر ظهور: بدونه التوزيع أعمى عن الحضور تمامًا، فيعطي عميل لمستشار غايب
  lastSeenAt?: Date | null
}
