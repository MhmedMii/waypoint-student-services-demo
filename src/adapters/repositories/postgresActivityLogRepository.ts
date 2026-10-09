import type { Pool } from 'pg'
import type { ActivityLog } from '../../domain/entities/activityLog'
import type {
  ActivityLogRepository,
  CreateActivityLogInput,
} from '../../application/ports/ActivityLogRepository'

function rowToActivityLog(row: any): ActivityLog {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorNameAr: row.actor_name_ar ?? null,
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: row.details,
    detailsAr: row.details_ar,
    createdAt: row.created_at,
  }
}

export function createPostgresActivityLogRepository(pool: Pool): ActivityLogRepository {
  return {
    async create(input: CreateActivityLogInput) {
      const result = await pool.query(
        `INSERT INTO activity_logs (actor_id, actor_name, actor_role, action, target_type, target_id, details, details_ar)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          input.actorId,
          input.actorName,
          input.actorRole,
          input.action,
          input.targetType,
          input.targetId,
          input.details,
          input.detailsAr,
        ]
      )
      return rowToActivityLog(result.rows[0])
    },
    async findInRange(fromInclusive, limit) {
      const result = await pool.query(
        `SELECT activity_logs.*, users.name_ar AS actor_name_ar
         FROM activity_logs
         LEFT JOIN users ON users.id = activity_logs.actor_id
         WHERE $1::timestamptz IS NULL OR activity_logs.created_at >= $1
         ORDER BY activity_logs.created_at DESC
         LIMIT $2`,
        [fromInclusive, limit]
      )
      return result.rows.map(rowToActivityLog)
    },
    async findAllInRange(fromInclusive) {
      // نجيب name_ar بالوقت الحالي من users (لا نخزّنه وقت الحدث) — عشان لو
      // اتصحح اسم شخص بالعربي بعدين، السجلات القديمة تعرضه صحيح تلقائيًا
      const result = await pool.query(
        `SELECT activity_logs.*, users.name_ar AS actor_name_ar
         FROM activity_logs
         LEFT JOIN users ON users.id = activity_logs.actor_id
         WHERE $1::timestamptz IS NULL OR activity_logs.created_at >= $1
         ORDER BY activity_logs.created_at DESC`,
        [fromInclusive]
      )
      return result.rows.map(rowToActivityLog)
    },
    async countInRange(fromInclusive) {
      const result = await pool.query(
        'SELECT count(*)::int AS total FROM activity_logs WHERE $1::timestamptz IS NULL OR created_at >= $1',
        [fromInclusive]
      )
      return result.rows[0].total
    },
    async countAll() {
      const result = await pool.query('SELECT count(*)::int AS total FROM activity_logs')
      return result.rows[0].total
    },
  }
}
