import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { submitFollowUpVisit } from '../../../../application/useCases/submitFollowUpVisit'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'
import { logActivity } from '../../../../infrastructure/activity/logActivity'
import { followUpCounselorLog } from '../../../../infrastructure/activity/followUpCounselorLog'
import {
  guardPublicSubmission,
  guardRepeatSubmitter,
} from '../../../../infrastructure/rateLimit/guardPublicSubmission'

export async function POST(request: NextRequest) {
  const guard = await guardPublicSubmission(request, Date.now())
  if (guard.tooMany) {
    return NextResponse.json({ ok: false, errors: ['tooManySubmissions'] }, { status: 429 })
  }

  const session = await getServerSession(authOptions)

  const body = await request.json()

  const repeat = await guardRepeatSubmitter(body.phone, Date.now())
  if (repeat.tooMany) {
    return NextResponse.json(
      { ok: false, errors: ['tooManySubmissionsFromNumber'] },
      { status: 429 }
    )
  }
  const result = await submitFollowUpVisit(
    {
      name: body.name,
      phone: body.phone,
      counselorId: body.counselorId,
      // الشرط كان على الجلسة لا على المستخدم. التوكن المنزوع (حساب
      // معطّل) يعطي جلسة بلا مستخدم، فـ session.user.id كانت ترمي
      createdBy: session?.user?.id ?? null,
      overrideDuplicate: body.overrideDuplicate === true,
    },
    {
      visitRepository: createPostgresVisitRepository(pool),
      userRepository: createPostgresUserRepository(pool),
      clock: systemClock,
    }
  )

  if (!result.ok) return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 })

  // العميل اختار مستشاره بنفسه من الكشك — الاسم يتكتب دائمًا، لأن السجل كان
  // ما يقول مين استلمه إلا لما يكون فيه مشكلة
  const counselor = result.visit.counselorId
    ? await createPostgresUserRepository(pool).findById(result.visit.counselorId)
    : null
  const chosenBy = counselor ? ` — assigned to ${counselor.name}` : ''
  const chosenByAr = counselor ? ` — أُسندت إلى ${counselor.nameAr ?? counselor.name}` : ''

  await logActivity(
    pool,
    session,
    'visit_created',
    'visit',
    result.visit.id,
    `Created follow-up visit for ${result.visit.name}${chosenBy}`,
    `تم إنشاء زيارة متابعة لـ ${result.visit.name}${chosenByAr}`
  )
  if (result.duplicateOverridden) {
    await logActivity(
      pool,
      session,
      'visit_duplicate_overridden',
      'visit',
      result.visit.id,
      `Continued past the duplicate warning for ${result.visit.name} — same number as a visit still open`,
      `تخطّى تحذير التكرار لـ ${result.visit.name} — نفس رقم زيارة لسا مفتوحة`
    )
  }
  // ما يغيّر التعيين — بس يسجّل إن اللي اختاره العميل ما حضر
  const chosen = followUpCounselorLog(result.visit.name, counselor, systemClock.now())
  if (chosen) {
    await logActivity(pool, session, chosen.action, 'visit', result.visit.id, chosen.en, chosen.ar)
  }

  return NextResponse.json({ ok: true, visitId: result.visit.id })
}
