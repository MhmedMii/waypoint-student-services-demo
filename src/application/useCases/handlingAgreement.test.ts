import { describe, it, expect } from 'vitest'
import type { Visit } from '../../domain/entities/visit'
import type { User } from '../../domain/entities/user'
import {
  createFakeVisitRepository,
  createFakeUserRepository,
  createFakeBreakRepository,
  createFixedClock,
} from '../testing/fakes'
import { getCounselorQueue } from './getCounselorQueue'
import { getCounselorSupervision } from './getCounselorSupervision'

const NOW = new Date('2026-09-21T12:00:00Z')
const at = (iso: string) => new Date(iso)

function visit(id: string, pickedUpAt: string, closedAt: string): Visit {
  return {
    id,
    type: 'new',
    name: `Client ${id}`,
    phone: `5000000${id}`,
    desiredCountry: 'USA',
    counselorId: 'c1',
    linkedVisitId: null,
    status: 'closed',
    studentStatus: 'closed',
    pickedUpAt: at(pickedUpAt),
    closedAt: at(closedAt),
    note: null,
    followUpDueAt: null,
    createdBy: null,
    createdAt: at(pickedUpAt),
    updatedAt: at(closedAt),
  }
}

const counselor: User = {
  id: 'c1',
  name: 'Sample Counselor',
  nameAr: null,
  role: 'counselor',
  email: 'c1@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: NOW,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
  note: null,
} as User

// نفس المجموعة بالضبط للشاشتين — لو اختلف التعريف، الرقمان يفترقون
async function bothScreens(visits: Visit[]) {
  const clock = createFixedClock(NOW)
  const queue = await getCounselorQueue('c1', {
    visitRepository: createFakeVisitRepository(visits),
    breakRepository: createFakeBreakRepository(),
    clock,
  })
  const supervision = await getCounselorSupervision({
    visitRepository: createFakeVisitRepository(visits),
    userRepository: createFakeUserRepository([counselor]),
    breakRepository: createFakeBreakRepository(),
    clock,
  })
  const row = supervision.find((r) => r.id === 'c1')!
  return { queue, row }
}

describe('the counselor screen and the supervision board report the same handling figures', () => {
  it('agree on a plain day', async () => {
    const { queue, row } = await bothScreens([
      visit('1', '2026-09-21T09:00:00Z', '2026-09-21T09:20:00Z'),
      visit('2', '2026-09-21T10:00:00Z', '2026-09-21T10:40:00Z'),
    ])
    expect(queue.avgHandlingMs).toBe(row.avgHandlingMs)
    expect(queue.servedToday).toBe(row.closedToday)
    expect(queue.avgHandlingMs).toBe(30 * 60000)
  })

  // كان هذا بالضبط مصدر الخلاف: شاشة المستشار متوسط عادي، والإشراف يستثني
  it('agree when the day contains an instant close', async () => {
    const { queue, row } = await bothScreens([
      visit('1', '2026-09-21T09:00:00Z', '2026-09-21T09:20:00Z'),
      visit('2', '2026-09-21T10:00:00Z', '2026-09-21T10:00:40Z'),
    ])
    expect(queue.avgHandlingMs).toBe(row.avgHandlingMs)
    // ٢٠ دقيقة — الإغلاق الفوري مستثنى من المتوسط بالشاشتين
    expect(queue.avgHandlingMs).toBe(20 * 60000)
    expect(row.instantCloseCount).toBe(1)
  })

  it('agree when a visit was left open for a whole working day', async () => {
    const { queue, row } = await bothScreens([
      visit('1', '2026-09-21T09:00:00Z', '2026-09-21T09:20:00Z'),
      visit('2', '2026-09-21T00:00:00Z', '2026-09-21T09:30:00Z'),
    ])
    expect(queue.avgHandlingMs).toBe(row.avgHandlingMs)
    expect(queue.avgHandlingMs).toBe(20 * 60000)
    expect(row.leftOpenCount).toBe(1)
  })

  it('agree that a day of only instant closes has no average at all', async () => {
    const { queue, row } = await bothScreens([
      visit('1', '2026-09-21T09:00:00Z', '2026-09-21T09:00:30Z'),
      visit('2', '2026-09-21T10:00:00Z', '2026-09-21T10:00:45Z'),
    ])
    expect(queue.avgHandlingMs).toBeNull()
    expect(row.avgHandlingMs).toBeNull()
    expect(queue.servedToday).toBe(2)
  })

  // زيارة انفتحت أمس وانقفلت اليوم: شاشة المستشار كانت تعدّها والإشراف لا
  it('agree on a visit opened yesterday and closed today', async () => {
    const { queue, row } = await bothScreens([
      visit('1', '2026-09-20T18:00:00Z', '2026-09-21T09:20:00Z'),
    ])
    expect(queue.servedToday).toBe(row.closedToday)
    expect(queue.servedToday).toBe(1)
  })

  it('agree that yesterday’s closed visit belongs to yesterday', async () => {
    const { queue, row } = await bothScreens([
      visit('1', '2026-09-19T09:00:00Z', '2026-09-19T09:20:00Z'),
    ])
    expect(queue.servedToday).toBe(0)
    expect(row.closedToday).toBe(0)
    expect(queue.avgHandlingMs).toBeNull()
    expect(row.avgHandlingMs).toBeNull()
  })

  it('keeps the instant-close count off the counselor screen', async () => {
    const { queue, row } = await bothScreens([
      visit('1', '2026-09-21T10:00:00Z', '2026-09-21T10:00:40Z'),
    ])
    expect(row.instantCloseCount).toBe(1)
    expect(Object.keys(queue)).not.toContain('instantCloseCount')
  })
})
