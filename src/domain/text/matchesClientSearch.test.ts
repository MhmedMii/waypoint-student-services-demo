import { describe, it, expect } from 'vitest'
import { matchesClientSearch } from './matchesClientSearch'

const row = ['Sample Client One', '50000001', 'VISA-0016']

describe('matchesClientSearch', () => {
  it('matches any of the fields it is given', () => {
    expect(matchesClientSearch(row, 'sample')).toBe(true)
    expect(matchesClientSearch(row, '50000001')).toBe(true)
    expect(matchesClientSearch(row, 'visa-0016')).toBe(true)
  })

  it('matches part of a phone number, since the row is already on screen', () => {
    expect(matchesClientSearch(row, '0001')).toBe(true)
    expect(matchesClientSearch(row, '16')).toBe(true)
  })

  it('folds Arabic spellings the same way the visits search does', () => {
    expect(matchesClientSearch(['أمل هارت'], 'امل')).toBe(true)
    expect(matchesClientSearch(['فاطمة السالم'], 'فاطمه')).toBe(true)
    expect(matchesClientSearch(['يحيى'], 'يحيي')).toBe(true)
    expect(matchesClientSearch(['أحمد'], 'احلام')).toBe(false)
  })

  it('shows everything when the box is empty or only spaces', () => {
    expect(matchesClientSearch(row, '')).toBe(true)
    expect(matchesClientSearch(row, '   ')).toBe(true)
  })

  it('ignores empty fields instead of matching them', () => {
    expect(matchesClientSearch([null, undefined, ''], 'anything')).toBe(false)
  })

  it('does not match a different client', () => {
    expect(matchesClientSearch(row, 'nobody')).toBe(false)
  })
})
