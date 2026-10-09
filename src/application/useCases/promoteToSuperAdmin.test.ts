import { describe, it, expect } from 'vitest'
import { promoteToSuperAdmin } from './promoteToSuperAdmin'
import { createFakeUserRepository } from '../testing/fakes'
import type { User } from '../../domain/entities/user'

function makeAdmin(): User {
  return {
    id: 'u1',
    name: 'Sara Admin',
    role: 'admin',
    email: 'sara.admin@example.com',
    passwordHash: 'x',
    active: true,
    lastSeenAt: null,
    onlineSecondsToday: 0,
    onlineDay: null,
    shift: null,
    floor: null,
  }
}
function makeCounselor(): User {
  return {
    id: 'u2',
    name: 'Fictional Student M',
    role: 'counselor',
    email: 'omar.counselor@example.com',
    passwordHash: 'x',
    active: true,
    lastSeenAt: null,
    onlineSecondsToday: 0,
    onlineDay: null,
    shift: null,
    floor: null,
  }
}
function makeSuperAdmin1(): User {
  return {
    id: 'u3',
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
}
function makeSuperAdmin2(): User {
  return {
    id: 'u4',
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
}

describe('promoteToSuperAdmin', () => {
  it('promotes an admin to super_admin when under the cap', async () => {
    const userRepository = createFakeUserRepository([makeAdmin(), makeSuperAdmin1()])
    const result = await promoteToSuperAdmin('super_admin', 'u1', { userRepository })
    expect(result.ok).toBe(true)
    const updated = await userRepository.findById('u1')
    expect(updated?.role).toBe('super_admin')
  })

  it('rejects as admin actor', async () => {
    const userRepository = createFakeUserRepository([makeAdmin(), makeSuperAdmin1()])
    const result = await promoteToSuperAdmin('admin', 'u1', { userRepository })
    expect(result.ok).toBe(false)
  })

  it('rejects promoting a counselor', async () => {
    const userRepository = createFakeUserRepository([makeCounselor(), makeSuperAdmin1()])
    const result = await promoteToSuperAdmin('super_admin', 'u2', { userRepository })
    expect(result.ok).toBe(false)
  })

  it('rejects once 2 super-admins already exist', async () => {
    const userRepository = createFakeUserRepository([
      makeAdmin(),
      makeSuperAdmin1(),
      makeSuperAdmin2(),
    ])
    const result = await promoteToSuperAdmin('super_admin', 'u1', { userRepository })
    expect(result.ok).toBe(false)
    const updated = await userRepository.findById('u1')
    expect(updated?.role).toBe('admin')
  })
})
