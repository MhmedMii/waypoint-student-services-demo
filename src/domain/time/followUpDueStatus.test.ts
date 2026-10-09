import { describe, it, expect } from 'vitest'
import { followUpDueStatus } from './followUpDueStatus'

describe('followUpDueStatus', () => {
  it('reports "today" when the due date is today, Kuwait time', () => {
    const dueAt = new Date('2026-09-19T05:00:00Z')
    const now = new Date('2026-09-19T14:00:00Z')
    expect(followUpDueStatus(dueAt, now)).toEqual({ kind: 'today' })
  })

  // كان يتوقع ٣ — أيام تقويم. مستحقة الأربعاء ١٦ ومعروضة السبت ١٩: الخميس
  // وحده يوم دوام، والجمعة والسبت عطلة. التست كان يثبّت الخلل نفسه
  it('reports "overdue" counted in working days, not calendar days', () => {
    const dueAt = new Date('2026-09-16T05:00:00Z')
    const now = new Date('2026-09-19T14:00:00Z')
    expect(followUpDueStatus(dueAt, now)).toEqual({ kind: 'overdue', daysOverdue: 1 })
  })

  it('reports "upcoming" for a future date', () => {
    const dueAt = new Date('2026-09-25T05:00:00Z')
    const now = new Date('2026-09-19T14:00:00Z')
    expect(followUpDueStatus(dueAt, now)).toEqual({ kind: 'upcoming' })
  })

  // 9م UTC = منتصف الليل بالكويت (اليوم القادم) — نفس منطق حدود اليوم
  // المستخدم بباقي التطبيق (kuwaitTime.ts)
  it('uses the Kuwait day boundary, not UTC midnight', () => {
    const dueAt = new Date('2026-09-19T00:00:00Z')
    const now = new Date('2026-09-18T22:00:00Z')
    expect(followUpDueStatus(dueAt, now)).toEqual({ kind: 'today' })
  })
})

// كل الأوقات UTC، والتعليق يقول اليوم المقابل بالكويت (+3). سبتمبر ٢٠٢٦:
// ٢٣ أربعاء، ٢٤ خميس، ٢٥ جمعة، ٢٦ سبت، ٢٧ أحد
describe('followUpDueStatus — overdue is counted in working days', () => {
  const SUNDAY_27 = new Date('2026-09-27T07:00:00Z') // ١٠ صباحًا بالكويت
  const THURSDAY_24 = new Date('2026-09-24T09:00:00Z')
  const WEDNESDAY_23 = new Date('2026-09-23T09:00:00Z')

  // البق: كان يقول ٣ أيام، والجمعة والسبت ما فيهما دوام
  it('says one working day for a Thursday due date seen on Sunday', () => {
    const status = followUpDueStatus(THURSDAY_24, SUNDAY_27)
    expect(status.kind).toBe('overdue')
    if (status.kind === 'overdue') expect(status.daysOverdue).toBe(1)
  })

  it('says two for a Wednesday due date seen on Sunday', () => {
    const status = followUpDueStatus(WEDNESDAY_23, SUNDAY_27)
    expect(status.kind).toBe('overdue')
    if (status.kind === 'overdue') expect(status.daysOverdue).toBe(2)
  })

  it('is not overdue when it is due today', () => {
    expect(followUpDueStatus(new Date('2026-09-27T05:00:00Z'), SUNDAY_27).kind).toBe('today')
  })

  it('is upcoming when the date has not arrived', () => {
    expect(followUpDueStatus(new Date('2026-09-28T09:00:00Z'), SUNDAY_27).kind).toBe('upcoming')
  })

  // الجمعة بعد استحقاق الخميس: فات الموعد بس ما مرّ يوم دوام
  it('reports zero working days on the weekend right after the due date', () => {
    const friday = new Date('2026-09-25T09:00:00Z')
    const status = followUpDueStatus(THURSDAY_24, friday)
    expect(status.kind).toBe('overdue')
    if (status.kind === 'overdue') expect(status.daysOverdue).toBe(0)
  })

  it('does not count the weekend itself as elapsed working days', () => {
    const saturday = new Date('2026-09-26T09:00:00Z')
    const status = followUpDueStatus(THURSDAY_24, saturday)
    if (status.kind === 'overdue') expect(status.daysOverdue).toBe(0)
  })

  // ٠٠:٣٠ بالكويت: تاريخ UTC لسه أمس، فحدود اليوم لازم تكون كويتية
  it('treats 00:30 Kuwait as the new day', () => {
    // ٢١:٣٠ UTC يوم ٢٦ = ٠٠:٣٠ الأحد ٢٧ بالكويت
    const justAfterKuwaitMidnight = new Date('2026-09-26T21:30:00Z')
    const status = followUpDueStatus(THURSDAY_24, justAfterKuwaitMidnight)
    expect(status.kind).toBe('overdue')
    if (status.kind === 'overdue') expect(status.daysOverdue).toBe(1)
  })

  it('still calls a same-day follow-up due today at 00:30 Kuwait', () => {
    const justAfterKuwaitMidnight = new Date('2026-09-26T21:30:00Z')
    expect(followUpDueStatus(justAfterKuwaitMidnight, justAfterKuwaitMidnight).kind).toBe('today')
  })
})
