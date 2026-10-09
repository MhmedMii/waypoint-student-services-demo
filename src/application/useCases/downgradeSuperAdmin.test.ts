import { describe, it, expect } from 'vitest'
import { downgradeSuperAdmin } from './downgradeSuperAdmin'
import { createFakeUserRepository } from '../testing/fakes'
import type { User } from '../../domain/entities/user'

const firstSuperAdmin: User = {
  id: 'u1',
  name: 'First Super',
  role: 'super_admin',
  email: 'first@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}
const secondSuperAdmin: User = {
  id: 'u2',
  name: 'Second Super',
  role: 'super_admin',
  email: 'second@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}
const admin: User = {
  id: 'u3',
  name: 'Admin',
  role: 'admin',
  email: 'admin@example.com',
  passwordHash: 'x',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

describe('downgradeSuperAdmin', () => {
  it('allows a super admin to downgrade another super admin', async () => {
    const userRepository = createFakeUserRepository([firstSuperAdmin, secondSuperAdmin])
    const result = await downgradeSuperAdmin('super_admin', 'u1', 'u2', { userRepository })
    expect(result.ok).toBe(true)
    expect((await userRepository.findById('u2'))?.role).toBe('admin')
  })

  it('prevents a super admin from downgrading their own account', async () => {
    const userRepository = createFakeUserRepository([firstSuperAdmin])
    const result = await downgradeSuperAdmin('super_admin', 'u1', 'u1', { userRepository })
    expect(result).toEqual({ ok: false, reason: 'cannotChangeOwnAccount' })
  })

  it('rejects when actor role is not super_admin', async () => {
    const userRepository = createFakeUserRepository([firstSuperAdmin, secondSuperAdmin])
    const result = await downgradeSuperAdmin('admin', 'u3', 'u1', { userRepository })
    expect(result).toEqual({ ok: false, reason: 'onlySuperAdmin' })
  })

  it('rejects downgrading a non-super_admin account', async () => {
    const userRepository = createFakeUserRepository([firstSuperAdmin, admin])
    const result = await downgradeSuperAdmin('super_admin', 'u1', 'u3', { userRepository })
    expect(result).toEqual({ ok: false, reason: 'onlySuperAdminDowngradable' })
  })
})
