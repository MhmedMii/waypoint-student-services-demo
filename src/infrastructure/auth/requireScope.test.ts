import { describe, it, expect } from 'vitest'
import { requireScope } from './requireScope'

describe('requireScope', () => {
  it('allows super_admin regardless of scopes', () => {
    const result = requireScope({ user: { role: 'super_admin' } } as any, 'visa_services')
    expect(result).toEqual({ ok: true })
  })

  it('allows a counselor with the matching scope', () => {
    const session = { user: { role: 'counselor', scopes: ['visa_services'] } } as any
    const result = requireScope(session, 'visa_services')
    expect(result).toEqual({ ok: true })
  })

  it('rejects a counselor without the matching scope', () => {
    const session = { user: { role: 'counselor', scopes: ['exam_services'] } } as any
    const result = requireScope(session, 'visa_services')
    expect(result).toEqual({ ok: false, redirectTo: '/login' })
  })

  it('rejects a counselor with no scopes at all', () => {
    const session = { user: { role: 'counselor' } } as any
    const result = requireScope(session, 'visa_services')
    expect(result).toEqual({ ok: false, redirectTo: '/login' })
  })

  it('rejects the admin role even with a matching scope', () => {
    const session = { user: { role: 'admin', scopes: ['visa_services'] } } as any
    const result = requireScope(session, 'visa_services')
    expect(result).toEqual({ ok: false, redirectTo: '/login' })
  })

  it('rejects a missing session', () => {
    const result = requireScope(null, 'visa_services')
    expect(result).toEqual({ ok: false, redirectTo: '/login' })
  })
})
