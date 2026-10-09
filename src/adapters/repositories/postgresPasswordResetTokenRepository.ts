import type { Pool } from 'pg'
import type {
  PasswordResetTokenRecord,
  PasswordResetTokenRepository,
} from '../../application/ports/PasswordResetTokenRepository'

function rowToRecord(row: any): PasswordResetTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  }
}

export function createPostgresPasswordResetTokenRepository(
  pool: Pool
): PasswordResetTokenRepository {
  return {
    async create(userId, tokenHash, expiresAt) {
      const result = await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING *',
        [userId, tokenHash, expiresAt]
      )
      return rowToRecord(result.rows[0])
    },
    async findByTokenHash(tokenHash) {
      const result = await pool.query('SELECT * FROM password_reset_tokens WHERE token_hash = $1', [
        tokenHash,
      ])
      return result.rows[0] ? rowToRecord(result.rows[0]) : null
    },
    async markUsed(id, usedAt) {
      await pool.query('UPDATE password_reset_tokens SET used_at = $2 WHERE id = $1', [id, usedAt])
    },
    async claimToken(tokenHash, usedAt) {
      const result = await pool.query(
        'UPDATE password_reset_tokens SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL RETURNING *',
        [tokenHash, usedAt]
      )
      return result.rows[0] ? rowToRecord(result.rows[0]) : null
    },
  }
}
