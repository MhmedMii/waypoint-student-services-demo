import { describe, it, expect, vi } from 'vitest'
import {
  revalidateSessionToken,
  REVALIDATE_AFTER_MS,
  type SessionToken,
} from './revalidateSessionToken'
import {
  createFakeUserRepository,
  createFakeSpecializationRepository,
} from '../../application/testing/fakes'
import type { User } from '../../domain/entities/user'
import type { CounselorCandidate } from '../../domain/entities/counselor'

const NOW = 1_800_000_000_000

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'omar',
    name: 'Demo Counselor Eight',
    nameAr: 'مستشار تجريبي ثامن',
    role: 'counselor',
    email: 'omar@example.com',
    passwordHash: 'x',
    active: true,
    lastSeenAt: null,
    onlineSecondsToday: 0,
    onlineDay: null,
    shift: 'night',
    floor: 'M1',
    ...overrides,
  }
}

function candidate(overrides: Partial<CounselorCandidate> = {}): CounselorCandidate {
  return {
    id: 'omar',
    name: 'Demo Counselor Eight',
    scopes: ['visa_services'],
    lastAssignedAt: null,
    lastSeenAt: null,
    shift: 'night',
    ...overrides,
  } as CounselorCandidate
}

function signedInToken(overrides: SessionToken = {}): SessionToken {
  return {
    id: 'omar',
    role: 'counselor',
    scopes: ['visa_services'],
    nameAr: 'مستشار تجريبي ثامن',
    email: 'omar@example.com',
    checkedAt: NOW,
    ...overrides,
  }
}

function deps(users: User[] = [makeUser()], candidates: CounselorCandidate[] = [candidate()]) {
  return {
    userRepository: createFakeUserRepository(users),
    specializationRepository: createFakeSpecializationRepository(candidates),
  }
}

describe('revalidateSessionToken', () => {
  // الـ pool عنده ١٠ اتصالات ويتشاركها تسجيل الدخول — استعلام بكل طلب يخنقه
  it('does not touch the database inside the revalidation window', async () => {
    const d = deps()
    const findById = vi.spyOn(d.userRepository, 'findById')

    const token = signedInToken({ checkedAt: NOW })
    const result = await revalidateSessionToken(token, NOW + REVALIDATE_AFTER_MS - 1, d)

    expect(findById).not.toHaveBeenCalled()
    expect(result).toBe(token)
  })

  it('reads the database once the window has passed', async () => {
    const d = deps()
    const findById = vi.spyOn(d.userRepository, 'findById')

    await revalidateSessionToken(signedInToken(), NOW + REVALIDATE_AFTER_MS, d)

    expect(findById).toHaveBeenCalledWith('omar')
  })

  // البق الأصلي: تعطيل الساعة ٩ ما يوصل إلا الساعة ٥
  it('strips a deactivated account of its identity', async () => {
    const d = deps([makeUser({ active: false })])

    const result = await revalidateSessionToken(signedInToken(), NOW + REVALIDATE_AFTER_MS, d)

    expect(result.id).toBeUndefined()
    expect(result.role).toBeUndefined()
    expect(result.scopes).toBeUndefined()
  })

  it('strips an account that has been deleted outright', async () => {
    const result = await revalidateSessionToken(
      signedInToken(),
      NOW + REVALIDATE_AFTER_MS,
      deps([])
    )

    expect(result.id).toBeUndefined()
    expect(result.role).toBeUndefined()
  })

  // تنزيل الدور لازم يوصل بنفس السرعة — ومعه النطاقات
  it('replaces a role that changed in the database', async () => {
    const d = deps([makeUser({ role: 'admin' })])

    const result = await revalidateSessionToken(
      signedInToken({ role: 'super_admin' }),
      NOW + REVALIDATE_AFTER_MS,
      d
    )

    expect(result.role).toBe('admin')
    expect(result.id).toBe('omar')
  })

  it('drops the scopes of a counselor who is no longer a counselor', async () => {
    const d = deps([makeUser({ role: 'admin' })])

    const result = await revalidateSessionToken(signedInToken(), NOW + REVALIDATE_AFTER_MS, d)

    expect(result.scopes).toEqual([])
  })

  it('picks up a scope added since sign-in', async () => {
    const d = deps([makeUser()], [candidate({ scopes: ['visa_services', 'exam_services'] })])

    const result = await revalidateSessionToken(
      signedInToken({ scopes: ['visa_services'] }),
      NOW + REVALIDATE_AFTER_MS,
      d
    )

    expect(result.scopes).toEqual(['visa_services', 'exam_services'])
  })

  it('stamps the check time so the next minute is free', async () => {
    const later = NOW + REVALIDATE_AFTER_MS
    const result = await revalidateSessionToken(signedInToken(), later, deps())

    expect(result.checkedAt).toBe(later)
  })

  // توكن قديم صادر قبل هذا التغيير ما عنده checkedAt — يُفحص فوراً
  it('revalidates immediately when the token predates this check', async () => {
    const d = deps([makeUser({ active: false })])
    const { checkedAt, ...noStamp } = signedInToken()

    const result = await revalidateSessionToken(noStamp, NOW, d)

    expect(result.id).toBeUndefined()
  })

  it('leaves an already-stripped token alone without querying', async () => {
    const d = deps()
    const findById = vi.spyOn(d.userRepository, 'findById')

    const result = await revalidateSessionToken({ email: 'x' }, NOW, d)

    expect(findById).not.toHaveBeenCalled()
    expect(result.id).toBeUndefined()
  })
})
