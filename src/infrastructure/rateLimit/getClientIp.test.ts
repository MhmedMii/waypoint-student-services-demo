import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { getClientIp, clientIpFromForwardedFor } from './getClientIp'

function requestWith(headers: Record<string, string>) {
  return new NextRequest('http://localhost/api/visits/new', { method: 'POST', headers })
}

describe('getClientIp', () => {
  it('takes the first address in the chain', () => {
    expect(getClientIp(requestWith({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe(
      '203.0.113.7'
    )
  })

  it('trims the whitespace proxies leave behind', () => {
    expect(getClientIp(requestWith({ 'x-forwarded-for': '  203.0.113.7  ,10.0.0.1' }))).toBe(
      '203.0.113.7'
    )
  })

  it('handles a single address with no chain', () => {
    expect(getClientIp(requestWith({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  // بدون الهيدر ما نعرف مين — والمنادي ما يحظر على 'unknown'، لأنها سلة
  // واحدة يتشاركها الجميع فحظرها يحظر كل الناس سوا
  it('says unknown when there is no header, rather than inventing a shared bucket', () => {
    expect(getClientIp(requestWith({}))).toBe('unknown')
  })
})
// النواة المشتركة: تستقبل القيمة الخام من أي مصدر — NextRequest أو كائن
// الهيدرز اللي يمرّره NextAuth لتسجيل الدخول
describe('clientIpFromForwardedFor', () => {
  it('takes the first address from a string', () => {
    expect(clientIpFromForwardedFor('203.0.113.7, 10.0.0.1')).toBe('203.0.113.7')
  })

  // النسخة القديمة بتسجيل الدخول كانت ترجّع 'unknown' هنا — فيطفي حد الـ IP
  it('takes the first address of the first line when the header is a list', () => {
    expect(clientIpFromForwardedFor(['203.0.113.7, 10.0.0.1', '198.51.100.2'])).toBe('203.0.113.7')
  })

  it('says unknown for a missing header', () => {
    expect(clientIpFromForwardedFor(undefined)).toBe('unknown')
    expect(clientIpFromForwardedFor(null)).toBe('unknown')
  })

  it('says unknown for an empty list', () => {
    expect(clientIpFromForwardedFor([])).toBe('unknown')
  })

  // كانت ترجّع "" — وهذي تعدّي فحص 'unknown' وتصير مفتاح حظر مشترك
  it.each(['', '   ', ',', ' , 10.0.0.1'])('says unknown, not an empty key, for %j', (value) => {
    expect(clientIpFromForwardedFor(value)).toBe('unknown')
  })

  it('says unknown for a value that is not text at all', () => {
    expect(clientIpFromForwardedFor(42)).toBe('unknown')
    expect(clientIpFromForwardedFor({})).toBe('unknown')
  })
})

describe('getClientIp — an empty first entry', () => {
  it('reports unknown rather than an empty string', () => {
    expect(getClientIp(requestWith({ 'x-forwarded-for': ' , 10.0.0.1' }))).toBe('unknown')
  })
})
