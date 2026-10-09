import { describe, it, expect } from 'vitest'
import { isPhoneSearch, matchesName, normalizeSearchText } from './normalizeSearchText'

describe('normalizeSearchText', () => {
  it.each([
    ['أحمد', 'احمد'],
    ['إبراهيم', 'ابراهيم'],
    ['آمنة', 'امنه'],
    ['فاطمة', 'فاطمه'],
    ['يحيى', 'يحيي'],
    ['مؤمن', 'مومن'],
    ['رئيس', 'رييس'],
  ])('folds %s to %s', (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected)
  })

  it('drops tashkeel and tatweel', () => {
    expect(normalizeSearchText('مُحَمَّد')).toBe('محمد')
    expect(normalizeSearchText('محـــمد')).toBe('محمد')
  })

  it('reads Arabic-Indic digits as 0-9, so a phone typed either way works', () => {
    expect(normalizeSearchText('٥٠٠٠٠٠٠١')).toBe('50000001')
  })

  it('lowercases Latin text and trims spaces', () => {
    expect(normalizeSearchText('  Sample CLIENT  ')).toBe('sample client')
  })
})

describe('matchesName', () => {
  it.each([
    ['احمد', 'أحمد'],
    ['فاطمه', 'فاطمة'],
    ['يحيي', 'يحيى'],
    ['محمد', 'مُحَمَّد'],
  ])('finds %s when %s is typed, however each was written', (stored, typed) => {
    expect(matchesName(stored, typed)).toBe(true)
  })

  it('matches part of a name', () => {
    expect(matchesName('Sample Client One', 'client')).toBe(true)
    expect(matchesName('عبدالله الاحمد', 'الأحمد')).toBe(true)
  })

  it('does not match a different name', () => {
    expect(matchesName('احلام', 'أحمد')).toBe(false)
    expect(matchesName('سعد', 'سعاد')).toBe(false)
  })
})

describe('isPhoneSearch', () => {
  it('treats a full 8-digit number as a phone search, in either digit form', () => {
    expect(isPhoneSearch('50000001')).toBe(true)
    expect(isPhoneSearch('٥٠٠٠٠٠٠١')).toBe(true)
    expect(isPhoneSearch(' 50000001 ')).toBe(true)
  })

  it('treats anything else as a name search', () => {
    for (const term of ['5000', '500000012', 'أحمد', 'Sample', '5000000a', '']) {
      expect(isPhoneSearch(term)).toBe(false)
    }
  })
})
