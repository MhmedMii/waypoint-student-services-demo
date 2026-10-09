export interface ApplicationDocument {
  id: string
  applicationId: string
  blobPathname: string
  originalFileName: string
  documentLabel: string | null
  contentType: string
  sizeBytes: number
  uploadedAt: Date
}
