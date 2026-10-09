import { describe, it, expect, vi, afterEach } from 'vitest'

// الـ commit ينقرأ مرة وحدة وقت تحميل الموديول، فكل حالة تحتاج استيراد جديد
async function loadRoute(commitSha?: string) {
  vi.resetModules()
  if (commitSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA
  else process.env.VERCEL_GIT_COMMIT_SHA = commitSha
  return import('./route')
}

afterEach(() => {
  delete process.env.VERCEL_GIT_COMMIT_SHA
})

describe('GET /api/health', () => {
  // الـ HEALTHCHECK بالـ Dockerfile يعتمد على هالحقل — ما ينكسر أبداً
  it('always answers ok, so the container healthcheck keeps working', async () => {
    const { GET } = await loadRoute('d36654dabc123456789')
    const body = await (await GET()).json()
    expect(body.ok).toBe(true)
  })

  it('reports the running commit, shortened to seven characters', async () => {
    const { GET } = await loadRoute('d36654dabc123456789')
    const body = await (await GET()).json()
    expect(body.commit).toBe('d36654d')
  })

  // محلياً وبالـ docker ما فيه متغير من فيرسل — نرجع بدون الحقل بدل قيمة فاضية
  it('leaves the commit out entirely when nothing set it', async () => {
    const { GET } = await loadRoute(undefined)
    const body = await (await GET()).json()
    expect(body).toEqual({ ok: true })
  })

  it('leaves the commit out when the variable is an empty string', async () => {
    const { GET } = await loadRoute('')
    const body = await (await GET()).json()
    expect(body).toEqual({ ok: true })
  })

  // المسار عام: لا فرع، ولا بيئة، ولا أي شي ثاني عن الخادم
  it('reveals nothing beyond ok and the commit', async () => {
    const { GET } = await loadRoute('d36654dabc123456789')
    const body = await (await GET()).json()
    expect(Object.keys(body).sort()).toEqual(['commit', 'ok'])
  })
})
