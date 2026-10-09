import type { Pool } from 'pg'
import type { OnlineSession } from '../../domain/entities/onlineSession'
import type { OnlineSessionRepository } from '../../application/ports/OnlineSessionRepository'

function rowToSession(row: any): OnlineSession {
  return { id: row.id, userId: row.user_id, startedAt: row.started_at, endedAt: row.ended_at }
}

export function createPostgresOnlineSessionRepository(pool: Pool): OnlineSessionRepository {
  return {
    async findMostRecent(userId) {
      const result = await pool.query(
        'SELECT * FROM online_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1',
        [userId]
      )
      return result.rows[0] ? rowToSession(result.rows[0]) : null
    },
    async create(userId, startedAt, endedAt) {
      const result = await pool.query(
        'INSERT INTO online_sessions (user_id, started_at, ended_at) VALUES ($1, $2, $3) RETURNING *',
        [userId, startedAt, endedAt]
      )
      return rowToSession(result.rows[0])
    },
    async extendEnd(sessionId, endedAt) {
      await pool.query('UPDATE online_sessions SET ended_at = $2 WHERE id = $1', [
        sessionId,
        endedAt,
      ])
    },
    async findForUserInRange(userId, fromInclusive, toExclusive) {
      const result = await pool.query(
        'SELECT * FROM online_sessions WHERE user_id = $1 AND started_at >= $2 AND started_at < $3 ORDER BY started_at ASC',
        [userId, fromInclusive, toExclusive]
      )
      return result.rows.map(rowToSession)
    },
  }
}
