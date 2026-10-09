import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { createPostgresUserRepository } from './postgresUserRepository'

function fakePool(failOn?: RegExp) {
  const statements: string[] = []
  const client = {
    query: vi.fn(async (sql: string) => {
      statements.push(sql)
      if (failOn && failOn.test(sql)) throw new Error('boom')
      return { rows: [] }
    }),
    release: vi.fn(),
  }
  const pool = { connect: async () => client } as unknown as Pool
  return { pool, client, statements }
}

const USER = '90ec21c6-91b1-4afc-8216-fc7d3f4c7197'

describe('postgresUserRepository.deleteUser', () => {
  it('clears every foreign-key reference before removing the row', async () => {
    const { pool, statements } = fakePool()
    await createPostgresUserRepository(pool).deleteUser(USER)

    const joined = statements.join('\n')
    // كل جدول يشير لـ users(id) لازم ينذكر، وإلا الحذف يفشل بالإنتاج
    expect(joined).toMatch(/online_sessions/)
    expect(joined).toMatch(/password_reset_tokens/)
    expect(joined).toMatch(/counselor_specialization/)
    expect(joined).toMatch(/breaks/)
    expect(joined).toMatch(/visits SET counselor_id = NULL/)
    expect(joined).toMatch(/visits SET created_by = NULL/)
    expect(joined).toMatch(/applications SET counselor_id = NULL/)
  })

  it('runs as one transaction, deleting the user last', async () => {
    const { pool, statements } = fakePool()
    await createPostgresUserRepository(pool).deleteUser(USER)

    expect(statements[0]).toBe('BEGIN')
    expect(statements[statements.length - 1]).toBe('COMMIT')
    const deleteUser = statements.findIndex((s) => s.startsWith('DELETE FROM users'))
    expect(deleteUser).toBe(statements.length - 2)
  })

  // الأهم: سجل التدقيق ما يروح مع الحساب — نفضّي الرابط بس
  it('nulls the audit trail link instead of deleting the log rows', async () => {
    const { pool, statements } = fakePool()
    await createPostgresUserRepository(pool).deleteUser(USER)

    expect(statements).toContain('UPDATE activity_logs SET actor_id = NULL WHERE actor_id = $1')
    expect(statements.some((s) => /DELETE FROM activity_logs/.test(s))).toBe(false)
  })

  it('rolls back and rethrows when a statement fails', async () => {
    const { pool, statements, client } = fakePool(/DELETE FROM users/)
    await expect(createPostgresUserRepository(pool).deleteUser(USER)).rejects.toThrow('boom')

    expect(statements).toContain('ROLLBACK')
    expect(statements).not.toContain('COMMIT')
    expect(client.release).toHaveBeenCalled()
  })

  it('releases the client even on success', async () => {
    const { pool, client } = fakePool()
    await createPostgresUserRepository(pool).deleteUser(USER)
    expect(client.release).toHaveBeenCalledTimes(1)
  })
})
