import type { Pool } from 'pg'
import type { Visit, VisitStatus } from '../../domain/entities/visit'
import type { VisitRepository, CreateVisitInput } from '../../application/ports/VisitRepository'
import { NORMALIZED_NAME_SQL } from './normalizedNameSql'
import { escapeLikeWildcards, LIKE_ESCAPE_CHAR } from './likeSearchPattern'
import { NAME_SEARCH_FETCH_LIMIT } from '../../domain/text/searchPage'
import {
  encryptSensitiveText,
  decryptSensitiveText,
  createSearchableFingerprint,
} from '../../infrastructure/crypto/fieldEncryption'
import { startOfKuwaitDay } from '../../domain/time/kuwaitTime'

function rowToVisit(row: any): Visit {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    phone: decryptSensitiveText(row.phone_encrypted),
    desiredCountry: row.desired_country,
    counselorId: row.counselor_id,
    requestedCounselorId: row.requested_counselor_id ?? null,
    assignedAt: row.assigned_at ?? null,
    linkedVisitId: row.linked_visit_id,
    status: row.status,
    studentStatus: row.student_status,
    pickedUpAt: row.picked_up_at,
    closedAt: row.closed_at,
    note: row.counselor_note,
    followUpDueAt: row.follow_up_due_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createPostgresVisitRepository(pool: Pool): VisitRepository {
  return {
    async create(input: CreateVisitInput) {
      const result = await pool.query(
        // assigned_at بنفس اللحظة لو انعطى مستشار عند الوصول، وإلا يبقى فاضي
        `INSERT INTO visits (type, name, phone_encrypted, phone_search_hash, desired_country, counselor_id, linked_visit_id, created_by,
                             requested_counselor_id, assigned_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $6::uuid IS NULL THEN NULL ELSE now() END)
         RETURNING *`,
        [
          input.type,
          input.name,
          encryptSensitiveText(input.phone),
          createSearchableFingerprint(input.phone),
          input.desiredCountry,
          input.counselorId,
          input.linkedVisitId,
          input.createdBy,
          input.requestedCounselorId,
        ]
      )
      return rowToVisit(result.rows[0])
    },
    async findById(id) {
      const result = await pool.query('SELECT * FROM visits WHERE id = $1', [id])
      return result.rows[0] ? rowToVisit(result.rows[0]) : null
    },
    async findMostRecentByPhone(phone) {
      const result = await pool.query(
        'SELECT * FROM visits WHERE phone_search_hash = $1 ORDER BY created_at DESC LIMIT 1',
        [createSearchableFingerprint(phone)]
      )
      return result.rows[0] ? rowToVisit(result.rows[0]) : null
    },
    async findMostRecentNewVisitByPhone(phone) {
      const result = await pool.query(
        "SELECT * FROM visits WHERE phone_search_hash = $1 AND type = 'new' ORDER BY created_at DESC LIMIT 1",
        [createSearchableFingerprint(phone)]
      )
      return result.rows[0] ? rowToVisit(result.rows[0]) : null
    },
    async findAssignedQueueForCounselor(counselorId) {
      const result = await pool.query(
        'SELECT * FROM visits WHERE counselor_id = $1 AND picked_up_at IS NULL ORDER BY created_at ASC',
        [counselorId]
      )
      return result.rows.map(rowToVisit)
    },
    async findInProgressForCounselor(counselorId) {
      const result = await pool.query(
        'SELECT * FROM visits WHERE counselor_id = $1 AND picked_up_at IS NOT NULL AND closed_at IS NULL LIMIT 1',
        [counselorId]
      )
      return result.rows[0] ? rowToVisit(result.rows[0]) : null
    },
    async findAllForCounselor(counselorId) {
      const result = await pool.query(
        'SELECT * FROM visits WHERE counselor_id = $1 ORDER BY created_at DESC',
        [counselorId]
      )
      return result.rows.map(rowToVisit)
    },
    // شاشة المستشار تسأل عن هالرقمين كل 5 ثواني، فنحسبهم بالـ SQL ونرجّع صف واحد —
    // لو جبنا كل زيارات المستشار وعددناهم بالـ JS بتكبر التكلفة كل يوم مع تراكم السجل
    async updateCounselor(visitId, counselorId) {
      // تعيين أو نقل = وقت جديد. الإلغاء (✕) يرجّعه فاضي — ما يصير عندنا وقت
      // تعيين لعميل بلا مستشار
      await pool.query(
        `UPDATE visits SET counselor_id = $2,
           assigned_at = CASE WHEN $2::uuid IS NULL THEN NULL ELSE now() END,
           updated_at = now()
         WHERE id = $1`,
        [visitId, counselorId]
      )
    },
    async markPickedUp(visitId, pickedUpAt) {
      await pool.query(
        "UPDATE visits SET picked_up_at = $2, student_status = 'in_session', updated_at = now() WHERE id = $1",
        [visitId, pickedUpAt]
      )
    },
    async markClosed(visitId, closedAt, status: VisitStatus, studentStatus, note, followUpDueAt) {
      await pool.query(
        'UPDATE visits SET closed_at = $2, status = $3, student_status = $4, counselor_note = $5, follow_up_due_at = $6, updated_at = now() WHERE id = $1',
        [visitId, closedAt, status, studentStatus, note ?? null, followUpDueAt ?? null]
      )
    },
    async setStudentStatus(visitId, studentStatus, followUpDueAt) {
      // "AND status = 'closed'" حاجز أخير بقاعدة البيانات: حتى لو تخطى أحد فحص
      // التطبيق، ما نلمس زيارة مفتوحة فيصير عندنا زوج حالات متناقض
      await pool.query(
        "UPDATE visits SET student_status = $2, follow_up_due_at = $3, updated_at = now() WHERE id = $1 AND status = 'closed'",
        [visitId, studentStatus, followUpDueAt]
      )
    },
    async findAllMatchingName(normalizedTerm) {
      // ESCAPE يخلي % و_ نص عادي: الموظف اللي يكتبهم يدوّر عليهم بالاسم، ما
      // يطلب كل الجدول. والحد سقف أمان — كل صف راجع يفك تشفير رقم هاتف
      const result = await pool.query(
        `SELECT * FROM visits WHERE ${NORMALIZED_NAME_SQL} LIKE '%' || $1 || '%' ESCAPE '${LIKE_ESCAPE_CHAR}' ORDER BY created_at DESC LIMIT $2`,
        [escapeLikeWildcards(normalizedTerm), NAME_SEARCH_FETCH_LIMIT]
      )
      return result.rows.map(rowToVisit)
    },
    async countAll() {
      const result = await pool.query('SELECT count(*)::int AS total FROM visits')
      return result.rows[0].total
    },
    async findClosedInRange(fromInclusive, toExclusive) {
      const result = await pool.query(
        'SELECT * FROM visits WHERE closed_at >= $1 AND closed_at < $2 ORDER BY closed_at DESC',
        [fromInclusive, toExclusive]
      )
      return result.rows.map(rowToVisit)
    },
    async findAllInRange(fromInclusive, toExclusive) {
      const result = await pool.query(
        'SELECT * FROM visits WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC',
        [fromInclusive, toExclusive]
      )
      return result.rows.map(rowToVisit)
    },
    async findAllByType(type) {
      const result = await pool.query(
        'SELECT * FROM visits WHERE type = $1 ORDER BY created_at DESC',
        [type]
      )
      return result.rows.map(rowToVisit)
    },
    async findAllByPhone(phone) {
      const result = await pool.query(
        'SELECT * FROM visits WHERE phone_search_hash = $1 ORDER BY created_at DESC',
        [createSearchableFingerprint(phone)]
      )
      return result.rows.map(rowToVisit)
    },
    // استعلام واحد لكل الأرقام بدل واحد لكل رقم — التصدير كان يفتح ثلاثة
    // استعلامات لكل عميل دفعة وحدة على Pool فيه عشرة اتصالات
    async findAllByPhones(phones) {
      if (phones.length === 0) return []
      const result = await pool.query(
        'SELECT * FROM visits WHERE phone_search_hash = ANY($1) ORDER BY created_at DESC',
        [phones.map(createSearchableFingerprint)]
      )
      return result.rows.map(rowToVisit)
    },
    // بدون حد على المدى الزمني عمدًا — متابعة معلّقة من أسابيع تظل مهمة، مو
    // بس اللي بنفس نطاق التواريخ المختار بالداشبورد
    async findAllByStudentStatus(studentStatus) {
      const result = await pool.query(
        'SELECT * FROM visits WHERE student_status = $1 ORDER BY follow_up_due_at ASC NULLS LAST',
        [studentStatus]
      )
      return result.rows.map(rowToVisit)
    },
    async findStrandedVisitIds(visitIds) {
      if (visitIds.length === 0) return []
      const result = await pool.query(
        "SELECT id FROM visits WHERE id = ANY($1) AND status = 'next' AND counselor_id IS NULL",
        [visitIds]
      )
      return result.rows.map((row) => row.id as string)
    },
    async deleteVisit(visitId) {
      await pool.query('DELETE FROM visits WHERE id = $1', [visitId])
    },
  }
}
