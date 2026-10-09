export interface BlobStorage {
  getStream(
    pathname: string
  ): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string } | null>
}
