import { it, expect, beforeAll, afterAll } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import { createPostgresActivityLogRepository } from './postgresActivityLogRepository'

const runIntegration = integrationDescribe

// التصدير كان يسأل "آخر ٢٠٠" بغض النظر عن الفترة. الشكل الجديد لازم يرجع كل
// الفترة — والقص الصامت ما ينمسك إلا بقاعدة حقيقية فيها أكثر من ٢٠٠ صف
const FIXTURE_ROWS = 250
const MINUTE = 60 * 1000

runIntegration('postgresActivityLogRepository.findAllInRange (integration)', () => {
  let pool: Pool
  let actorId: string
  const newest = new Date('2026-09-24T09:00:00Z')

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const user = await pool.query(
      `INSERT INTO users (name, role, email, password_hash, active)
       VALUES ('Export Fixture', 'admin', $1, 'x', true) RETURNING id`,
      [`export-fixture-${Date.now()}@example.com`]
    )
    actorId = user.rows[0].id
    for (let i = 0; i < FIXTURE_ROWS; i++) {
      await pool.query(
        `INSERT INTO activity_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details, created_at)
         VALUES ($1, 'Export Fixture', 'admin', 'visit_closed', 'visit', 'fixture', $2, $3)`,
        [actorId, `row ${i}`, new Date(newest.getTime() - i * 10 * MINUTE)]
      )
    }
  })

  afterAll(async () => {
    await pool.query('DELETE FROM activity_logs WHERE actor_id = $1', [actorId])
    await pool.query('DELETE FROM users WHERE id = $1', [actorId])
    await pool.end()
  })

  const mine = (rows: { actorId: string | null }[]) => rows.filter((r) => r.actorId === actorId)

  it('returns every event for any date, not the newest 200', async () => {
    const rows = mine(await createPostgresActivityLogRepository(pool).findAllInRange(null))
    expect(rows).toHaveLength(FIXTURE_ROWS)
  })

  it('returns newest first', async () => {
    const rows = mine(await createPostgresActivityLogRepository(pool).findAllInRange(null))
    const times = rows.map((r: any) => new Date(r.createdAt).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('returns only the events from the start of the period onwards, all of them', async () => {
    // ١٠٠ صف × ١٠ دقايق قبل الأحدث = بداية الفترة؛ الصفوف ٠..١٠٠ داخلها
    const start = new Date(newest.getTime() - 100 * 10 * MINUTE)
    const rows = mine(await createPostgresActivityLogRepository(pool).findAllInRange(start))
    expect(rows).toHaveLength(101)
    expect(rows.every((r: any) => new Date(r.createdAt) >= start)).toBe(true)
  })
})
