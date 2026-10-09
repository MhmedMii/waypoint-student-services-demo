import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireScope } from '../../../../../infrastructure/auth/requireScope'
import { listApplicationsWithDocumentState } from '../../../../../application/useCases/listApplicationsWithDocumentState'
import { takeSearchPage, SEARCH_TRUNCATED_HEADER } from '../../../../../domain/text/searchPage'
import { assignApplicationCounselor } from '../../../../../application/useCases/assignApplicationCounselor'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../../adapters/repositories/postgresApplicationRepository'
import { createPostgresApplicationDocumentRepository } from '../../../../../adapters/repositories/postgresApplicationDocumentRepository'
import { createPostgresUserRepository } from '../../../../../adapters/repositories/postgresUserRepository'
import { withCounselorNames } from '../../../../../application/naming/withCounselorNames'
import { systemClock } from '../../../../../infrastructure/db/systemClock'
import { logActivity } from '../../../../../infrastructure/activity/logActivity'
import type { ApplicationKind } from '../../../../../domain/entities/application'
import type { SpecializationScope } from '../../../../../domain/entities/counselor'
import { validateDateQueryParam } from '../../../../../domain/validation/validateDateQueryParam'
import { scopeForApplicationKind } from '../../../../../domain/access/applicationScope'

export async function GET(request: NextRequest, props: { params: Promise<{ kind: string }> }) {
  const params = await props.params
  // القاعدة المشتركة تجاوب "هل هذا نوع حقيقي" و"وش نطاقه" بنفس الوقت — بدل
  // قائمة ثانية مكتوبة هنا باليد تنسى تتحدّث لو انضاف نوع
  const scope = scopeForApplicationKind(params.kind)
  if (!scope) return NextResponse.json({ ok: false }, { status: 400 })
  const kind = params.kind as ApplicationKind

  const session = await getServerSession(authOptions)
  const access = requireScope(session, scope)
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const role = session!.user!.role
  const scopes = session!.user!.scopes ?? []
  // بدون بحث ولا تواريخ نرجّع الكل — صفحتا التأشيرات والاختبارات تعتمدان على
  // هذا، وما نبي نحفر فيهما نفس حفرة الـ7 أيام
  const searchTerm = request.nextUrl.searchParams.get('q')?.trim()
  const fromParam = request.nextUrl.searchParams.get('from')
  const toParam = request.nextUrl.searchParams.get('to')
  let filter: { search?: string; from?: Date; to?: Date } = {}
  if (searchTerm) {
    filter = { search: searchTerm }
  } else if (fromParam || toParam) {
    const fromResult = validateDateQueryParam(fromParam, new Date(0))
    if (!fromResult.isValid)
      return NextResponse.json({ ok: false, reason: fromResult.reason }, { status: 400 })
    const toResult = validateDateQueryParam(toParam, new Date())
    if (!toResult.isValid)
      return NextResponse.json({ ok: false, reason: toResult.reason }, { status: 400 })
    filter = { from: fromResult.date, to: toResult.date }
  }

  const result = await listApplicationsWithDocumentState(
    role,
    scopes,
    kind,
    {
      applicationRepository: createPostgresApplicationRepository(pool),
      applicationDocumentRepository: createPostgresApplicationDocumentRepository(pool),
    },
    filter
  )
  if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason }, { status: 403 })

  // نفس سقف البحث بالزيارات، ونفس الإشارة لما ينقطع
  const page = takeSearchPage(result.applications)
  return NextResponse.json(
    await withCounselorNames(page.rows, createPostgresUserRepository(pool), systemClock),
    { headers: page.truncated ? { [SEARCH_TRUNCATED_HEADER]: 'true' } : undefined }
  )
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ kind: string }> }) {
  const params = await props.params
  // القاعدة المشتركة تجاوب "هل هذا نوع حقيقي" و"وش نطاقه" بنفس الوقت — بدل
  // قائمة ثانية مكتوبة هنا باليد تنسى تتحدّث لو انضاف نوع
  const scope = scopeForApplicationKind(params.kind)
  if (!scope) return NextResponse.json({ ok: false }, { status: 400 })
  const kind = params.kind as ApplicationKind

  const session = await getServerSession(authOptions)
  const access = requireScope(session, scope)
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await request.json()
  const role = session!.user!.role
  const scopes = session!.user!.scopes ?? []
  const applicationRepository = createPostgresApplicationRepository(pool)

  const result = await assignApplicationCounselor(
    role,
    scopes,
    body.applicationId,
    body.counselorId ?? null,
    { applicationRepository }
  )
  if (result.ok) {
    await logActivity(
      pool,
      session!,
      'application_counselor_assigned',
      'application',
      body.applicationId,
      body.counselorId
        ? `Assigned application to counselor ${body.counselorId}`
        : 'Unassigned application',
      body.counselorId ? `تم تعيين مستشار للطلب: ${body.counselorId}` : 'تم إلغاء تعيين الطلب'
    )
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 403 })
}
