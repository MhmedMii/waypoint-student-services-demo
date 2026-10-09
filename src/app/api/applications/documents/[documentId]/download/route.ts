import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../../infrastructure/auth/requireRole'
import { requireScope } from '../../../../../../infrastructure/auth/requireScope'
import { pool } from '../../../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../../../adapters/repositories/postgresApplicationRepository'
import { createPostgresApplicationDocumentRepository } from '../../../../../../adapters/repositories/postgresApplicationDocumentRepository'
import { createVercelBlobStorage } from '../../../../../../infrastructure/storage/vercelBlobStorage'
import { scopeForApplicationKind } from '../../../../../../domain/access/applicationScope'

// يبث الملف من Blob الخاص عبر السيرفر — الرابط الخام لبلوب برايفت ما يفتح مباشرة من المتصفح
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ documentId: string }> }
) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const roleAccess = requireRole(session, ['super_admin', 'counselor'])
  if (!roleAccess.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const applicationDocumentRepository = createPostgresApplicationDocumentRepository(pool)
  const document = await applicationDocumentRepository.findById(params.documentId)
  if (!document) return NextResponse.json({ ok: false }, { status: 404 })

  const applicationRepository = createPostgresApplicationRepository(pool)
  const application = await applicationRepository.findById(document.applicationId)
  if (!application) return NextResponse.json({ ok: false }, { status: 404 })

  // نوع من القاعدة ما نعرف نطاقه = رفض، مو افتراض exam_services
  const scope = scopeForApplicationKind(application.kind)
  if (!scope) return NextResponse.json({ ok: false }, { status: 403 })
  const scopeAccess = requireScope(session, scope)
  if (!scopeAccess.ok) return NextResponse.json({ ok: false }, { status: 403 })

  const blobStorage = createVercelBlobStorage()
  const file = await blobStorage.getStream(document.blobPathname)
  if (!file) return NextResponse.json({ ok: false }, { status: 404 })

  return new NextResponse(file.stream, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `inline; filename="${document.originalFileName}"`,
    },
  })
}
