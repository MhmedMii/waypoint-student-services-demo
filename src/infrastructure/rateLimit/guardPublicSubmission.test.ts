import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const holder = vi.hoisted(() => ({
  ipBlocked: false,
  phoneBlocked: false,
  ipRecorded: [] as string[],
  phoneRecorded: [] as string[],
}))

vi.mock('./ipSubmissionRateLimiter', () => ({
  isIpSubmissionRateLimited: async () => holder.ipBlocked,
  recordSubmissionAttempt: async (ip: string) => {
    holder.ipRecorded.push(ip)
  },
}))
vi.mock('./repeatSubmitterLimiter', () => ({
  isRepeatSubmitterBlocked: async () => holder.phoneBlocked,
  recordPhoneSubmission: async (phone: string) => {
    holder.phoneRecorded.push(phone)
  },
}))

import { guardPublicSubmission, guardRepeatSubmitter } from './guardPublicSubmission'

const NOW = Date.parse('2026-09-22T09:00:00Z')

function requestFrom(ip: string | null) {
  return new NextRequest('http://localhost/api/visits/new', {
    method: 'POST',
    headers: ip ? { 'x-forwarded-for': ip } : {},
  })
}

beforeEach(() => {
  holder.ipBlocked = false
  holder.phoneBlocked = false
  holder.ipRecorded.length = 0
  holder.phoneRecorded.length = 0
})

describe('guardPublicSubmission', () => {
  it('lets an ordinary submission through, and counts it', async () => {
    expect(await guardPublicSubmission(requestFrom('203.0.113.7'), NOW)).toEqual({ tooMany: false })
    expect(holder.ipRecorded).toEqual(['203.0.113.7'])
  })

  it('blocks once the limiter says the device has had enough', async () => {
    holder.ipBlocked = true
    expect(await guardPublicSubmission(requestFrom('203.0.113.7'), NOW)).toEqual({ tooMany: true })
  })

  // ما نعدّ محاولة لواحد محظور أصلاً — وإلا صار الحظر يمدّد نفسه للأبد
  it('does not count an attempt it just refused', async () => {
    holder.ipBlocked = true
    await guardPublicSubmission(requestFrom('203.0.113.7'), NOW)
    expect(holder.ipRecorded).toEqual([])
  })

  // مقصود: 'unknown' سلة واحدة يتشاركها كل من ما وصل هيدره. لو حظرناها،
  // أول زائر يستهلك الحد ويقفل الكشك على الباقي. لا تحظر ولا تعدّ
  it('never blocks or counts a request whose address is unknown', async () => {
    holder.ipBlocked = true
    expect(await guardPublicSubmission(requestFrom(null), NOW)).toEqual({ tooMany: false })
    expect(holder.ipRecorded).toEqual([])
  })
})

describe('guardRepeatSubmitter', () => {
  it('lets a first submission through, and counts it', async () => {
    expect(await guardRepeatSubmitter('50000001', NOW)).toEqual({ tooMany: false })
    expect(holder.phoneRecorded).toEqual(['50000001'])
  })

  it('blocks once the limiter says this number has had enough', async () => {
    holder.phoneBlocked = true
    expect(await guardRepeatSubmitter('50000001', NOW)).toEqual({ tooMany: true })
    expect(holder.phoneRecorded).toEqual([])
  })

  // الرقم يجي من جسم الطلب، فممكن يكون ناقص أو غير نص — ما نحظر على ذلك،
  // التحقق من الرقم شغل الـuse case مو الحارس
  it('ignores a missing, blank or non-string phone rather than refusing it', async () => {
    for (const value of [undefined, null, '', '   ', 42, {}]) {
      expect(await guardRepeatSubmitter(value, NOW)).toEqual({ tooMany: false })
    }
    expect(holder.phoneRecorded).toEqual([])
  })
})
