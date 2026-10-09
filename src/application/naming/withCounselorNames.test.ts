import { describe, it, expect } from 'vitest'
import { withCounselorNames } from './withCounselorNames'
import type { UserRepository } from '../ports/UserRepository'
import type { User } from '../../domain/entities/user'
import { createFixedClock } from '../testing/fakes'

const NOW = createFixedClock(new Date('2026-09-21T09:00:00Z'))

function user(id: string, name: string, extra: Partial<User> = {}): User {
  return {
    id,
    name,
    nameAr: null,
    role: 'counselor',
    email: `${id}@example.com`,
    passwordHash: 'x',
    active: true,
    scopes: [],
    shift: null,
    lastSeenAt: null,
    ...extra,
  } as User
}

function repositoryOf(users: User[]): UserRepository {
  return { findAll: async () => users } as unknown as UserRepository
}

describe('withCounselorNames', () => {
  it('names each row from the users table, Arabic included', async () => {
    const rows = await withCounselorNames(
      [{ counselorId: 'demoCounselorOne' }],
      repositoryOf([
        user('demoCounselorOne', 'Demo Counselor One', { nameAr: 'مستشار تجريبي أول' }),
      ]),
      NOW
    )
    expect(rows[0].counselorName).toBe('Demo Counselor One')
    expect(rows[0].counselorNameAr).toBe('مستشار تجريبي أول')
  })

  it('names a deactivated counselor, who no assignment list would offer', async () => {
    const rows = await withCounselorNames(
      [{ counselorId: 'gone' }],
      repositoryOf([user('gone', 'Left The Company', { active: false })]),
      NOW
    )
    expect(rows[0].counselorName).toBe('Left The Company')
  })

  it('leaves an unassigned row with no name rather than inventing one', async () => {
    const rows = await withCounselorNames([{ counselorId: null }], repositoryOf([]), NOW)
    expect(rows[0].counselorName).toBeNull()
    expect(rows[0].counselorNameAr).toBeNull()
  })

  it('returns null, never the raw id, for a counselor who is no longer a user', async () => {
    const rows = await withCounselorNames([{ counselorId: 'deleted' }], repositoryOf([]), NOW)
    expect(rows[0].counselorName).toBeNull()
  })

  it('keeps every other field on the row untouched', async () => {
    const rows = await withCounselorNames(
      [{ id: 'v1', counselorId: 'demoCounselorOne', name: 'Sample Client' }],
      repositoryOf([user('demoCounselorOne', 'Demo Counselor One')]),
      NOW
    )
    expect(rows[0]).toMatchObject({ id: 'v1', name: 'Sample Client' })
  })

  // اللصيقة على الصف تعتمد على هذي، ولازم تُحسب بنفس الاستعلام اللي جاب الاسم
  it('says whether the counselor has signed in today', async () => {
    const rows = await withCounselorNames(
      [{ counselorId: 'here' }, { counselorId: 'away' }],
      repositoryOf([
        user('here', 'Signed In', { lastSeenAt: new Date('2026-09-21T06:00:00Z') }),
        user('away', 'Last Here Sunday', { lastSeenAt: new Date('2026-09-20T17:00:00Z') }),
      ]),
      NOW
    )
    expect(rows[0].counselorSignedInToday).toBe(true)
    expect(rows[1].counselorSignedInToday).toBe(false)
  })

  // "ما فيه مستشار" مو نفس "فيه واحد وما سجّل دخول" — لو رجعناها false
  // تطلع اللصيقة على صف ما له مستشار أصلاً
  it('returns null, not false, when nobody is assigned', async () => {
    const rows = await withCounselorNames([{ counselorId: null }], repositoryOf([]), NOW)
    expect(rows[0].counselorSignedInToday).toBeNull()
  })
})

describe('withCounselorNames: online and came-to', () => {
  const now = new Date('2026-09-21T09:00:00Z')

  it('says whether the assigned counselor is online now', async () => {
    const rows = await withCounselorNames(
      [{ counselorId: 'on' }, { counselorId: 'off' }, { counselorId: null }],
      repositoryOf([
        user('on', 'Online Counselor', { lastSeenAt: new Date(now.getTime() - 30_000) }),
        user('off', 'Offline Counselor', { lastSeenAt: new Date(now.getTime() - 60 * 60_000) }),
      ]),
      NOW
    )
    expect(rows.map((r) => r.counselorOnline)).toEqual([true, false, null])
  })

  it('names who a follow-up came to, separately from who it was assigned to', async () => {
    const rows = await withCounselorNames(
      [{ counselorId: 'fai', requestedCounselorId: 'demoCounselorOne' }],
      repositoryOf([
        user('demoCounselorOne', 'Demo Counselor One', {
          nameAr: 'مستشار تجريبي أول',
          active: false,
        }),
        user('fai', 'Demo Counselor Five'),
      ]),
      NOW
    )
    expect(rows[0].counselorName).toBe('Demo Counselor Five')
    // حتى لو حسابه معطّل الحين — "جاء إلى" حقيقة عن الماضي
    expect(rows[0].requestedCounselorName).toBe('Demo Counselor One')
    expect(rows[0].requestedCounselorNameAr).toBe('مستشار تجريبي أول')
  })

  it('leaves came-to empty when nobody was asked for', async () => {
    const rows = await withCounselorNames(
      [{ counselorId: 'fai' }, { counselorId: 'fai', requestedCounselorId: null }],
      repositoryOf([user('fai', 'Demo Counselor Five')]),
      NOW
    )
    expect(rows.map((r) => r.requestedCounselorName)).toEqual([null, null])
  })
})
