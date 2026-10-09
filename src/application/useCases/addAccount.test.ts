import { describe, it, expect } from 'vitest'
import { addAccount } from './addAccount'
import { createFakeUserRepository } from '../testing/fakes'
import type { User } from '../../domain/entities/user'

const superAdmin1: User = {
  id: 'u1',
  name: 'Super One',
  role: 'super_admin',
  email: 'super1@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}
const superAdmin2: User = {
  id: 'u2',
  name: 'Super Two',
  role: 'super_admin',
  email: 'super2@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

describe('addAccount', () => {
  it('creates a counselor account when the actor is super_admin', async () => {
    const userRepository = createFakeUserRepository()
    const result = await addAccount(
      'super_admin',
      {
        name: 'New Counselor',
        role: 'counselor',
        email: 'new.counselor@example.com',
        password: 'temp-pass-123',
      },
      { userRepository }
    )
    expect(result.ok).toBe(true)
  })

  it('rejects when the actor is admin, not super_admin', async () => {
    const userRepository = createFakeUserRepository()
    const result = await addAccount(
      'admin',
      {
        name: 'New Counselor',
        role: 'counselor',
        email: 'new.counselor@example.com',
        password: 'temp-pass-123',
      },
      { userRepository }
    )
    expect(result.ok).toBe(false)
  })

  it('accepts a valid email address from an unrestricted domain', async () => {
    const userRepository = createFakeUserRepository()
    const result = await addAccount(
      'super_admin',
      {
        name: 'New Counselor',
        role: 'counselor',
        email: 'outsider@example.net',
        password: 'temp-pass-123',
      },
      { userRepository }
    )
    expect(result.ok).toBe(true)
  })

  it('rejects a malformed email address', async () => {
    const userRepository = createFakeUserRepository()
    const result = await addAccount(
      'super_admin',
      {
        name: 'New Counselor',
        role: 'counselor',
        email: 'invalid-address',
        password: 'temp-pass-123',
      },
      { userRepository }
    )
    expect(result).toEqual({ ok: false, reason: 'emailInvalid', code: 'validation' })
  })

  it('rejects an unknown role value instead of reaching the repository', async () => {
    const userRepository = createFakeUserRepository()
    const result = await addAccount(
      'super_admin',
      {
        name: 'New Counselor',
        role: 'root' as any,
        email: 'new.counselor@example.com',
        password: 'temp-pass-123',
      },
      { userRepository }
    )
    expect(result.ok).toBe(false)
  })

  it('rejects a password shorter than the minimum length', async () => {
    const userRepository = createFakeUserRepository()
    const result = await addAccount(
      'super_admin',
      {
        name: 'New Counselor',
        role: 'counselor',
        email: 'new.counselor@example.com',
        password: 'short1',
      },
      { userRepository }
    )
    expect(result.ok).toBe(false)
  })

  it('creates a second super_admin when only 1 exists', async () => {
    const userRepository = createFakeUserRepository([superAdmin1])
    const result = await addAccount(
      'super_admin',
      {
        name: 'New Super',
        role: 'super_admin',
        email: 'new.super@example.com',
        password: 'temp-pass-123',
      },
      { userRepository }
    )
    expect(result.ok).toBe(true)
  })

  it('rejects creating a super_admin once 2 already exist', async () => {
    const userRepository = createFakeUserRepository([superAdmin1, superAdmin2])
    const result = await addAccount(
      'super_admin',
      {
        name: 'New Super',
        role: 'super_admin',
        email: 'new.super@example.com',
        password: 'temp-pass-123',
      },
      { userRepository }
    )
    expect(result.ok).toBe(false)
  })
})
