import { describe, it, expect } from 'vitest'
import { followUpCounselorLog } from './followUpCounselorLog'

const NOW = new Date('2026-09-21T11:00:00Z') // الاثنين، ٢ ظهراً بالكويت

function seen(iso: string | null) {
  return {
    name: 'Demo Counselor One',
    nameAr: 'مستشار تجريبي أول',
    lastSeenAt: iso ? new Date(iso) : null,
  }
}

describe('followUpCounselorLog', () => {
  // اليوم العادي يبقى بنفس شكله بالسجل — ما ينضاف صف
  it('writes nothing when the chosen counselor is in today', () => {
    expect(followUpCounselorLog('Sample Client', seen('2026-09-21T06:00:00Z'), NOW)).toBeNull()
  })

  it('writes nothing when there is no counselor at all', () => {
    expect(followUpCounselorLog('Sample Client', null, NOW)).toBeNull()
  })

  it('uses the quiet action under the five-working-day line', () => {
    const one = followUpCounselorLog('Sample Client', seen('2026-09-20T12:00:00Z'), NOW)
    expect(one?.action).toBe('follow_up_counselor_not_in')
    expect(one?.en).toBe('Sample Client chose Demo Counselor One — not in 1 working day')

    const four = followUpCounselorLog('Sample Client', seen('2026-09-15T12:00:00Z'), NOW)
    expect(four?.action).toBe('follow_up_counselor_not_in')
  })

  // نفس الخط اللي يوقف التوزيع — خمسة أيام دوام
  it('uses the absent action at the line and past it', () => {
    const five = followUpCounselorLog('Sample Client', seen('2026-09-14T12:00:00Z'), NOW)
    expect(five?.action).toBe('follow_up_absent_counselor')

    const fifteen = followUpCounselorLog('Sample Client', seen('2026-08-31T12:00:00Z'), NOW)
    expect(fifteen?.action).toBe('follow_up_absent_counselor')
    expect(fifteen?.en).toBe('Sample Client chose Demo Counselor One — not in 15 working days')
  })

  it('says never, rather than counting from a sign-in that never happened', () => {
    const never = followUpCounselorLog('Sample Client', seen(null), NOW)
    expect(never?.action).toBe('follow_up_absent_counselor')
    expect(never?.en).toContain('never signed in')
    expect(never?.ar).toContain('ما سجّل دخول أبداً')
  })

  it('uses the dual form in Arabic at two, and the singular noun past ten', () => {
    expect(followUpCounselorLog('عميل', seen('2026-09-17T12:00:00Z'), NOW)?.ar).toContain(
      'ما حضر من يومي عمل'
    )
    expect(followUpCounselorLog('عميل', seen('2026-08-31T12:00:00Z'), NOW)?.ar).toContain(
      'ما حضر من 15 يوم عمل'
    )
    expect(followUpCounselorLog('عميل', seen('2026-09-14T12:00:00Z'), NOW)?.ar).toContain(
      'ما حضر من 5 أيام عمل'
    )
  })

  it('falls back to the English name when there is no Arabic one', () => {
    const note = followUpCounselorLog(
      'Sample Client',
      { name: 'Demo Counselor One', nameAr: null, lastSeenAt: new Date('2026-08-31T12:00:00Z') },
      NOW
    )
    expect(note?.ar).toContain('Demo Counselor One')
  })

  // اللوحة تقسم على آخر " — " عشان تلوّن الذيل، فلازم يكون موجود دائمًا
  it('always carries the separator the log panel colours on', () => {
    const note = followUpCounselorLog('Sample Client', seen('2026-08-31T12:00:00Z'), NOW)
    expect(note?.en.split(' — ')).toHaveLength(2)
    expect(note?.ar.split(' — ')).toHaveLength(2)
  })
})
