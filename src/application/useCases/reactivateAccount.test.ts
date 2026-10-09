import { describe, it, expect } from 'vitest'
import { reactivateAccount } from './reactivateAccount'
import { createFakeUserRepository } from '../testing/fakes'
import type { User } from '../../domain/entities/user'

const deactivatedCounselor: User = {
  id: 'u1',
  name: 'Old Counselor',
  role: 'counselor',
  email: 'old.counselor@example.com',
  passwordHash: 'x',
  active: false,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

describe('reactivateAccount', () => {
  it('sets active back to true, as super_admin', async () => {
    const userRepository = createFakeUserRepository([deactivatedCounselor])
    const result = await reactivateAccount('super_admin', 'u1', { userRepository })
    expect(result.ok).toBe(true)
    const updated = await userRepository.findById('u1')
    expect(updated?.active).toBe(true)
  })

  it('rejects as admin', async () => {
    const userRepository = createFakeUserRepository([deactivatedCounselor])
    const result = await reactivateAccount('admin', 'u1', { userRepository })
    expect(result.ok).toBe(false)
  })
})
