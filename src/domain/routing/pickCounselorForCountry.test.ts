import { describe, it, expect } from 'vitest'
import { pickCounselorForCountry, type CounselorCandidate } from './pickCounselorForCountry'

const demoCounselorOne: CounselorCandidate = {
  id: 'demoCounselorOne',
  scopes: ['USA', 'UK & Ireland'],
  lastAssignedAt: null,
}
const demoCounselorTwo: CounselorCandidate = {
  id: 'ali-al-ali',
  scopes: ['USA'],
  lastAssignedAt: null,
}
const demoCounselorThree: CounselorCandidate = {
  id: 'demoCounselorThree',
  scopes: ['UK & Ireland'],
  lastAssignedAt: null,
}
const demoCounselorSix: CounselorCandidate = {
  id: 'ali-mahmoud',
  scopes: ['GCC'],
  lastAssignedAt: null,
}
const demoCounselorSeven: CounselorCandidate = {
  id: 'demoCounselorSeven',
  scopes: ['GCC', 'Europe & Other Countries'],
  lastAssignedAt: null,
}
const all = [
  demoCounselorOne,
  demoCounselorTwo,
  demoCounselorThree,
  demoCounselorSix,
  demoCounselorSeven,
]

describe('pickCounselorForCountry', () => {
  it('only considers counselors who cover that country', () => {
    expect(pickCounselorForCountry(all, 'USA', null)?.id).toBe('ali-al-ali')
    expect(pickCounselorForCountry(all, 'GCC', null)?.id).toBe('ali-mahmoud')
  })

  it('takes the next USA counselor after the last one who got a USA client', () => {
    expect(pickCounselorForCountry(all, 'USA', 'ali-al-ali')?.id).toBe('demoCounselorOne')
    expect(pickCounselorForCountry(all, 'USA', 'demoCounselorOne')?.id).toBe('ali-al-ali')
  })

  it('keeps each country on its own cycle', () => {
    expect(pickCounselorForCountry(all, 'UK & Ireland', 'demoCounselorThree')?.id).toBe(
      'demoCounselorOne'
    )
    expect(pickCounselorForCountry(all, 'GCC', 'ali-mahmoud')?.id).toBe('demoCounselorSeven')
  })

  it('returns null when no counselor has that exact category scope', () => {
    expect(pickCounselorForCountry([demoCounselorSix], 'USA', null)).toBeNull()
  })
})
