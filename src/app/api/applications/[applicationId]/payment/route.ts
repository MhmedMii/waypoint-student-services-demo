import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { setApplicationPaymentUrl } from '../../../../../application/useCases/setApplicationPaymentUrl'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../../adapters/repositories/postgresApplicationRepository'
import { logActivity } from '../../../../../infrastructure/activity/logActivity'

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

  const result = await setApplicationPaymentUrl(
    role,
    scopes,
    params.applicationId,
    body.paymentUrl ?? '',
    { applicationRepository }
  )
  if (result.ok) {
    await logActivity(
      pool,
      session!,
      'application_payment_url_set',
      'application',
      params.applicationId,
      'Payment link set for application',
      'تم تعيين رابط الدفع للطلب'
    )
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 403 })
}
