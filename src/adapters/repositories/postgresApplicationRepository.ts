import type { Pool } from 'pg'
import { NORMALIZED_NAME_SQL } from './normalizedNameSql'
import { escapeLikeWildcards, LIKE_ESCAPE_CHAR } from './likeSearchPattern'
import { NAME_SEARCH_FETCH_LIMIT } from '../../domain/text/searchPage'
import type { Application } from '../../domain/entities/application'
import type {
  ApplicationRepository,
  CreateApplicationInput,
} from '../../application/ports/ApplicationRepository'
import {
  encryptSensitiveText,
  decryptSensitiveText,
  createSearchableFingerprint,
} from '../../infrastructure/crypto/fieldEncryption'

function rowToApplication(row: any): Application {
  return {
    id: row.id,
    applicationNumber: row.application_number,
    kind: row.kind,
    serviceCode: row.service_code,
    name: row.name,
    phone: decryptSensitiveText(row.phone_encrypted),
    email: row.email,
    fields: JSON.parse(decryptSensitiveText(row.fields_encrypted)),
    status: row.status,
    statusNote: row.status_note,
    referenceNumber: row.reference_number,
    counselorId: row.counselor_id,
    paymentUrl: row.payment_url,
    acceptedAt: row.accepted_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createPostgresApplicationRepository(pool: Pool): ApplicationRepository {
  return {
    async create(input: CreateApplicationInput) {
      const sequence =
        input.kind === 'visa' ? 'visa_application_number_seq' : 'exam_application_number_seq'
      const prefix = input.kind === 'visa' ? 'VISA' : 'EXAM'
      const result = await pool.query(
        `INSERT INTO applications (application_number, kind, service_code, name, phone_encrypted, phone_search_hash, email, fields_encrypted)
         VALUES ($1 || '-' || LPAD(nextval($2)::text, 4, '0'), $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          prefix,
          sequence,
          input.kind,
          input.serviceCode,
          input.name,
          encryptSensitiveText(input.phone),
          createSearchableFingerprint(input.phone),
          input.email,
          encryptSensitiveText(JSON.stringify(input.fields)),
        ]
      )
      return rowToApplication(result.rows[0])
    },
    async findById(id) {
      const result = await pool.query('SELECT * FROM applications WHERE id = $1', [id])
      return result.rows[0] ? rowToApplication(result.rows[0]) : null
    },
    async findAllByKind(kind) {
      const result = await pool.query(
        'SELECT * FROM applications WHERE kind = $1 ORDER BY created_at DESC',
        [kind]
      )
      return result.rows.map(rowToApplication)
    },
    async findByCounselor(counselorId) {
      const result = await pool.query(
        'SELECT * FROM applications WHERE counselor_id = $1 ORDER BY created_at DESC',
        [counselorId]
      )
      return result.rows.map(rowToApplication)
    },
    async findAllByKindMatchingName(kind, normalizedTerm) {
      // نفس قاعدة البحث بالزيارات بالضبط — الصفحتان تبحثان بنفس المعنى
      const result = await pool.query(
        `SELECT * FROM applications WHERE kind = $1 AND ${NORMALIZED_NAME_SQL} LIKE '%' || $2 || '%' ESCAPE '${LIKE_ESCAPE_CHAR}' ORDER BY created_at DESC LIMIT $3`,
        [kind, escapeLikeWildcards(normalizedTerm), NAME_SEARCH_FETCH_LIMIT]
      )
      return result.rows.map(rowToApplication)
    },
    async findAllByKindInRange(kind, from, to) {
      const result = await pool.query(
        'SELECT * FROM applications WHERE kind = $1 AND created_at >= $2 AND created_at < $3 ORDER BY created_at DESC',
        [kind, from, to]
      )
      return result.rows.map(rowToApplication)
    },
    async countAll() {
      const result = await pool.query('SELECT count(*)::int AS total FROM applications')
      return result.rows[0].total
    },
    async findAllInRange(from, to) {
      const result = await pool.query(
        'SELECT * FROM applications WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC',
        [from, to]
      )
      return result.rows.map(rowToApplication)
    },
    async findAllByPhone(phone) {
      const result = await pool.query(
        'SELECT * FROM applications WHERE phone_search_hash = $1 ORDER BY created_at DESC',
        [createSearchableFingerprint(phone)]
      )
      return result.rows.map(rowToApplication)
    },
    async findAllByPhones(phones) {
      if (phones.length === 0) return []
      const result = await pool.query(
        'SELECT * FROM applications WHERE phone_search_hash = ANY($1) ORDER BY created_at DESC',
        [phones.map(createSearchableFingerprint)]
      )
      return result.rows.map(rowToApplication)
    },
    async updateStatus(id, status, statusNote, referenceNumber) {
      await pool.query(
        `UPDATE applications SET status = $2, status_note = $3, reference_number = $4, updated_at = now(),
           closed_at = CASE WHEN $2 IN ('approved', 'rejected') THEN COALESCE(closed_at, now()) ELSE closed_at END
         WHERE id = $1`,
        [id, status, statusNote, referenceNumber]
      )
    },
    async assignCounselor(id, counselorId) {
      await pool.query(
        `UPDATE applications SET counselor_id = $2::uuid, updated_at = now(),
           accepted_at = CASE WHEN $2::uuid IS NOT NULL AND accepted_at IS NULL THEN now() ELSE accepted_at END
         WHERE id = $1`,
        [id, counselorId]
      )
    },
    async setPaymentUrl(id, paymentUrl) {
      await pool.query(
        'UPDATE applications SET payment_url = $2, updated_at = now() WHERE id = $1',
        [id, paymentUrl]
      )
    },
    async deleteApplication(id) {
      await pool.query('DELETE FROM applications WHERE id = $1', [id])
    },
  }
}
