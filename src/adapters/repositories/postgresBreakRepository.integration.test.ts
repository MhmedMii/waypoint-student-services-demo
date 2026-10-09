import { it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import { createPostgresBreakRepository } from './postgresBreakRepository'

const runIntegration = integrationDescribe

// النصف الثاني من البق كان بالـSQL وحده: النسخة المزيّفة تقفل استراحة وحدة
// أصلاً، فما كان أي تست وحدة يقدر يمسكه. لازم قاعدة حقيقية
runIntegration('postgresBreakRepository (integration)', () => {
  let pool: Pool
  let counselorId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const user = await pool.query(
      `INSERT INTO users (name, role, email, password_hash, active, shift, floor)
       VALUES ('Break Fixture', 'counselor', $1, 'x', true, 'day', 'M1') RETURNING id`,
      [`break-fixture-${Date.now()}@example.com`]
    )
    counselorId = user.rows[0].id
  })

  afterAll(async () => {
    await pool.query('DELETE FROM breaks WHERE counselor_id = $1', [counselorId])
    await pool.query('DELETE FROM users WHERE id = $1', [counselorId])
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM breaks WHERE counselor_id = $1', [counselorId])
  })

  it('refuses a second open break at the database level', async () => {
    const breaks = createPostgresBreakRepository(pool)
    await breaks.startBreak(counselorId, new Date())

    await expect(breaks.startBreak(counselorId, new Date())).rejects.toThrow(
      /breaks_one_open_per_counselor/
    )
  })

  it('allows a new break once the previous one has ended', async () => {
    const breaks = createPostgresBreakRepository(pool)
    await breaks.startBreak(counselorId, new Date('2026-08-12T11:00:00Z'))
    await breaks.endBreak(counselorId, new Date('2026-08-12T11:30:00Z'))

    await expect(
      breaks.startBreak(counselorId, new Date('2026-08-12T14:00:00Z'))
    ).resolves.toBeDefined()
  })

  // لو تسلّل صفان مفتوحان بأي طريقة، الإنهاء يقفل واحدًا فقط — قبل كذا كان
  // يقفلهم كلهم بنفس الوقت فتنحسب الفترة مرتين
  it('closes exactly one open break, never every open row', async () => {
    const breaks = createPostgresBreakRepository(pool)
    // نتجاوز الكود ونكتب صفين مباشرة، نحاكي بيانات قديمة قبل الفهرس
    await pool.query('ALTER TABLE breaks DISABLE TRIGGER ALL')
    await pool.query('DROP INDEX IF EXISTS breaks_one_open_per_counselor')
    try {
      await pool.query('INSERT INTO breaks (counselor_id, started_at) VALUES ($1, $2), ($1, $3)', [
        counselorId,
        new Date('2026-08-12T11:00:00Z'),
        new Date('2026-08-12T11:00:02Z'),
      ])
      await breaks.endBreak(counselorId, new Date('2026-08-12T11:30:00Z'))

      const stillOpen = await pool.query(
        'SELECT count(*)::int AS n FROM breaks WHERE counselor_id = $1 AND ended_at IS NULL',
        [counselorId]
      )
      expect(stillOpen.rows[0].n).toBe(1)
    } finally {
      await pool.query('DELETE FROM breaks WHERE counselor_id = $1', [counselorId])
      await pool.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS breaks_one_open_per_counselor ON breaks (counselor_id) WHERE ended_at IS NULL'
      )
      await pool.query('ALTER TABLE breaks ENABLE TRIGGER ALL')
    }
  })

  it('sums a single break once', async () => {
    const breaks = createPostgresBreakRepository(pool)
    const now = new Date()
    const startedAt = new Date(now.getTime() - 30 * 60 * 1000)
    await breaks.startBreak(counselorId, startedAt)
    await breaks.endBreak(counselorId, now)

    const total = await breaks.sumFinishedBreakMsToday(counselorId, now)
    expect(total).toBeGreaterThan(29 * 60 * 1000)
    expect(total).toBeLessThan(31 * 60 * 1000)
  })
})
