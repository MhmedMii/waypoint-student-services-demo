import { describe, it, expect } from 'vitest'
import { defaultFollowUpDueDate, DEFAULT_FOLLOW_UP_WORKING_DAYS } from './defaultFollowUpDueDate'
import { isKuwaitWorkingDay } from './workingDaysSinceLastSeen'

// كل الأوقات تحت بـ UTC، والتعليق يقول اليوم المقابل بالكويت (+3)
describe('defaultFollowUpDueDate', () => {
  it('suggests three working days ahead from a Sunday', () => {
    // الأحد ٢٠ سبتمبر ١٠ص بالكويت
    expect(defaultFollowUpDueDate(new Date('2026-09-20T07:00:00Z'))).toBe('2026-09-23')
  })

  // البق الأول: الأربعاء + ٣ أيام تقويم = السبت، وهو عطلة بالكويت. المتابعة
  // تصير متأخرة قبل ما يشوفها أحد، وترفع عدّاد المتأخرات باللوحة
  it('never lands on a Friday or Saturday', () => {
    const wednesday = new Date('2026-09-23T07:00:00Z')
    expect(defaultFollowUpDueDate(wednesday)).toBe('2026-09-28')

    for (let day = 0; day < 14; day++) {
      const from = new Date(Date.UTC(2026, 8, 20 + day, 7, 0, 0))
      const due = defaultFollowUpDueDate(from)
      expect(isKuwaitWorkingDay(new Date(`${due}T09:00:00Z`))).toBe(true)
    }
  })

  // البق الثاني: كان يجمع بالتوقيت المحلي ويقرأ بـ UTC، فبين منتصف الليل
  // والثالثة فجراً بالكويت يطلع اليوم اللي قبله — والدالة تُنادى من المتصفح
  it('does not slip a day between midnight and 3am Kuwait', () => {
    // ٢١:٣٠ UTC = ٠٠:٣٠ من يوم الخميس ٢٤ بالكويت
    const justAfterKuwaitMidnight = new Date('2026-09-23T21:30:00Z')
    // ١٠ص من نفس اليوم الكويتي
    const sameKuwaitDayMorning = new Date('2026-09-24T07:00:00Z')

    expect(defaultFollowUpDueDate(justAfterKuwaitMidnight)).toBe(
      defaultFollowUpDueDate(sameKuwaitDayMorning)
    )
  })

  it('treats 11pm Kuwait and 1am Kuwait as different days, as they are', () => {
    // ٢٠:٠٠ UTC = ١١م الأربعاء ٢٣ بالكويت
    const lateWednesday = new Date('2026-09-23T20:00:00Z')
    // ٢٢:٠٠ UTC = ١ص الخميس ٢٤ بالكويت
    const earlyThursday = new Date('2026-09-23T22:00:00Z')

    expect(defaultFollowUpDueDate(lateWednesday)).toBe('2026-09-28')
    expect(defaultFollowUpDueDate(earlyThursday)).toBe('2026-09-29')
  })

  it('skips the weekend rather than counting through it', () => {
    // الثلاثاء ٢٢: الأربعاء والخميس يومان، ثم الجمعة والسبت ما ينعدّون، فالأحد هو الثالث
    expect(defaultFollowUpDueDate(new Date('2026-09-22T07:00:00Z'))).toBe('2026-09-27')
  })

  it('counts from a weekend day too, without crediting it', () => {
    // الجمعة ٢٥ سبتمبر — أول يوم دوام بعدها الأحد ٢٧
    expect(defaultFollowUpDueDate(new Date('2026-09-25T07:00:00Z'))).toBe('2026-09-29')
  })

  it('crosses a month boundary correctly', () => {
    // الاثنين ٢٨ سبتمبر -> الخميس ١ أكتوبر
    expect(defaultFollowUpDueDate(new Date('2026-09-28T07:00:00Z'))).toBe('2026-10-01')
  })

  it('always returns a plain calendar date', () => {
    expect(defaultFollowUpDueDate(new Date('2026-09-20T07:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('advances by the number of working days it says it does', () => {
    expect(DEFAULT_FOLLOW_UP_WORKING_DAYS).toBe(3)
  })
})
