import { describe, it, expect } from 'vitest'
import {
  getAdminNotifications,
  redClientCount,
  redItemCount,
  type AdminNotifications,
} from './getAdminNotifications'
import {
  createFakeVisitRepository,
  createFakeUserRepository,
  createFixedClock,
} from '../testing/fakes'
import type { User } from '../../domain/entities/user'

const NOW = new Date('2026-09-21T11:00:00Z') // الاثنين ٢ ظهراً بالكويت

function counselor(id: string, lastSeenAt: Date | null): User {
  return {
    id,
    name: id,
    nameAr: null,
    role: 'counselor',
    email: `${id}@example.com`,
    passwordHash: 'x',
    active: true,
    scopes: [],
    shift: null,
    lastSeenAt,
  } as unknown as User
}

const SIGNED_IN_TODAY = new Date('2026-09-21T06:00:00Z')
const QUIET_SINCE_SUNDAY = new Date('2026-09-20T12:00:00Z') // يوم دوام واحد
const ABSENT_SINCE_AUGUST = new Date('2026-08-31T12:00:00Z') // ١٥ يوم دوام

async function run(
  waiting: Array<{ counselorId: string | null }>,
  users: User[]
): Promise<AdminNotifications> {
  const visitRepository = createFakeVisitRepository()
  for (const [index, row] of waiting.entries()) {
    await visitRepository.create({
      type: 'new',
      name: `Sample Client ${index}`,
      phone: `5000000${index}`,
      desiredCountry: 'USA',
      counselorId: row.counselorId,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })
  }
  return getAdminNotifications({
    visitRepository,
    userRepository: createFakeUserRepository(users),
    clock: createFixedClock(NOW),
  })
}

describe('getAdminNotifications', () => {
  it('counts clients with no counselor at all', async () => {
    const view = await run([{ counselorId: null }, { counselorId: null }], [])
    expect(view.unassignedClients).toBe(2)
  })

  it('says nothing about a client whose counselor is here today', async () => {
    const view = await run([{ counselorId: 'here' }], [counselor('here', SIGNED_IN_TODAY)])
    expect(view.unassignedClients).toBe(0)
    expect(view.clientsWaitingOnQuietCounselor).toBe(0)
    expect(view.absentCounselorsWithClientsWaiting).toBe(0)
  })

  it('counts a client waiting on someone who has not signed in today', async () => {
    const view = await run([{ counselorId: 'quiet' }], [counselor('quiet', QUIET_SINCE_SUNDAY)])
    expect(view.clientsWaitingOnQuietCounselor).toBe(1)
    expect(view.absentCounselorsWithClientsWaiting).toBe(0)
  })

  // العالقون: التوزيع يتخطّاهم، بس عملاء قدامى لسا معلّقين عندهم
  it('counts absent counselors once, however many clients they are holding', async () => {
    const view = await run(
      [{ counselorId: 'away' }, { counselorId: 'away' }, { counselorId: 'away' }],
      [counselor('away', ABSENT_SINCE_AUGUST)]
    )
    expect(view.absentCounselorsWithClientsWaiting).toBe(1)
    expect(view.clientsWaitingOnAbsentCounselor).toBe(3)
  })

  // كان هذا الخطر: نفس العميل ينعدّ بسطرين فيطلع الرقم مضاعف
  it('never counts one client in two buckets', async () => {
    const view = await run(
      [{ counselorId: null }, { counselorId: 'quiet' }, { counselorId: 'away' }],
      [counselor('quiet', QUIET_SINCE_SUNDAY), counselor('away', ABSENT_SINCE_AUGUST)]
    )
    expect(view.unassignedClients).toBe(1)
    expect(view.clientsWaitingOnQuietCounselor).toBe(1)
    expect(view.clientsWaitingOnAbsentCounselor).toBe(1)
    expect(redClientCount(view)).toBe(3)
  })

  // الشريط النحيف يعدّ عملاء، الجرس يعدّ أسطر — ولازم كل عميل بالشريط يطلع
  // من سطر تقدر تشوفه، وإلا صار الرقم من لا مكان
  it('counts items for the bell, and every client sits behind a visible row', async () => {
    const view = await run(
      [{ counselorId: null }, { counselorId: null }, { counselorId: 'away' }],
      [counselor('away', ABSENT_SINCE_AUGUST)]
    )
    expect(redClientCount(view)).toBe(3)
    // غير معيّنين + عملاء عالقين + مستشار غائب = ٣ أسطر
    expect(redItemCount(view)).toBe(3)
    expect(view.unassignedClients + view.clientsWaitingOnAbsentCounselor).toBe(redClientCount(view))
  })

  it('reports nothing red when every client has someone who is here', async () => {
    const view = await run([{ counselorId: 'here' }], [counselor('here', SIGNED_IN_TODAY)])
    expect(redClientCount(view)).toBe(0)
    expect(redItemCount(view)).toBe(0)
  })

  // زيارة استُلمت ما عاد أحد ينتظرها — العميل قاعد مع المستشار الحين
  it('ignores a visit that has already been picked up', async () => {
    const visitRepository = createFakeVisitRepository()
    const visit = await visitRepository.create({
      type: 'new',
      name: 'Sample Client',
      phone: '50000001',
      desiredCountry: 'USA',
      counselorId: 'quiet',
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })
    await visitRepository.markPickedUp(visit.id, NOW)

    const view = await getAdminNotifications({
      visitRepository,
      userRepository: createFakeUserRepository([counselor('quiet', QUIET_SINCE_SUNDAY)]),
      clock: createFixedClock(NOW),
    })
    expect(view.clientsWaitingOnQuietCounselor).toBe(0)
  })
})
