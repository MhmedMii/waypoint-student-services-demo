import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This copy is a browser-only fictional demo. Never expose legacy production APIs.
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.json({ ok: true, mode: 'fictional-demo', externalServices: false })
  }
  return NextResponse.json(
    { ok: false, error: 'Production APIs are disabled in this fictional demo.' },
    { status: 410 }
  )
}
export const config = { matcher: '/api/:path*' }
