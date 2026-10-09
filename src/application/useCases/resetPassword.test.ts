import { describe, it, expect } from 'vitest'
import { resetPassword } from './resetPassword'
import { createFakeUserRepository } from '../testing/fakes'
import type { User } from '../../domain/entities/user'

const counselor: User = {
  id: 'u1',
  name: 'Counselor',
  role: 'counselor',
  email: 'c@example.com',
  passwordHash: 'old-hash',
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
  passwordHash: 'old-hash',
  active: true,
  lastSeenAt: null,
  onlineSecondsToday: 0,
  onlineDay: null,
  shift: null,
  floor: null,
}

describe('resetPassword', () => {
  it('replaces the password hash, as super_admin', async () => {
    const userRepository = createFakeUserRepository([counselor])
    const result = await resetPassword('super_admin', 'actor', 'u1', 'brand-new-password', {
      userRepository,
    })
    expect(result.ok).toBe(true)
    const updated = await userRepository.findById('u1')
    expect(updated?.passwordHash).not.toBe('old-hash')
  })

  it('rejects as admin', async () => {
    const userRepository = createFakeUserRepository([counselor])
    const result = await resetPassword('admin', 'actor', 'u1', 'brand-new-password', {
      userRepository,
    })
    expect(result.ok).toBe(false)
  })

  it('prevents a super admin from resetting their own password through account management', async () => {
    const userRepository = createFakeUserRepository([superAdmin])
    const result = await resetPassword('super_admin', 'u2', 'u2', 'brand-new-password', {
      userRepository,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('cannotChangeOwnAccount')
    const updated = await userRepository.findById('u2')
    expect(updated?.passwordHash).toBe('old-hash')
  })

  it('rejects a password shorter than the minimum length', async () => {
    // مستخدم مستقل بدل إعادة استخدام counselor المشترك — الفيك يعدّل الكائن
    // بالمكان مباشرة، فاختبار سابق بالملف يكون خلّى passwordHash يتغيّر عليه
    const freshCounselor: User = {
      id: 'u3',
      name: 'Fresh Counselor',
      role: 'counselor',
      email: 'fresh@example.com',
      passwordHash: 'old-hash',
      active: true,
      lastSeenAt: null,
      onlineSecondsToday: 0,
      onlineDay: null,
      shift: null,
      floor: null,
    }
    const userRepository = createFakeUserRepository([freshCounselor])
    const result = await resetPassword('super_admin', 'actor', 'u3', 'short', { userRepository })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('passwordTooWeak')
    const updated = await userRepository.findById('u3')
    expect(updated?.passwordHash).toBe('old-hash')
  })
})
