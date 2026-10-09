import { describe, it, expect, vi, afterEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { verifyCredentials } from './authOptions'
import { createFakeUserRepository } from '../../application/testing/fakes'
import type { User } from '../../domain/entities/user'

describe('verifyCredentials', () => {
  it('accepts a matching email/password for an active user', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4)
    const user: User = {
      id: 'u1',
      name: 'Fictional Student T',
      role: 'counselor',
      email: 'sarah.k@example.com',
      passwordHash,
      active: true,
      lastSeenAt: null,
      onlineSecondsToday: 0,
      onlineDay: null,
      shift: null,
      floor: null,
    }
    const userRepository = createFakeUserRepository([user])

    const result = await verifyCredentials(
      { email: 'sarah.k@example.com', password: 'correct-password' },
      userRepository
    )
    expect(result?.id).toBe('u1')
  })

  it('rejects a wrong password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4)
    const user: User = {
      id: 'u1',
      name: 'Fictional Student T',
      role: 'counselor',
      email: 'sarah.k@example.com',
      passwordHash,
      active: true,
      lastSeenAt: null,
      onlineSecondsToday: 0,
      onlineDay: null,
      shift: null,
      floor: null,
    }
    const userRepository = createFakeUserRepository([user])

    const result = await verifyCredentials(
      { email: 'sarah.k@example.com', password: 'wrong' },
      userRepository
    )
    expect(result).toBeNull()
  })

  it('rejects a deactivated account even with the correct password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4)
    const user: User = {
      id: 'u1',
      name: 'Fictional Student T',
      role: 'counselor',
      email: 'sarah.k@example.com',
      passwordHash,
      active: false,
      lastSeenAt: null,
      onlineSecondsToday: 0,
      onlineDay: null,
      shift: null,
      floor: null,
    }
    const userRepository = createFakeUserRepository([user])

    const result = await verifyCredentials(
      { email: 'sarah.k@example.com', password: 'correct-password' },
      userRepository
    )
    expect(result).toBeNull()
  })
})

describe('authOptions session cookie name', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses the __Secure- prefix in production, matching the secure flag', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    const { authOptions } = await import('./authOptions')
    expect(authOptions.cookies?.sessionToken?.name).toBe('__Secure-next-auth.session-token')
    expect(authOptions.cookies?.sessionToken?.options?.secure).toBe(true)
  })

  it('keeps the plain cookie name outside production', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'development')
    const { authOptions } = await import('./authOptions')
    expect(authOptions.cookies?.sessionToken?.name).toBe('next-auth.session-token')
    expect(authOptions.cookies?.sessionToken?.options?.secure).toBe(false)
  })
})
