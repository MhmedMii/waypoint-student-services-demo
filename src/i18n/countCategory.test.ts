import { describe, it, expect } from 'vitest'
import { countCategory } from './countCategory'

describe('countCategory', () => {
  it('separates one from everything else', () => {
    expect(countCategory(1)).toBe('one')
  })

  // المثنى صيغة مستقلة بالعربي — "شخصان"، مو "٢ أشخاص"
  it('gives two its own form, which Arabic needs and English does not', () => {
    expect(countCategory(2)).toBe('two')
  })

  it('treats three to ten as the plural of few', () => {
    for (const n of [3, 4, 7, 10]) expect(countCategory(n)).toBe('few')
  })

  // من ١١ وفوق يرجع العربي للمفرد المنصوب: "١١ شخصًا"
  it('returns to the singular past ten, as Arabic does', () => {
    for (const n of [11, 15, 99, 100]) expect(countCategory(n)).toBe('many')
  })

  it('counts zero with the plural', () => {
    expect(countCategory(0)).toBe('few')
  })
})
