import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../../adapters/repositories/postgresApplicationRepository'
import { createPostgresApplicationDocumentRepository } from '../../../../../adapters/repositories/postgresApplicationDocumentRepository'
import { requireScope } from '../../../../../infrastructure/auth/requireScope'
import { scopeForApplicationKind } from '../../../../../domain/access/applicationScope'

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ applicationId: string }> }
) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const roleAccess = requireRole(session, ['super_admin', 'counselor'])
  if (!roleAccess.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const applicationRepository = createPostgresApplicationRepository(pool)
  const application = await applicationRepository.findById(params.applicationId)
  if (!application) return NextResponse.json({ ok: false }, { status: 404 })

  // نوع من القاعدة ما نعرف نطاقه = رفض، مو افتراض exam_services
  const scope = scopeForApplicationKind(application.kind)
  if (!scope) return NextResponse.json({ ok: false }, { status: 403 })
  const scopeAccess = requireScope(session, scope)
  if (!scopeAccess.ok) return NextResponse.json({ ok: false }, { status: 403 })

  const applicationDocumentRepository = createPostgresApplicationDocumentRepository(pool)
  const documents = await applicationDocumentRepository.findByApplicationId(params.applicationId)

  return NextResponse.json(
    documents.map((document) => ({
      id: document.id,
      originalFileName: document.originalFileName,
      documentLabel: document.documentLabel,
      contentType: document.contentType,
      sizeBytes: document.sizeBytes,
      uploadedAt: document.uploadedAt,
    }))
  )
}
