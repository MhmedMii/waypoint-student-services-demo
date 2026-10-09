import { describe, it, expect } from 'vitest'
import { BLOCK_MS as DEVICE_BLOCK_MS } from './ipSubmissionRateLimiter'
import { BLOCK_MS as PHONE_BLOCK_MS } from './repeatSubmitterLimiter'
import { translations } from '../../i18n/translations'

// الرسالة تقول للزائر كم ينتظر. لو أحد غيّر مدة الحظر ونسي النص، الزائر يرجع
// قبل ما ينفك الحظر (أو ينتظر أكثر من اللازم) — هذا يربط الرقمين
describe('the public limit messages quote the block that actually applies', () => {
  const cases = [
    { code: 'tooManySubmissions', minutes: DEVICE_BLOCK_MS / 60_000 },
    { code: 'tooManySubmissionsFromNumber', minutes: PHONE_BLOCK_MS / 60_000 },
  ] as const

  it.each(cases)('$code says $minutes minutes, in both languages', ({ code, minutes }) => {
    for (const language of ['en', 'ar'] as const) {
      const text = translations[language].errors[code]
      expect(text.match(/\d+/g)).toEqual([String(minutes)])
    }
  })
})
