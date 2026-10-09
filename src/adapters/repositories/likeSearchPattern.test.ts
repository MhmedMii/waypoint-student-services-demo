import { describe, it, expect } from 'vitest'
import { escapeLikeWildcards } from './likeSearchPattern'

describe('escapeLikeWildcards', () => {
  // البق: % وحدها كانت تطابق كل صف بالجدول
  it('escapes the percent sign that used to match every row', () => {
    expect(escapeLikeWildcards('%')).toBe('\\%')
  })

  it('escapes the underscore that matches any single character', () => {
    expect(escapeLikeWildcards('_')).toBe('\\_')
  })

  it('escapes a backslash so it cannot cancel the escaping itself', () => {
    expect(escapeLikeWildcards('\\')).toBe('\\\\')
  })

  // الباكسلاش لازم يتهرّب أول، وإلا هرّبنا الباكسلاش اللي ضفناه بأنفسنا
  it('does not double-escape what it just added', () => {
    expect(escapeLikeWildcards('\\%')).toBe('\\\\\\%')
  })

  it('leaves an ordinary name untouched', () => {
    expect(escapeLikeWildcards('mohammed demoCounselorOne')).toBe('mohammed demoCounselorOne')
  })

  it('leaves an Arabic name untouched', () => {
    expect(escapeLikeWildcards('مستشار تجريبي أول')).toBe('مستشار تجريبي أول')
  })

  it('escapes every wildcard in a mixed term', () => {
    expect(escapeLikeWildcards('a%b_c')).toBe('a\\%b\\_c')
  })
})
