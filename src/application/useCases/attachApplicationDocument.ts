import type { ApplicationDocument } from '../../domain/entities/applicationDocument'
import type { ApplicationRepository } from '../ports/ApplicationRepository'
import type {
  ApplicationDocumentRepository,
  CreateApplicationDocumentInput,
} from '../ports/ApplicationDocumentRepository'

export interface AttachApplicationDocumentDeps {
  applicationRepository: ApplicationRepository
  applicationDocumentRepository: ApplicationDocumentRepository
}

export type AttachApplicationDocumentResult =
  { ok: true; document: ApplicationDocument } | { ok: false; reason: string }

// يستدعى من Blob onUploadCompleted callback — نتأكد إن الطلب موجود فعلاً قبل لا نربط الملف فيه
export async function attachApplicationDocument(
  input: CreateApplicationDocumentInput,
  deps: AttachApplicationDocumentDeps
): Promise<AttachApplicationDocumentResult> {
  const application = await deps.applicationRepository.findById(input.applicationId)
  if (!application) return { ok: false, reason: 'applicationNotFound' }

  const document = await deps.applicationDocumentRepository.create(input)
  return { ok: true, document }
}
