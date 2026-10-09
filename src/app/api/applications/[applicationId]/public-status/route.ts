import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../../adapters/repositories/postgresApplicationRepository'

// نقطة عامة بدون تسجيل دخول — الرابط نفسه (UUID غير قابل للتخمين) هو التحقق،
// فلازم نرجّع أقل بيانات ممكنة (بدون هاتف/حقول الطلب/المستشار)
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ applicationId: string }> }
) {
  const params = await props.params
  const applicationRepository = createPostgresApplicationRepository(pool)
  const application = await applicationRepository.findById(params.applicationId)
  if (!application) return NextResponse.json({ ok: false }, { status: 404 })

  return NextResponse.json({
    ok: true,
    applicationNumber: application.applicationNumber,
    kind: application.kind,
    serviceCode: application.serviceCode,
    status: application.status,
    paymentUrl: application.paymentUrl,
  })
}
