import { describe, it, expect } from 'vitest'
import { listAccounts } from './listAccounts'
import { createFakeUserRepository, createFakeSpecializationRepository } from '../testing/fakes'
import type { User } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'

const counselor: User = {
  id: 'u1',
  name: 'Old Counselor',
  role: 'counselor',
  email: 'old.counselor@example.com',
  passwordHash: 'secret-hash',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}
const admin: User = {
  id: 'u2',
  name: 'Front Admin',
  role: 'admin',
  email: 'front.admin@example.com',
  passwordHash: 'other-hash',
  active: false,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

function run(
  users: User[],
  candidates: { id: string; scopes: SpecializationScope[]; lastAssignedAt: Date | null }[] = []
) {
  return listAccounts({
    userRepository: createFakeUserRepository(users),
    specializationRepository: createFakeSpecializationRepository(candidates),
  })
}

describe('listAccounts', () => {
  it('lists every account without leaking passwordHash', async () => {
    const result = await run([counselor, admin])

    expect(result).toHaveLength(2)
    for (const user of result) {
      expect(user).not.toHaveProperty('passwordHash')
    }
    expect(result.find((u) => u.id === 'u2')?.active).toBe(false)
  })

  it('carries each counselor their scopes, so the page can show them', async () => {
    const result = await run(
      [counselor, admin],
      [{ id: 'u1', scopes: ['USA', 'UK & Ireland', 'visa_services'], lastAssignedAt: null }]
    )
    expect(result.find((u) => u.id === 'u1')?.scopes).toEqual([
      'USA',
      'UK & Ireland',
      'visa_services',
    ])
  })

  // مستشار بلا نطاقات ما يوصله عميل أبدًا — الصفحة لازم تقدر تبيّن هالحالة
  it('reports an empty list for a counselor with no scopes at all', async () => {
    const result = await run([counselor], [])
    expect(result.find((u) => u.id === 'u1')?.scopes).toEqual([])
  })

  it('gives non-counselors an empty list rather than leaving it undefined', async () => {
    const result = await run([admin], [])
    expect(result.find((u) => u.id === 'u2')?.scopes).toEqual([])
  })
})
