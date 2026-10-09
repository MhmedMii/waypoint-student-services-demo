import type { ApplicationDocument } from '../../domain/entities/applicationDocument'

export interface CreateApplicationDocumentInput {
  applicationId: string
  blobPathname: string
  originalFileName: string
  documentLabel: string | null
  contentType: string
  sizeBytes: number
}

export interface ApplicationDocumentRepository {
  create(input: CreateApplicationDocumentInput): Promise<ApplicationDocument>
  findById(id: string): Promise<ApplicationDocument | null>
  findByApplicationId(applicationId: string): Promise<ApplicationDocument[]>
  // مسمّيات المستندات المرفوعة لعدة طلبات باستعلام واحد — نحتاجها بقائمة الطلبات
  // عشان ما نسوي استعلام لكل صف
  findLabelsByApplicationIds(applicationIds: string[]): Promise<Record<string, string[]>>
}
