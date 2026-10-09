import { describe, it, expect } from 'vitest'
import { ABSENT_AFTER_WORKING_DAYS, isCounselorAbsent, hasSignedInToday } from './counselorAbsence'

const at = (iso: string) => new Date(iso)
const SUN_MORNING = at('2026-09-20T06:00:00Z')
const MON_MORNING = at('2026-09-21T06:00:00Z')
const THU_AFTERNOON = at('2026-09-17T12:00:00Z')

describe('isCounselorAbsent', () => {
  it('uses five working days — a full working week', () => {
    expect(ABSENT_AFTER_WORKING_DAYS).toBe(5)
  })

  // الحالة اللي كانت بتفجّر التنبيه كل أحد الصبح
  it('does not call everyone absent on Sunday morning after the weekend', () => {
    expect(isCounselorAbsent(THU_AFTERNOON, SUN_MORNING)).toBe(false)
  })

  // الحالة اللي كانت بتفجّر التنبيه كل ثلاثاء: فريق داوم الأحد وما فتح
  // التطبيق الاثنين — بيومين كان يصير كله غايب وكل عميل بدون مستشار
  it('still assigns on Tuesday to someone last seen on Sunday', () => {
    expect(isCounselorAbsent(SUN_MORNING, at('2026-09-22T06:00:00Z'))).toBe(false)
  })

  it('holds on through four working days', () => {
    // الخميس ١٧ ← الأربعاء ٢٣ = ٤ أيام دوام (الجمعة والسبت ما تنحسب)
    expect(isCounselorAbsent(THU_AFTERNOON, at('2026-09-23T06:00:00Z'))).toBe(false)
  })

  it('calls someone absent on the fifth working day, not before', () => {
    // الخميس ١٧ ← الخميس ٢٤ = ٥ أيام دوام بالضبط
    expect(isCounselorAbsent(THU_AFTERNOON, at('2026-09-24T06:00:00Z'))).toBe(true)
  })

  it('treats a counselor who has never signed in as absent', () => {
    expect(isCounselorAbsent(null, MON_MORNING)).toBe(true)
  })

  it('treats someone seen today or yesterday as present', () => {
    expect(isCounselorAbsent(MON_MORNING, MON_MORNING)).toBe(false)
    expect(isCounselorAbsent(SUN_MORNING, MON_MORNING)).toBe(false)
  })

  it('treats a long absence as absent', () => {
    expect(isCounselorAbsent(at('2026-09-01T06:00:00Z'), MON_MORNING)).toBe(true)
  })
})

describe('hasSignedInToday', () => {
  it('is true for someone seen earlier the same Kuwait day', () => {
    // ٦ صباحاً و١١ صباحاً بتوقيت UTC = نفس يوم الاثنين بالكويت
    expect(hasSignedInToday(MON_MORNING, at('2026-09-21T11:00:00Z'))).toBe(true)
  })

  it('is false for someone seen yesterday, however recently', () => {
    // ١١ ليلاً بتوقيت الكويت أمس = ٨ مساءً UTC، وبعدها بساعتين يوم جديد
    expect(hasSignedInToday(at('2026-09-20T20:00:00Z'), at('2026-09-20T22:00:00Z'))).toBe(false)
  })

  // الحدود بتوقيت الكويت مو UTC: ١٠ مساءً UTC هو ١ فجراً بالكويت من اليوم التالي
  it('rolls over at Kuwait midnight, not UTC midnight', () => {
    const justAfterKuwaitMidnight = at('2026-09-20T21:30:00Z')
    const justBefore = at('2026-09-20T20:30:00Z')
    expect(hasSignedInToday(justAfterKuwaitMidnight, at('2026-09-20T22:00:00Z'))).toBe(true)
    expect(hasSignedInToday(justBefore, at('2026-09-20T22:00:00Z'))).toBe(false)
  })

  it('is false for someone who has never signed in', () => {
    expect(hasSignedInToday(null, MON_MORNING)).toBe(false)
  })
})
