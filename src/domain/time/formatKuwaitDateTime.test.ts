import { describe, it, expect } from 'vitest'
import { formatKuwaitDateTime, formatKuwaitDate } from './formatKuwaitDateTime'

describe('formatKuwaitDateTime', () => {
  // البق: كل ختم بكل ملف إكسل كان أقدم بثلاث ساعات، ورقم معقول ما ينتبه له أحد
  it('renders a known instant in Kuwait time, not UTC', () => {
    expect(formatKuwaitDateTime(new Date('2026-09-23T10:05:09Z'))).toBe('Sep 23, 2026, 1:05:09 PM')
  })

  it('is exactly three hours ahead of what UTC would have shown', () => {
    const instant = new Date('2026-09-23T06:00:00Z')
    expect(formatKuwaitDateTime(instant)).toContain('9:00:00 AM')
    expect(instant.toISOString()).toContain('06:00')
  })

  // نافذة منتصف الليل لين الثالثة: التاريخ نفسه يختلف، مو الساعة بس
  it('gives the next day for an instant that is already tomorrow in Kuwait', () => {
    // ٢١:٣٠ UTC = ٠٠:٣٠ من اليوم التالي بالكويت
    expect(formatKuwaitDateTime(new Date('2026-09-23T21:30:00Z'))).toBe('Sep 24, 2026, 12:30:00 AM')
  })

  it('rolls the year at that same boundary', () => {
    expect(formatKuwaitDateTime(new Date('2026-12-31T21:30:00Z'))).toBe('Jan 1, 2027, 12:30:00 AM')
  })

  it('writes noon and midnight as 12, not 0', () => {
    expect(formatKuwaitDateTime(new Date('2026-09-23T09:00:00Z'))).toContain('12:00:00 PM')
    expect(formatKuwaitDateTime(new Date('2026-09-23T21:00:00Z'))).toContain('12:00:00 AM')
  })

  // النسختان القديمتان اختلفتا: وحدة تطبع الثواني والثانية لا. قررنا الثواني،
  // لأن سجل النشاط دفتر مراجعة وحدثان بنفس الدقيقة يحتاجان ترتيبًا
  it('always includes seconds, so two events in one minute stay ordered', () => {
    expect(formatKuwaitDateTime(new Date('2026-09-23T10:05:09Z'))).toContain(':09 ')
    expect(formatKuwaitDateTime(new Date('2026-09-23T10:05:41Z'))).toContain(':41 ')
  })

  it('pads minutes and seconds', () => {
    expect(formatKuwaitDateTime(new Date('2026-09-23T10:05:07Z'))).toBe('Sep 23, 2026, 1:05:07 PM')
  })
})

describe('formatKuwaitDate', () => {
  it('gives the Kuwait calendar date', () => {
    expect(formatKuwaitDate(new Date('2026-09-23T10:00:00Z'))).toBe('2026-09-23')
  })

  // كان toISOString().slice(0,10)، وهذا يقدّم اليوم كامل بهالنافذة
  it('does not report yesterday for an instant just after Kuwait midnight', () => {
    const justAfterMidnight = new Date('2026-09-23T21:30:00Z')
    expect(formatKuwaitDate(justAfterMidnight)).toBe('2026-09-24')
    expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-09-23')
  })

  it('pads a single-digit month and day', () => {
    expect(formatKuwaitDate(new Date('2026-01-05T10:00:00Z'))).toBe('2026-01-05')
  })
})
