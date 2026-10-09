import type { Pool } from 'pg'
import type { BreakRecord, BreakRepository } from '../../application/ports/BreakRepository'
import { startOfKuwaitDay } from '../../domain/time/kuwaitTime'

function rowToBreak(row: any): BreakRecord {
  return {
    id: row.id,
    counselorId: row.counselor_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

export function createPostgresBreakRepository(pool: Pool): BreakRepository {
  return {
    async startBreak(counselorId, startedAt) {
      const result = await pool.query(
        'INSERT INTO breaks (counselor_id, started_at) VALUES ($1, $2) RETURNING *',
        [counselorId, startedAt]
      )
      return rowToBreak(result.rows[0])
    },
    // كان يقفل كل الاستراحات المفتوحة بنفس الوقت، فصفان يصيران فترتين كاملتين
    // بدل وحدة. نقفل الأقدم فقط — والفهرس أدناه يضمن إنها الوحيدة أصلاً
    async endBreak(counselorId, endedAt) {
      await pool.query(
        `UPDATE breaks SET ended_at = $2
         WHERE id = (
           SELECT id FROM breaks
           WHERE counselor_id = $1 AND ended_at IS NULL
           ORDER BY started_at ASC
           LIMIT 1
         )`,
        [counselorId, endedAt]
      )
    },
    async findOpenBreak(counselorId) {
      const result = await pool.query(
        'SELECT * FROM breaks WHERE counselor_id = $1 AND ended_at IS NULL LIMIT 1',
        [counselorId]
      )
      return result.rows[0] ? rowToBreak(result.rows[0]) : null
    },
    async sumFinishedBreakMsToday(counselorId, now) {
      const startOfDay = startOfKuwaitDay(now)
      const result = await pool.query(
        `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000), 0)::bigint AS total_ms
         FROM breaks WHERE counselor_id = $1 AND ended_at IS NOT NULL AND started_at >= $2`,
        [counselorId, startOfDay]
      )
      return Number(result.rows[0].total_ms)
    },
  }
}
