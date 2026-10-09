import { describe, it, expect } from 'vitest'
import { requestPasswordReset } from './requestPasswordReset'
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
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

describe('requestPasswordReset', () => {
  it('creates a token and sends an email when the account exists and is active', async () => {
    const userRepository = createFakeUserRepository([activeUser])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const emailSender = createFakeEmailSender()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))

    const result = await requestPasswordReset('sarah.k@example.com', {
      userRepository,
      tokenRepository,
      emailSender,
      clock,
      tokenGenerator: resetTokenGenerator,
      resetLinkBaseUrl: 'https://app.example.com/reset-password',
    })

    expect(result.ok).toBe(true)
    expect(emailSender.sentTo).toEqual(['sarah.k@example.com'])
  })

  it('returns ok without sending an email when no account matches — avoids revealing which emails exist', async () => {
    const userRepository = createFakeUserRepository([])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const emailSender = createFakeEmailSender()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))

    const result = await requestPasswordReset('nobody@example.com', {
      userRepository,
      tokenRepository,
      emailSender,
      clock,
      tokenGenerator: resetTokenGenerator,
      resetLinkBaseUrl: 'https://app.example.com/reset-password',
    })

    expect(result.ok).toBe(true)
    expect(emailSender.sentTo).toHaveLength(0)
  })

  it('returns ok without sending an email when the account is deactivated', async () => {
    const inactiveUser: User = { ...activeUser, active: false }
    const userRepository = createFakeUserRepository([inactiveUser])
    const tokenRepository = createFakePasswordResetTokenRepository()
    const emailSender = createFakeEmailSender()
    const clock = createFixedClock(new Date('2026-08-12T10:00:00Z'))

    const result = await requestPasswordReset('sarah.k@example.com', {
      userRepository,
      tokenRepository,
      emailSender,
      clock,
      tokenGenerator: resetTokenGenerator,
      resetLinkBaseUrl: 'https://app.example.com/reset-password',
    })

    expect(result.ok).toBe(true)
    expect(emailSender.sentTo).toHaveLength(0)
  })
})
