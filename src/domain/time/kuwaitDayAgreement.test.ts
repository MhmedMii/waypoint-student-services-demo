import { describe, it, expect } from 'vitest'
import { kuwaitCalendarDaysBetween, kuwaitDayKey, startOfKuwaitDay } from './kuwaitTime'
import { hasSignedInToday } from '../routing/counselorAbsence'
import { lastSeenDisplay } from '../../app/admin/accountsDisplay'

// الدالة تبي مترجم — نمرر واحدًا بسيطًا يرجّع المفتاح نفسه عشان نفحص الفرع لا النص
const t = ((_section: string, key: string) => key) as never

// اللحظتان الحاسمتان: ٠٠:٣٠ بالكويت (تاريخ UTC لسه أمس) و٢٣:٣٠ بالكويت
const KUWAIT_0030 = new Date('2026-09-22T21:30:00Z')
const KUWAIT_2330 = new Date('2026-09-23T20:30:00Z')

describe('every screen agrees on which Kuwait day it is', () => {
  it('reads 00:30 Kuwait as the new day, though UTC still says yesterday', () => {
    expect(kuwaitDayKey(KUWAIT_0030)).toBe('2026-09-23')
    expect(KUWAIT_0030.toISOString().slice(0, 10)).toBe('2026-09-22')
  })

  it('reads 23:30 Kuwait as that same day', () => {
    expect(kuwaitDayKey(KUWAIT_2330)).toBe('2026-09-23')
  })

  it('puts both inside one Kuwait day', () => {
    expect(startOfKuwaitDay(KUWAIT_0030).getTime()).toBe(startOfKuwaitDay(KUWAIT_2330).getTime())
    expect(kuwaitCalendarDaysBetween(KUWAIT_0030, KUWAIT_2330)).toBe(0)
  })
})

// البق: آخر ظهور أمس ١١ ليلاً، والآن العاشرة صباحًا. صفحة الحسابات كانت
// تقسم ١١ ساعة على يوم فتقول "اليوم"، والجرس يقول "ما سجّل دخول اليوم"
describe('Accounts and the bell answer the same question the same way', () => {
  const lastSeen = new Date('2026-09-22T20:00:00Z') // ١١ ليلاً بالكويت، ٢٢ سبتمبر
  const now = new Date('2026-09-23T07:00:00Z') // ١٠ صباحًا بالكويت، ٢٣ سبتمبر

  it('calls it yesterday on both screens, not today on one of them', () => {
    expect(hasSignedInToday(lastSeen, now)).toBe(false)
    expect(lastSeenDisplay(lastSeen, now, t).text).toBe('lastSeenYesterday')
  })

  it('still says today when the sign-in really was this Kuwait day', () => {
    const thisMorning = new Date('2026-09-23T05:00:00Z') // ٨ صباحًا بالكويت
    expect(hasSignedInToday(thisMorning, now)).toBe(true)
    expect(lastSeenDisplay(thisMorning, now, t).text).toBe('lastSeenToday')
  })

  // ٠٠:٣٠ بالكويت: نفس اليوم الكويتي، فالجواب "اليوم" على الشاشتين
  it('agrees just after Kuwait midnight, where UTC would disagree', () => {
    const justAfterMidnight = new Date('2026-09-22T21:10:00Z')
    expect(hasSignedInToday(justAfterMidnight, KUWAIT_0030)).toBe(true)
    expect(lastSeenDisplay(justAfterMidnight, KUWAIT_0030, t).text).toBe('lastSeenToday')
  })

  it('counts a genuine two-day gap as two days on both', () => {
    const twoDaysAgo = new Date('2026-09-21T07:00:00Z')
    expect(hasSignedInToday(twoDaysAgo, now)).toBe(false)
    expect(lastSeenDisplay(twoDaysAgo, now, t).text).toBe('lastSeenDaysAgo')
  })
})
