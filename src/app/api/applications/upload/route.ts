import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { attachApplicationDocument } from '../../../../application/useCases/attachApplicationDocument'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../adapters/repositories/postgresApplicationRepository'
import { createPostgresApplicationDocumentRepository } from '../../../../adapters/repositories/postgresApplicationDocumentRepository'
import { guardPublicSubmission } from '../../../../infrastructure/rateLimit/guardPublicSubmission'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

interface UploadTokenPayload {
  applicationId: string
  originalFileName: string
  documentLabel: string | null
  sizeBytes: number
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  // نحدّ الطلب بس وقت توليد التوكن — طلب حقيقي من متصفح الزائر؛ استدعاء
  // اكتمال الرفع يجي من سيرفرات Vercel نفسها، فما نحدّه
  if (body.type === 'blob.generate-client-token') {
    const guard = await guardPublicSubmission(request, Date.now())
    if (guard.tooMany) {
      return NextResponse.json(
        { error: 'Too many requests — please try again later' },
        { status: 429 }
      )
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // نتأكد إن applicationId موجود فعلاً قبل لا نصدر توكن الرفع — يمنع ربط ملفات بطلبات ما لها وجود
        const payload = clientPayload ? (JSON.parse(clientPayload) as UploadTokenPayload) : null
        if (!payload?.applicationId) throw new Error('Missing applicationId')

        const applicationRepository = createPostgresApplicationRepository(pool)
        const application = await applicationRepository.findById(payload.applicationId)
        if (!application) throw new Error('Application not found')

        return {
          access: 'private',
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: clientPayload,
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return
        const { applicationId, originalFileName, documentLabel, sizeBytes } = JSON.parse(
          tokenPayload
        ) as UploadTokenPayload
        const applicationRepository = createPostgresApplicationRepository(pool)
        const applicationDocumentRepository = createPostgresApplicationDocumentRepository(pool)
        await attachApplicationDocument(
          {
            applicationId,
            blobPathname: blob.pathname,
            originalFileName,
            documentLabel: documentLabel ?? null,
            contentType: blob.contentType ?? 'application/octet-stream',
            sizeBytes,
          },
          { applicationRepository, applicationDocumentRepository }
        )
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
