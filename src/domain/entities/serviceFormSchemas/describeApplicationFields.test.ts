import { describe, it, expect } from 'vitest'
import { describeApplicationFields } from './describeApplicationFields'

describe('describeApplicationFields', () => {
  it('labels and values default to English', () => {
    const answers = describeApplicationFields('ielts', {
      email: 'a@example.com',
      'test-type': 'Academic',
    })
    expect(answers).toEqual([
      { label: 'Email', value: 'a@example.com' },
      { label: 'Type of test', value: 'Academic' },
    ])
  })

  it('translates the field label in Arabic mode', () => {
    const answers = describeApplicationFields('ielts', { email: 'a@example.com' }, 'ar')
    expect(answers).toEqual([{ label: 'البريد الإلكتروني', value: 'a@example.com' }])
  })

  it('reverse-maps a select value to its Arabic option in Arabic mode', () => {
    const answers = describeApplicationFields('ielts', { 'test-type': 'Academic' }, 'ar')
    expect(answers).toEqual([{ label: 'نوع الاختبار', value: 'أكاديمي' }])
  })

  it('translates a radio Yes/No value in Arabic mode', () => {
    const answers = describeApplicationFields('ielts', { 'registered-ielts-before': 'Yes' }, 'ar')
    expect(answers).toEqual([{ label: 'هل سبق وسجلت في آيلتس من قبل؟', value: 'نعم' }])
  })

  it('leaves free-text values (no options) untouched in Arabic mode', () => {
    const answers = describeApplicationFields('ielts', { address: 'Salmiya, Kuwait' }, 'ar')
    expect(answers).toEqual([{ label: 'العنوان', value: 'Salmiya, Kuwait' }])
  })

  it('translates a repeat-group label in Arabic mode', () => {
    const rows = JSON.stringify([{ date: '2026-01-01', length: '2 weeks' }])
    const answers = describeApplicationFields('uk-student', { 'uk-visits': rows }, 'ar')
    expect(answers).toEqual([{ label: 'آخر 3 زيارات لبريطانيا #1', value: '2026-01-01 — 2 weeks' }])
  })

  it('falls back to the raw id when no field def matches', () => {
    const answers = describeApplicationFields('ielts', { 'unknown-field': 'x' })
    expect(answers).toEqual([{ label: 'unknown-field', value: 'x' }])
  })

  it('skips empty values', () => {
    const answers = describeApplicationFields('ielts', { email: '', address: 'x' })
    expect(answers).toEqual([{ label: 'Address', value: 'x' }])
  })
})
