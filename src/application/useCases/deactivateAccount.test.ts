import { describe, it, expect } from 'vitest'
import { deactivateAccount } from './deactivateAccount'
import { createFakeUserRepository } from '../testing/fakes'
import type { User } from '../../domain/entities/user'

const counselor: User = {
  id: 'u1',
  name: 'Old Counselor',
  role: 'counselor',
  email: 'old.counselor@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}
const superAdmin: User = {
  id: 'u2',
  name: 'Eng. Demo Maintainer',
  role: 'super_admin',
  email: 'owner@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

describe('deactivateAccount', () => {
  it('soft-deletes by setting active to false, as super_admin', async () => {
    const userRepository = createFakeUserRepository([counselor])
    const result = await deactivateAccount('super_admin', 'actor', 'u1', { userRepository })
    expect(result.ok).toBe(true)
    const updated = await userRepository.findById('u1')
    expect(updated?.active).toBe(false)
  })

  it('rejects as admin', async () => {
    const userRepository = createFakeUserRepository([counselor])
    const result = await deactivateAccount('admin', 'actor', 'u1', { userRepository })
    expect(result.ok).toBe(false)
  })

  it('prevents a super admin from deactivating their own account', async () => {
    const userRepository = createFakeUserRepository([superAdmin])
    const result = await deactivateAccount('super_admin', 'u2', 'u2', { userRepository })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('cannotChangeOwnAccount')
    const updated = await userRepository.findById('u2')
    expect(updated?.active).toBe(true)
  })
})
