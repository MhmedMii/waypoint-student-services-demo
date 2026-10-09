import type { BlobStorage } from '../../application/ports/BlobStorage'

// Production document storage is unavailable in this copy.
export function createVercelBlobStorage(): BlobStorage {
  return {
    async getStream() {
      return null
    },
  }
}
