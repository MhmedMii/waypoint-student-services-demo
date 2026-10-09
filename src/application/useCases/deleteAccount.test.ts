import { describe, it, expect } from 'vitest'
import { deleteAccount } from './deleteAccount'
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

describe('deleteAccount', () => {
  it('removes the account as super_admin', async () => {
    const userRepository = createFakeUserRepository([counselor])
    const result = await deleteAccount('super_admin', 'actor', 'u1', { userRepository })
    expect(result.ok).toBe(true)
    expect(await userRepository.findById('u1')).toBeNull()
  })

  it('rejects as admin', async () => {
    const userRepository = createFakeUserRepository([counselor])
    const result = await deleteAccount('admin', 'actor', 'u1', { userRepository })
    expect(result.ok).toBe(false)
    expect(await userRepository.findById('u1')).not.toBeNull()
  })

  it('prevents a super admin from deleting their own account', async () => {
    const userRepository = createFakeUserRepository([superAdmin])
    const result = await deleteAccount('super_admin', 'u2', 'u2', { userRepository })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('cannotChangeOwnAccount')
    expect(await userRepository.findById('u2')).not.toBeNull()
  })
})
