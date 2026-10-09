import type { Pool } from 'pg'
import type { CounselorCandidate, SpecializationScope } from '../../domain/entities/counselor'
import type { SpecializationRepository } from '../../application/ports/SpecializationRepository'

export function createPostgresSpecializationRepository(pool: Pool): SpecializationRepository {
  return {
    async findScopesForCounselor(counselorId) {
      const result = await pool.query(
        'SELECT scope FROM counselor_specialization WHERE counselor_id = $1',
        [counselorId]
      )
      return result.rows.map((r) => r.scope as SpecializationScope)
    },
    async findScopesForCounselors(counselorIds) {
      if (counselorIds.length === 0) return {}
      const result = await pool.query(
        'SELECT counselor_id, scope FROM counselor_specialization WHERE counselor_id = ANY($1)',
        [counselorIds]
      )
      const byCounselor: Record<string, SpecializationScope[]> = {}
      for (const row of result.rows) {
        byCounselor[row.counselor_id] = [
          ...(byCounselor[row.counselor_id] ?? []),
          row.scope as SpecializationScope,
        ]
      }
      return byCounselor
    },
    async findCandidatesForActiveCounselors() {
      const result = await pool.query(`
        SELECT u.id, u.shift, u.last_seen_at, array_agg(cs.scope) AS scopes, MAX(cs.last_assigned_at) AS last_assigned_at
        FROM users u
        JOIN counselor_specialization cs ON cs.counselor_id = u.id
        WHERE u.role = 'counselor' AND u.active = true
        GROUP BY u.id, u.shift, u.last_seen_at
      `)
      return result.rows.map((row): CounselorCandidate => ({
        id: row.id,
        scopes: row.scopes,
        lastAssignedAt: row.last_assigned_at,
        shift: row.shift,
        lastSeenAt: row.last_seen_at,
      }))
    },
    async countDeactivatedScopeHolders(scope) {
      const result = await pool.query(
        `SELECT count(*)::int AS total
         FROM counselor_specialization cs
         JOIN users u ON u.id = cs.counselor_id
         WHERE cs.scope = $1 AND u.role = 'counselor' AND u.active = false`,
        [scope]
      )
      return result.rows[0]?.total ?? 0
    },
    async setScopes(counselorId, scopes) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // نحذف بس النطاقات اللي انشالت، ونضيف الجديدة. قبل كان يحذف الكل ويعيد
        // الإضافة، فيمسح ختم آخر استلام — ومكان الدورة يعتمد عليه: لو كان هذا
        // المستشار آخر من استلم، الدورة ترجع خطوة وياخذ دورين ورا بعض
        await client.query(
          'DELETE FROM counselor_specialization WHERE counselor_id = $1 AND NOT (scope = ANY($2::text[]))',
          [counselorId, scopes]
        )
        for (const scope of scopes) {
          await client.query(
            `INSERT INTO counselor_specialization (counselor_id, scope)
             SELECT $1, $2
             WHERE NOT EXISTS (
               SELECT 1 FROM counselor_specialization WHERE counselor_id = $1 AND scope = $2
             )`,
            [counselorId, scope]
          )
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
    async findLastAssignedCounselorForScope(scope) {
      // المعطّل يحسب هنا: لو كان آخر من استلم، الدورة تكمل من مكانه بالترتيب
      const result = await pool.query(
        `SELECT counselor_id FROM counselor_specialization
         WHERE scope = $1 AND last_assigned_at IS NOT NULL
         ORDER BY last_assigned_at DESC, counselor_id DESC
         LIMIT 1`,
        [scope]
      )
      return result.rows[0]?.counselor_id ?? null
    },
    async recordAssignment(counselorId, scope, assignedAt) {
      await pool.query(
        'UPDATE counselor_specialization SET last_assigned_at = $3 WHERE counselor_id = $1 AND scope = $2',
        [counselorId, scope, assignedAt]
      )
    },
  }
}
