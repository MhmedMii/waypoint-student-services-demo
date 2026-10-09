import { describe, it, expect } from 'vitest'
import { middleware } from '../middleware'
import { pool } from '../infrastructure/db/pool'
import { nodemailerEmailSender } from '../infrastructure/email/nodemailerEmailSender'
import { createVercelBlobStorage } from '../infrastructure/storage/vercelBlobStorage'
import type { NextRequest } from 'next/server'

describe('demo isolation', () => {
  it('blocks production APIs before they reach authentication or persistence', async () => {
    for (const pathname of [
      '/api/auth/session',
      '/api/applications/upload',
      '/api/admin/accounts',
    ]) {
      const response = middleware({ nextUrl: { pathname } } as NextRequest)
      expect(response.status).toBe(410)
      expect(await response.json()).toMatchObject({ ok: false })
    }
  })
  it('offers a health endpoint that needs no production connection', async () => {
    const response = middleware({ nextUrl: { pathname: '/api/health' } } as NextRequest)
    expect(await response.json()).toMatchObject({ mode: 'fictional-demo', externalServices: false })
  })
  it('refuses database access even when environment configuration exists', () => {
    expect(() => pool.query).toThrow('Database access is disabled')
  })
  it('uses inert email and document adapters', async () => {
    await expect(
      nodemailerEmailSender.sendPasswordResetEmail(
        'student@example.com',
        'https://example.com/demo'
      )
    ).resolves.toBeUndefined()
    await expect(createVercelBlobStorage().getStream('demo-document.txt')).resolves.toBeNull()
  })
})
