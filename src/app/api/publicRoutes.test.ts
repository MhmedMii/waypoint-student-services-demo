import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const API_ROOT = join(process.cwd(), 'src/app/api')

// كل مسار تحت /api لازم يسأل عن الدور، أو يكون هنا بسبب مكتوب. لو أحد أضاف
// مسار جديد ونسي الحارس، هالتست يطيح ويقول اسم الملف — بدل ما ينزل على
// الإنتاج مفتوح للكل. إضافة مسار عام تصير قرار يكتبه أحد، مو سهو
const PUBLIC_ROUTES: Record<string, string> = {
  'auth/[...nextauth]/route.ts': 'NextAuth itself — this is how anyone signs in',
  'auth/forgot-password/route.ts': 'asked for before you can sign in; has its own rate limit',
  'auth/reset-password/route.ts': 'reached from an emailed token, before signing in',
  'health/route.ts': 'uptime probe, returns nothing but ok',
  'visits/new/route.ts': 'reception kiosk — a walk-in client has no account',
  'visits/follow-up/route.ts': 'reception kiosk — a walk-in client has no account',
  'visits/visa/route.ts': 'reception kiosk — a walk-in client has no account',
  'counselors/active/route.ts': 'fills the kiosk dropdown; returns names only',
  'applications/route.ts': 'public apply form — the applicant has no account',
  'applications/upload/route.ts': 'public apply form uploads; rate-limited when issuing a token',
  'applications/[applicationId]/public-status/route.ts':
    "the applicant's own unguessable id is the key; returns no name or phone",
  'visits/[visitId]/queue-position/route.ts':
    "the client's own unguessable id is the key; returns their place in the queue",
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return routeFiles(full)
    return entry === 'route.ts' ? [relative(API_ROOT, full)] : []
  })
}

// نفحص النص مو الاستيراد: الهدف نمسك مسار ما ينادي حارس أبداً، وهذا يبان بالنص
function namesAGate(source: string): boolean {
  return source.includes('requireRole') || source.includes('requireScope')
}

describe('every API route is either signed-in only, or public on purpose', () => {
  const files = routeFiles(API_ROOT).sort()

  it('finds the routes at all, so a broken path cannot make this test vacuous', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it.each(files)('%s', (file) => {
    const source = readFileSync(join(API_ROOT, file), 'utf8')
    const gated = namesAGate(source)
    const listed = file in PUBLIC_ROUTES

    if (!gated && !listed) {
      throw new Error(
        `${file} can be reached by anyone, signed in or not.\n` +
          `Add requireRole or requireScope, or — if it is meant to be public — add it to ` +
          `PUBLIC_ROUTES in src/app/api/publicRoutes.test.ts with the reason why.`
      )
    }

    if (gated && listed) {
      throw new Error(
        `${file} now checks the signed-in user, so it is no longer public.\n` +
          `Remove it from PUBLIC_ROUTES in src/app/api/publicRoutes.test.ts.`
      )
    }
  })

  // القائمة تتعفّن بصمت لو انحذف مسار وبقي اسمه هنا
  it('lists no route that has been deleted', () => {
    const missing = Object.keys(PUBLIC_ROUTES).filter((file) => !files.includes(file))
    expect(missing).toEqual([])
  })
})
