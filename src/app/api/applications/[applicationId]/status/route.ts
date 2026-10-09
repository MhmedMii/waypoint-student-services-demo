import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { updateApplicationStatus } from '../../../../../application/useCases/updateApplicationStatus'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../../adapters/repositories/postgresApplicationRepository'
import { logActivity } from '../../../../../infrastructure/activity/logActivity'
import { translations } from '../../../../../i18n/translations'

// نتحقق فقط إن الجلسة مسجّلة دخول بدور مسموح عمومًا هنا — التحقق الدقيق بالنطاق (scope)
// يصير داخل updateApplicationStatus نفسه لأنه يحتاج يعرف kind الطلب أول، وما نعرفه إلا بعد الجلب
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ applicationId: string }> }
) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin', 'counselor'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await request.json()
  const role = session!.user!.role
  const scopes = session!.user!.scopes ?? []
  const applicationRepository = createPostgresApplicationRepository(pool)

  const result = await updateApplicationStatus(
    role,
    scopes,
    params.applicationId,
    body.status,
    body.statusNote ?? null,
    body.referenceNumber ?? null,
    { applicationRepository }
  )
  if (result.ok) {
    await logActivity(
      pool,
      session!,
      'application_status_updated',
      'application',
      params.applicationId,
      `Application status changed to ${body.status}`,
      `تم تغيير حالة الطلب إلى ${
        (translations.ar.applications as Record<string, string>)[body.status] ?? body.status
      }`
    )
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 403 })
}
