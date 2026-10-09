import { it, expect, beforeAll, afterAll } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import { createPostgresSpecializationRepository } from './postgresSpecializationRepository'

const runIntegration = integrationDescribe

// مكان الدورة يعتمد على ختم آخر استلام لكل نطاق. الـSQL هو اللي يقرر إذا
// الختم ينحط على النطاق الصح بس، وإذا تعديل النطاقات يمسحه — والمزيّف ما يثبت هذا
runIntegration('postgresSpecializationRepository round-robin position (integration)', () => {
  let pool: Pool
  const ids: string[] = []

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
    for (const name of ['Rotation A', 'Rotation B']) {
      const user = await pool.query(
        `INSERT INTO users (name, role, email, password_hash, active, shift, floor)
         VALUES ($1, 'counselor', $2, 'x', true, 'day', 'M1') RETURNING id`,
        [name, `rotation-${name.slice(-1).toLowerCase()}-${Date.now()}@example.com`]
      )
      ids.push(user.rows[0].id)
    }
    const repo = createPostgresSpecializationRepository(pool)
    await repo.setScopes(ids[0], ['Egypt', 'Medicine'])
    await repo.setScopes(ids[1], ['Egypt'])
  })

  afterAll(async () => {
    await pool.query('DELETE FROM counselor_specialization WHERE counselor_id = ANY($1::uuid[])', [
      ids,
    ])
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids])
    await pool.end()
  })

  it('stamps only the scope that was assigned, so another scope keeps its own position', async () => {
    const repo = createPostgresSpecializationRepository(pool)
    await repo.recordAssignment(ids[1], 'Egypt', new Date('2026-09-24T08:00:00Z'))
    await repo.recordAssignment(ids[0], 'Medicine', new Date('2026-09-24T09:00:00Z'))

    // عميل Medicine لـA ما يحرّك دورة Egypt: آخر من استلم Egypt لسا B
    expect(await repo.findLastAssignedCounselorForScope('Egypt')).toBe(ids[1])
    expect(await repo.findLastAssignedCounselorForScope('Medicine')).toBe(ids[0])
  })

  it('keeps the position when a counselor’s scopes are edited', async () => {
    const repo = createPostgresSpecializationRepository(pool)
    await repo.recordAssignment(ids[1], 'Egypt', new Date('2026-09-24T10:00:00Z'))
    // B ينضاف له نطاق — قبل، هذا كان يمسح ختم Egypt ويرجّع الدورة خطوة
    await repo.setScopes(ids[1], ['Egypt', 'GCC'])

    expect(await repo.findLastAssignedCounselorForScope('Egypt')).toBe(ids[1])
    const scopes = await repo.findScopesForCounselor(ids[1])
    expect([...scopes].sort()).toEqual(['Egypt', 'GCC'])
  })

  it('still removes a scope that was taken away', async () => {
    const repo = createPostgresSpecializationRepository(pool)
    await repo.setScopes(ids[0], ['Egypt'])
    expect(await repo.findScopesForCounselor(ids[0])).toEqual(['Egypt'])
    expect(await repo.findLastAssignedCounselorForScope('Medicine')).toBeNull()
  })
})
