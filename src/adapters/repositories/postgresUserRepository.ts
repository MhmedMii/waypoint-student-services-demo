import type { Pool } from 'pg'
import type { User, UserRole } from '../../domain/entities/user'
import type { UserRepository, CreateUserInput } from '../../application/ports/UserRepository'
import { kuwaitDayKey } from '../../domain/time/kuwaitTime'

function rowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    nameAr: row.name_ar,
    role: row.role,
    email: row.email,
    passwordHash: row.password_hash,
    active: row.active,
    lastSeenAt: row.last_seen_at,
    onlineSecondsToday: row.online_seconds_today,
    onlineDay: row.online_day,
    shift: row.shift,
    floor: row.floor,
    note: row.note,
  }
}

export function createPostgresUserRepository(pool: Pool): UserRepository {
  return {
    async findByEmail(email) {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
      return result.rows[0] ? rowToUser(result.rows[0]) : null
    },
    async findById(id) {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id])
      return result.rows[0] ? rowToUser(result.rows[0]) : null
    },
    async findActiveCounselors() {
      const result = await pool.query(
        "SELECT * FROM users WHERE role = 'counselor' AND active = true"
      )
      return result.rows.map(rowToUser)
    },
    async findAll() {
      const result = await pool.query('SELECT * FROM users ORDER BY name')
      return result.rows.map(rowToUser)
    },
    async create(input: CreateUserInput) {
      const result = await pool.query(
        'INSERT INTO users (name, role, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
        [input.name, input.role, input.email, input.passwordHash]
      )
      return rowToUser(result.rows[0])
    },
    async setActive(userId, active) {
      await pool.query('UPDATE users SET active = $2 WHERE id = $1', [userId, active])
    },
    async setPasswordHash(userId, passwordHash) {
      await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash])
    },
    async setName(userId, name) {
      await pool.query('UPDATE users SET name = $2 WHERE id = $1', [userId, name])
    },
    async setNameAr(userId, nameAr) {
      await pool.query('UPDATE users SET name_ar = $2 WHERE id = $1', [userId, nameAr])
    },
    async countByRole(role: UserRole) {
      const result = await pool.query('SELECT COUNT(*)::int AS count FROM users WHERE role = $1', [
        role,
      ])
      return result.rows[0].count
    },
    // الحساب مربوط بسبع جداول بمفاتيح أجنبية، وما فيه ولا ON DELETE بالسكيما — فحذف
    // مباشر يطيح بـ foreign key violation لأي حساب سجّل دخول أو سوّى أي إجراء.
    // نفكّ الارتباطات كلها بـ transaction وحدة: البيانات اللي تخص الحساب نفسه تنحذف،
    // والإسنادات تنفضّى. سجل النشاط ما ينحذف أبداً — نفضّي actor_id بس ويبقى
    // actor_name نص، عشان الأثر يضل مقروء بعد ما ينحذف الحساب.
    async deleteUser(userId) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('UPDATE activity_logs SET actor_id = NULL WHERE actor_id = $1', [userId])
        await client.query('UPDATE visits SET counselor_id = NULL WHERE counselor_id = $1', [
          userId,
        ])
        await client.query('UPDATE visits SET created_by = NULL WHERE created_by = $1', [userId])
        await client.query('UPDATE applications SET counselor_id = NULL WHERE counselor_id = $1', [
          userId,
        ])
        await client.query('DELETE FROM counselor_specialization WHERE counselor_id = $1', [userId])
        await client.query('DELETE FROM breaks WHERE counselor_id = $1', [userId])
        await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId])
        await client.query('DELETE FROM online_sessions WHERE user_id = $1', [userId])
        await client.query('DELETE FROM users WHERE id = $1', [userId])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
    async recordPresenceHeartbeat(userId, seenAt, incrementSeconds) {
      // نتأكد نمسح عداد "أونلاين اليوم" أول ما يوم جديد يبدأ — عملية وحدة ذرية بدون قراءة قبلها
      await pool.query(
        `UPDATE users SET
           last_seen_at = $2,
           online_seconds_today = CASE WHEN online_day = $4 THEN online_seconds_today + $3 ELSE $3 END,
           online_day = $4
         WHERE id = $1`,
        [userId, seenAt, incrementSeconds, kuwaitDayKey(seenAt)]
      )
    },
    async setShiftInfo(userId, shift, floor) {
      await pool.query('UPDATE users SET shift = $2, floor = $3 WHERE id = $1', [
        userId,
        shift,
        floor,
      ])
    },
    async setNote(userId, note) {
      await pool.query('UPDATE users SET note = $2 WHERE id = $1', [userId, note])
    },
    async setRole(userId, role) {
      await pool.query('UPDATE users SET role = $2 WHERE id = $1', [userId, role])
    },
  }
}
