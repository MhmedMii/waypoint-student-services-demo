import { describe, it, expect } from 'vitest'
import { isKuwaitWorkingDay, workingDaysSinceLastSeen } from './workingDaysSinceLastSeen'

// كلها بتوقيت الكويت (UTC+3): 09:00 بالكويت = 06:00Z
const at = (iso: string) => new Date(iso)
const THU_AFTERNOON = at('2026-09-17T12:00:00Z') // الخميس 3 عصرًا بالكويت
const SUN_MORNING = at('2026-09-20T06:00:00Z') // الأحد 9 صباحًا
const MON_MORNING = at('2026-09-21T06:00:00Z') // الاثنين 9 صباحًا

describe('workingDaysSinceLastSeen', () => {
  // السبب الأساسي: بالأيام التقويمية هذي 2.7 يوم، فيطلع الكل غايبين صبح الأحد
  it('counts Thursday to Sunday as one working day, not three', () => {
    expect(workingDaysSinceLastSeen(THU_AFTERNOON, SUN_MORNING)).toBe(1)
  })

  it('counts Thursday to Monday as two working days', () => {
    expect(workingDaysSinceLastSeen(THU_AFTERNOON, MON_MORNING)).toBe(2)
  })

  it('counts nothing for the same day, however many hours apart', () => {
    expect(workingDaysSinceLastSeen(at('2026-09-20T05:00:00Z'), at('2026-09-20T17:00:00Z'))).toBe(0)
  })

  it('counts one for yesterday within the working week', () => {
    expect(workingDaysSinceLastSeen(SUN_MORNING, MON_MORNING)).toBe(1)
  })

  it('does not count the weekend itself', () => {
    // الخميس إلى السبت: الجمعة والسبت عطلة، فصفر أيام دوام
    expect(workingDaysSinceLastSeen(THU_AFTERNOON, at('2026-09-19T06:00:00Z'))).toBe(0)
  })

  it('counts a full working week as five', () => {
    // الأحد إلى الأحد اللي بعده: أحد إلى خميس (٤) + الأحد الجديد = ٥
    expect(workingDaysSinceLastSeen(SUN_MORNING, at('2026-09-27T06:00:00Z'))).toBe(5)
  })

  it('treats someone who never signed in as unknown, not as present', () => {
    expect(workingDaysSinceLastSeen(null, MON_MORNING)).toBeNull()
  })

  it('does not go negative when the clock disagrees', () => {
    expect(workingDaysSinceLastSeen(MON_MORNING, SUN_MORNING)).toBe(0)
  })

  it('uses the Kuwait day, so late Thursday evening is still Thursday', () => {
    // 22:00Z الخميس = 1 صباحًا الجمعة بالكويت — يعني دخل بالعطلة فعليًا
    expect(workingDaysSinceLastSeen(at('2026-09-17T22:00:00Z'), SUN_MORNING)).toBe(1)
  })
})

describe('isKuwaitWorkingDay', () => {
  it.each([
    ['2026-09-20T06:00:00Z', true], // الأحد
    ['2026-09-21T06:00:00Z', true], // الاثنين
    ['2026-09-17T06:00:00Z', true], // الخميس
    ['2026-09-18T06:00:00Z', false], // الجمعة
    ['2026-09-19T06:00:00Z', false], // السبت
  ])('%s -> %s', (iso, expected) => {
    expect(isKuwaitWorkingDay(new Date(iso))).toBe(expected)
  })
})
