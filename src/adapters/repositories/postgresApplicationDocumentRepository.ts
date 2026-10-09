import type { Pool } from 'pg'
import type { ApplicationDocument } from '../../domain/entities/applicationDocument'
import type {
  ApplicationDocumentRepository,
  CreateApplicationDocumentInput,
} from '../../application/ports/ApplicationDocumentRepository'

function rowToApplicationDocument(row: any): ApplicationDocument {
  return {
    id: row.id,
    applicationId: row.application_id,
    blobPathname: row.blob_pathname,
    originalFileName: row.original_file_name,
    documentLabel: row.document_label,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
  }
}

export function createPostgresApplicationDocumentRepository(
  pool: Pool
): ApplicationDocumentRepository {
  return {
    async create(input: CreateApplicationDocumentInput) {
      const result = await pool.query(
        `INSERT INTO application_documents (application_id, blob_pathname, original_file_name, document_label, content_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          input.applicationId,
          input.blobPathname,
          input.originalFileName,
          input.documentLabel,
          input.contentType,
          input.sizeBytes,
        ]
      )
      return rowToApplicationDocument(result.rows[0])
    },
    async findById(id) {
      const result = await pool.query('SELECT * FROM application_documents WHERE id = $1', [id])
      return result.rows[0] ? rowToApplicationDocument(result.rows[0]) : null
    },
    async findByApplicationId(applicationId) {
      const result = await pool.query(
        'SELECT * FROM application_documents WHERE application_id = $1 ORDER BY uploaded_at ASC',
        [applicationId]
      )
      return result.rows.map(rowToApplicationDocument)
    },
    async findLabelsByApplicationIds(applicationIds) {
      if (applicationIds.length === 0) return {}
      const result = await pool.query(
        'SELECT application_id, document_label FROM application_documents WHERE application_id = ANY($1)',
        [applicationIds]
      )
      const byApplication: Record<string, string[]> = {}
      for (const row of result.rows) {
        if (!row.document_label) continue
        byApplication[row.application_id] = [
          ...(byApplication[row.application_id] ?? []),
          row.document_label,
        ]
      }
      return byApplication
    },
  }
}
