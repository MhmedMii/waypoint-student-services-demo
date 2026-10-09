import { describe, it, expect } from 'vitest'
import { pickNextInRotation } from './pickNextInRotation'
import type { CounselorCandidate } from '../entities/counselor'

const counselor = (id: string, extra: Partial<CounselorCandidate> = {}): CounselorCandidate => ({
  id,
  scopes: ['USA'],
  lastAssignedAt: null,
  ...extra,
})

// يوزّع n عملاء ويحفظ مكان الدورة بين كل إرسال والثاني — مثل ما يصير بالقاعدة
function deal(candidates: CounselorCandidate[], count: number, startAfter: string | null = null) {
  const order: string[] = []
  let last = startAfter
  for (let i = 0; i < count; i++) {
    const next = pickNextInRotation(candidates, last)!
    order.push(next.id)
    last = next.id
  }
  return { order, last }
}

describe('pickNextInRotation', () => {
  it('gives three counselors clients 1, 2, 3, 1, 2, 3', () => {
    const three = [counselor('c1'), counselor('c2'), counselor('c3')]
    expect(deal(three, 6).order).toEqual(['c1', 'c2', 'c3', 'c1', 'c2', 'c3'])
  })

  it('uses a fixed order that does not depend on the order the list arrives in', () => {
    const shuffled = [counselor('c3'), counselor('c1'), counselor('c2')]
    expect(deal(shuffled, 3).order).toEqual(['c1', 'c2', 'c3'])
  })

  // كان "أطول مدة بدون عميل": الغايب من أسابيع تاريخه أقدم، فياخذ عدة عملاء ورا بعض
  it('gives a counselor away for weeks one turn, not several in a row', () => {
    const three = [
      counselor('c1', { lastAssignedAt: new Date('2026-09-23T09:00:00Z') }),
      counselor('c2', { lastAssignedAt: new Date('2026-08-19T09:00:00Z'), lastSeenAt: null }),
      counselor('c3', { lastAssignedAt: new Date('2026-09-24T09:00:00Z') }),
    ]
    const { order } = deal(three, 6, 'c1')
    expect(order).toEqual(['c2', 'c3', 'c1', 'c2', 'c3', 'c1'])
  })

  it('ignores sign-in entirely', () => {
    const signedIn = [
      counselor('c1', { lastSeenAt: new Date() }),
      counselor('c2', { lastSeenAt: new Date() }),
    ]
    const neverIn = [counselor('c1', { lastSeenAt: null }), counselor('c2', { lastSeenAt: null })]
    expect(deal(signedIn, 4).order).toEqual(deal(neverIn, 4).order)
  })

  it('does not restart the cycle when a counselor is added', () => {
    const three = [counselor('c1'), counselor('c3'), counselor('c5')]
    const { last } = deal(three, 2) // c1, c3 — c5 is next
    const withNewcomer = [...three, counselor('c4')]
    // تكمل من بعد c3: الجديد ياخذ مكانه بالترتيب، مو من أول الدورة
    expect(deal(withNewcomer, 5, last).order).toEqual(['c4', 'c5', 'c1', 'c3', 'c4'])
  })

  it('carries on from the last position when that counselor has left the list', () => {
    const remaining = [counselor('c1'), counselor('c3')]
    expect(pickNextInRotation(remaining, 'c2')?.id).toBe('c3')
    expect(pickNextInRotation(remaining, 'c9')?.id).toBe('c1')
  })

  it('returns null when nobody covers the scope', () => {
    expect(pickNextInRotation([], 'c1')).toBeNull()
  })
})
