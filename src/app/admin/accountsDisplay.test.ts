import { describe, it, expect } from 'vitest'
import { translations } from '../../i18n/translations'
import { activeFirst, lastSeenDisplay, scopeLabel, scopeSummary } from './accountsDisplay'

const t = ((section: string, key: string) => (translations.en as any)[section][key]) as Parameters<
  typeof scopeSummary
>[1]

const NOW = new Date('2026-09-20T12:00:00Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString()

describe('scopeSummary', () => {
  it('counts several scopes', () => {
    expect(scopeSummary(['USA', 'GCC', 'visa_services'], t)).toEqual({
      text: '3 scopes',
      isNone: false,
    })
  })

  it('says "1 scope", not "1 scopes"', () => {
    expect(scopeSummary(['USA'], t)).toEqual({ text: '1 scope', isNone: false })
  })

  // هذي الحالة اللي تفسّر "صفر عملاء": بلا تخصص ما يدخل بالتوزيع أصلاً
  it('flags a counselor with nothing set', () => {
    expect(scopeSummary([], t)).toEqual({ text: 'No scopes', isNone: true })
  })

  // صف بدون الحقل أصلاً ما يوقع الصفحة
  it('survives a row that arrived without the field', () => {
    expect(scopeSummary(undefined, t)).toEqual({ text: 'No scopes', isNone: true })
  })
})

describe('scopeLabel', () => {
  it('translates a country scope', () => {
    expect(scopeLabel('USA', t)).toBe(translations.en.countries.usa)
  })

  it('names the service scopes, which are not countries', () => {
    expect(scopeLabel('visa_services', t)).toBe('Visa services')
    expect(scopeLabel('exam_services', t)).toBe('Exam services')
  })
})

describe('lastSeenDisplay', () => {
  it('reads today and yesterday in words', () => {
    expect(lastSeenDisplay(daysAgo(0), NOW, t)).toEqual({ text: 'Today', isStale: false })
    expect(lastSeenDisplay(daysAgo(1), NOW, t)).toEqual({ text: 'Yesterday', isStale: false })
  })

  it('counts days, and turns stale at a week', () => {
    expect(lastSeenDisplay(daysAgo(6), NOW, t)).toEqual({ text: '6 days ago', isStale: false })
    expect(lastSeenDisplay(daysAgo(7), NOW, t)).toEqual({ text: '7 days ago', isStale: true })
  })

  // الأرقام اللي شافها فعلاً بالفريق
  it.each([19, 25, 31])('flags %i days as stale', (days) => {
    expect(lastSeenDisplay(daysAgo(days), NOW, t)).toEqual({
      text: `${days} days ago`,
      isStale: true,
    })
  })

  it('treats someone who never signed in as stale, not as today', () => {
    expect(lastSeenDisplay(null, NOW, t)).toEqual({ text: 'Never', isStale: true })
  })

  it('does not report a negative age if the clock disagrees', () => {
    expect(lastSeenDisplay(new Date(NOW.getTime() + 60000), NOW, t).text).toBe('Today')
  })
})

describe('activeFirst', () => {
  it('sinks inactive accounts below the active ones, keeping each group in order', () => {
    const users = [
      { name: 'Demo Counselor F', active: false },
      { name: 'Ali', active: true },
      { name: 'Demo Counselor E', active: false },
      { name: 'Omar', active: true },
    ]
    expect(activeFirst(users).map((u) => u.name)).toEqual([
      'Ali',
      'Omar',
      'Demo Counselor F',
      'Demo Counselor E',
    ])
  })

  it('leaves the original array untouched', () => {
    const users = [{ active: false }, { active: true }]
    activeFirst(users)
    expect(users[0].active).toBe(false)
  })
})
