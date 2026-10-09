import { describe, it, expect } from 'vitest'
import { validateFinishStudentStatus } from './validateFinishStudentStatus'

describe('validateFinishStudentStatus', () => {
  // "بالانتظار" انشال من خيارات الإنهاء — والسيرفر يرفضه، مو بس القائمة، عشان
  // تبويب قديم أو نسخة جافاسكربت قديمة ما تقدر ترجّع الخطأ
  it('refuses waiting, the option that used to corrupt the counters', () => {
    expect(validateFinishStudentStatus('waiting')).toEqual({
      isValid: false,
      reason: 'studentStatusInvalid',
    })
  })

  it('accepts follow_up_needed', () => {
    expect(validateFinishStudentStatus('follow_up_needed')).toEqual({ isValid: true })
  })

  it('accepts closed', () => {
    expect(validateFinishStudentStatus('closed')).toEqual({ isValid: true })
  })

  it('rejects in_session', () => {
    const result = validateFinishStudentStatus('in_session')
    expect(result.isValid).toBe(false)
  })

  it('rejects an unknown value', () => {
    const result = validateFinishStudentStatus('done')
    expect(result.isValid).toBe(false)
  })

  it('rejects a non-string value', () => {
    const result = validateFinishStudentStatus(null)
    expect(result.isValid).toBe(false)
  })
})
