import type { Pool } from 'pg'

// Deliberately fail closed, even if someone supplies a production DATABASE_URL.
export const pool: Pool = new Proxy({} as Pool, {
  get() {
    throw new Error('Database access is disabled in the fictional demo. Use the browser workspace.')
  },
})
