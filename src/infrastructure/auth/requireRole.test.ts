// src/infrastructure/auth/requireRole.test.ts
import { describe, it, expect } from 'vitest'
import { requireRole } from './requireRole'

describe('requireRole', () => {
  it('allows a session whose role is in the allow-list', () => {
    const result = requireRole({ user: { role: 'counselor' } } as any, ['counselor', 'admin'])
    expect(result.ok).toBe(true)
  })

  it('rejects a session whose role is not in the allow-list', () => {
    const result = requireRole({ user: { role: 'counselor' } } as any, ['super_admin'])
    expect(result).toEqual({ ok: false, redirectTo: '/login' })
  })

  it('rejects a missing session', () => {
    const result = requireRole(null, ['counselor'])
    expect(result).toEqual({ ok: false, redirectTo: '/login' })
  })

  it('allows a NextAuth-shaped session and preserves id/name on the session object', () => {
    const session = { user: { id: 'u1', name: 'Fictional Student T', role: 'counselor' } } as any
    const result = requireRole(session, ['counselor'])
    expect(result).toEqual({ ok: true })
    expect(session.user.id).toBe('u1')
    expect(session.user.name).toBe('Fictional Student T')
  })
})
