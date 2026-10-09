import { describe, it, expect } from 'vitest'
import { requestPasswordReset } from './requestPasswordReset'
import { completePasswordReset } from './completePasswordReset'
import {
  createFakeUserRepository,
  createFakePasswordResetTokenRepository,
  createFakeEmailSender,
  createFixedClock,
} from '../testing/fakes'
import { resetTokenGenerator } from '../../infrastructure/auth/passwordResetToken'
import type { User } from '../../domain/entities/user'

const activeUser: User = {
  id: 'u1',
  name: 'Fictional Student T',
  role: 'counselor',
  email: 'sarah.k@example.com',
  passwordHash: 'old-hash',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

async function requestAndCaptureLink(
  userRepository: ReturnType<typeof createFakeUserRepository>,
  tokenRepository: ReturnType<typeof createFakePasswordResetTokenRepository>,
  clock: ReturnType<typeof createFixedClock>
) {
  const emailSender = createFakeEmailSender()
  await requestPasswordReset('sarah.k@example.com', {
    userRepository,
    tokenRepository,
    emailSender,
    clock,
    tokenGenerator: resetTokenGenerator,
    resetLinkBaseUrl: 'https://app.example.com/reset-password',
  })
  const link = emailSender.sentLinks[0]
  return new URL(link).searchParams.get('token') as string
}

describe('completePasswordReset', () => {
  it('updates the password hash when the token is valid and unexpired', async () => {
    const userRepository = createFakeUserRepository([activeUser])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))
    const rawToken = await requestAndCaptureLink(userRepository, tokenRepository, clock)

    const result = await completePasswordReset(rawToken, 'brand-new-password', {
      userRepository,
      tokenRepository,
      clock,
      tokenGenerator: resetTokenGenerator,
    })

    expect(result.ok).toBe(true)
    const updated = await userRepository.findByEmail('sarah.k@example.com')
    expect(updated?.passwordHash).not.toBe('old-hash')
  })

  it('rejects an unknown token', async () => {
    const userRepository = createFakeUserRepository([activeUser])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))

    const result = await completePasswordReset('not-a-real-token', 'brand-new-password', {
      userRepository,
      tokenRepository,
      clock,
      tokenGenerator: resetTokenGenerator,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects an expired token', async () => {
    const userRepository = createFakeUserRepository([activeUser])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const requestClock = createFixedClock(new Date('2026-08-12T10:00:00Z'))
    const rawToken = await requestAndCaptureLink(userRepository, tokenRepository, requestClock)

    const laterClock = createFixedClock(new Date('2026-08-12T12:00:00Z')) // 2 hours later, past the 1-hour TTL
    const result = await completePasswordReset(rawToken, 'brand-new-password', {
      userRepository,
      tokenRepository,
      clock: laterClock,
      tokenGenerator: resetTokenGenerator,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects reusing an already-used token', async () => {
    const userRepository = createFakeUserRepository([activeUser])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))
    const rawToken = await requestAndCaptureLink(userRepository, tokenRepository, clock)

    await completePasswordReset(rawToken, 'first-new-password', {
      userRepository,
      tokenRepository,
      clock,
      tokenGenerator: resetTokenGenerator,
    })
    const secondAttempt = await completePasswordReset(rawToken, 'second-new-password', {
      userRepository,
      tokenRepository,
      clock,
      tokenGenerator: resetTokenGenerator,
    })
    expect(secondAttempt.ok).toBe(false)
  })

  it('rejects redemption if the account was deactivated after the token was issued', async () => {
    const freshUser: User = {
      id: 'u2',
      name: 'Fictional Student N',
      role: 'counselor',
      email: 'omar.f@example.com',
      passwordHash: 'untouched-hash',
      active: true,
      lastSeenAt: null,
      onlineSecondsToday: 0,
      onlineDay: null,
      shift: null,
      floor: null,
    }
    const userRepository = createFakeUserRepository([freshUser])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))
    const emailSender = createFakeEmailSender()
    await requestPasswordReset('omar.f@example.com', {
      userRepository,
      tokenRepository,
      emailSender,
      clock,
      tokenGenerator: resetTokenGenerator,
      resetLinkBaseUrl: 'https://app.example.com/reset-password',
    })
    const rawToken = new URL(emailSender.sentLinks[0]).searchParams.get('token') as string

    await userRepository.setActive('u2', false)

    const result = await completePasswordReset(rawToken, 'brand-new-password', {
      userRepository,
      tokenRepository,
      clock,
      tokenGenerator: resetTokenGenerator,
    })
    expect(result.ok).toBe(false)
    const updated = await userRepository.findByEmail('omar.f@example.com')
    expect(updated?.passwordHash).toBe('untouched-hash')
  })

  it('rejects a password shorter than the minimum length', async () => {
    // مستخدم مستقل بدل activeUser المشترك — نفس سبب الفصل بالاختبارات تحت
    // (Fictional Student N / Demo Counselor H): الفيك يعدّل الكائن بالمكان، فاختبار سابق يكون غيّره
    const freshUser: User = {
      id: 'u4',
      name: 'Fictional Student F',
      role: 'counselor',
      email: 'layla.h@example.com',
      passwordHash: 'old-hash',
      active: true,
      lastSeenAt: null,
      onlineSecondsToday: 0,
      onlineDay: null,
      shift: null,
      floor: null,
    }
    const userRepository = createFakeUserRepository([freshUser])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))
    const emailSender = createFakeEmailSender()
    await requestPasswordReset('layla.h@example.com', {
      userRepository,
      tokenRepository,
      emailSender,
      clock,
      tokenGenerator: resetTokenGenerator,
      resetLinkBaseUrl: 'https://app.example.com/reset-password',
    })
    const rawToken = new URL(emailSender.sentLinks[0]).searchParams.get('token') as string

    const result = await completePasswordReset(rawToken, 'short', {
      userRepository,
      tokenRepository,
      clock,
      tokenGenerator: resetTokenGenerator,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('passwordTooWeak')
    const updated = await userRepository.findByEmail('layla.h@example.com')
    expect(updated?.passwordHash).toBe('old-hash')
  })

  it('only lets one of two concurrent redemption attempts succeed', async () => {
    const freshUser: User = {
      id: 'u3',
      name: 'Demo Counselor H',
      role: 'counselor',
      email: 'ali.m@example.com',
      passwordHash: 'untouched-hash',
      active: true,
      lastSeenAt: null,
      onlineSecondsToday: 0,
      onlineDay: null,
      shift: null,
      floor: null,
    }
    const userRepository = createFakeUserRepository([freshUser])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))
    const emailSender = createFakeEmailSender()
    await requestPasswordReset('ali.m@example.com', {
      userRepository,
      tokenRepository,
      emailSender,
      clock,
      tokenGenerator: resetTokenGenerator,
      resetLinkBaseUrl: 'https://app.example.com/reset-password',
    })
    const rawToken = new URL(emailSender.sentLinks[0]).searchParams.get('token') as string

    const [first, second] = await Promise.all([
      completePasswordReset(rawToken, 'password-from-first-attempt', {
        userRepository,
        tokenRepository,
        clock,
        tokenGenerator: resetTokenGenerator,
      }),
      completePasswordReset(rawToken, 'password-from-second-attempt', {
        userRepository,
        tokenRepository,
        clock,
        tokenGenerator: resetTokenGenerator,
      }),
    ])

    const outcomes = [first.ok, second.ok]
    expect(outcomes.filter(Boolean)).toHaveLength(1)
  })
})

// التوكن كان يُحرق قبل فحص كلمة السر: غلطة كتابة تقفل صاحب الحساب برا
// حسابه، لأن "نسيت كلمة السر" محدودة بخمس مرات كل ربع ساعة
describe('completePasswordReset — the link is only spent on success', () => {
  function freshUser(id: string, email: string): User {
    return {
      id,
      name: 'Reset Fixture',
      role: 'counselor',
      email,
      passwordHash: 'old-hash',
      active: true,
      lastSeenAt: null,
      onlineSecondsToday: 0,
      onlineDay: null,
      shift: null,
      floor: null,
    }
  }

  async function issueLink(email: string, user: User, at: Date) {
    const userRepository = createFakeUserRepository([user])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const emailSender = createFakeEmailSender()
    await requestPasswordReset(email, {
      userRepository,
      tokenRepository,
      emailSender,
      clock: createFixedClock(at),
      tokenGenerator: resetTokenGenerator,
      resetLinkBaseUrl: 'https://app.example.com/reset-password',
    })
    const rawToken = new URL(emailSender.sentLinks[0]).searchParams.get('token') as string
    const record = await tokenRepository.findByTokenHash(resetTokenGenerator.hashToken(rawToken))
    return { userRepository, tokenRepository, rawToken, record: record! }
  }

  it('accepts a valid password on the same link after a weak one was refused', async () => {
    const at = new Date('2026-08-12T10:00:00Z')
    const { userRepository, tokenRepository, rawToken } = await issueLink(
      'retry.a@example.com',
      freshUser('r1', 'retry.a@example.com'),
      at
    )
    const deps = {
      userRepository,
      tokenRepository,
      clock: createFixedClock(at),
      tokenGenerator: resetTokenGenerator,
    }

    const weak = await completePasswordReset(rawToken, 'short', deps)
    expect(weak).toEqual({ ok: false, reason: 'passwordTooWeak' })

    const strong = await completePasswordReset(rawToken, 'a-properly-long-password', deps)
    expect(strong).toEqual({ ok: true })
    const updated = await userRepository.findById('r1')
    expect(updated?.passwordHash).not.toBe('old-hash')
  })

  it('leaves the link unspent after a weak password', async () => {
    const at = new Date('2026-08-12T10:00:00Z')
    const { userRepository, tokenRepository, rawToken, record } = await issueLink(
      'retry.b@example.com',
      freshUser('r2', 'retry.b@example.com'),
      at
    )
    await completePasswordReset(rawToken, 'short', {
      userRepository,
      tokenRepository,
      clock: createFixedClock(at),
      tokenGenerator: resetTokenGenerator,
    })
    const after = await tokenRepository.findByTokenHash(record.tokenHash)
    expect(after?.usedAt).toBeNull()
  })

  // ما ضرّ أحد، بس كان يبيّن إن الترتيب غلط بكل مكان
  it('does not mark an expired token as used', async () => {
    const { userRepository, tokenRepository, rawToken, record } = await issueLink(
      'expired@example.com',
      freshUser('r3', 'expired@example.com'),
      new Date('2026-08-12T10:00:00Z')
    )
    const result = await completePasswordReset(rawToken, 'a-properly-long-password', {
      userRepository,
      tokenRepository,
      clock: createFixedClock(new Date('2026-08-12T12:00:00Z')),
      tokenGenerator: resetTokenGenerator,
    })
    expect(result).toEqual({ ok: false, reason: 'resetLinkExpired' })
    const after = await tokenRepository.findByTokenHash(record.tokenHash)
    expect(after?.usedAt).toBeNull()
  })

  it('spends the token exactly once on a successful reset', async () => {
    const at = new Date('2026-08-12T10:00:00Z')
    const { userRepository, tokenRepository, rawToken, record } = await issueLink(
      'once@example.com',
      freshUser('r4', 'once@example.com'),
      at
    )
    const deps = {
      userRepository,
      tokenRepository,
      clock: createFixedClock(at),
      tokenGenerator: resetTokenGenerator,
    }

    expect(await completePasswordReset(rawToken, 'a-properly-long-password', deps)).toEqual({
      ok: true,
    })
    const after = await tokenRepository.findByTokenHash(record.tokenHash)
    expect(after?.usedAt).toEqual(at)

    // ثاني مرة بنفس الرابط: نفس جواب الرابط المستخدم، مو نجاح ثاني
    expect(await completePasswordReset(rawToken, 'another-long-password', deps)).toEqual({
      ok: false,
      reason: 'resetLinkInvalid',
    })
  })

  // الردود ما تغيّرت: مجهول ومستخدم يرجعون نفس الجواب
  it('answers an unknown token exactly as it did before', async () => {
    const { userRepository, tokenRepository } = await issueLink(
      'unknown@example.com',
      freshUser('r5', 'unknown@example.com'),
      new Date('2026-08-12T10:00:00Z')
    )
    expect(
      await completePasswordReset('not-a-real-token', 'a-properly-long-password', {
        userRepository,
        tokenRepository,
        clock: createFixedClock(new Date('2026-08-12T10:00:00Z')),
        tokenGenerator: resetTokenGenerator,
      })
    ).toEqual({ ok: false, reason: 'resetLinkInvalid' })
  })
})
