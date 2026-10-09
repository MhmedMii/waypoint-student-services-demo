import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { submitVisaVisit } from '../../../../application/useCases/submitVisaVisit'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresSpecializationRepository } from '../../../../adapters/repositories/postgresSpecializationRepository'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { systemClock } from '../../../../infrastructure/db/systemClock'
import { logActivity } from '../../../../infrastructure/activity/logActivity'
import {
  assignedToAbsentLog,
  leftUnassignedLog,
  routingNote,
} from '../../../../infrastructure/activity/routingNote'
import { workingDaysSinceLastSeen } from '../../../../domain/time/workingDaysSinceLastSeen'
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
  const result = await submitVisaVisit(
    {
      name: body.name,
      phone: body.phone,
      // الشرط كان على الجلسة لا على المستخدم. التوكن المنزوع (حساب
      // معطّل) يعطي جلسة بلا مستخدم، فـ session.user.id كانت ترمي
      createdBy: session?.user?.id ?? null,
      overrideDuplicate: body.overrideDuplicate === true,
    },
    {
      visitRepository: createPostgresVisitRepository(pool),
      specializationRepository: createPostgresSpecializationRepository(pool),
      clock: systemClock,
    }
  )

  if (!result.ok) return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 })
  const counselor = result.visit.counselorId
    ? await createPostgresUserRepository(pool).findById(result.visit.counselorId)
    : null
  const withheld = routingNote({
    assignedNotSignedInToday: result.assignedNotSignedInToday,
    assignedShift: result.assignedWhileOffShift ? (counselor?.shift ?? null) : null,
    counselorName: counselor?.name ?? null,
    counselorNameAr: counselor?.nameAr ?? null,
  })
  await logActivity(
    pool,
    session,
    'visit_created',
    'visit',
    result.visit.id,
    `Created visa/other visit for ${result.visit.name}${withheld.en}`,
    `تم إنشاء زيارة تأشيرة/أخرى لـ ${result.visit.name}${withheld.ar}`
  )

  // العميل انعطى لغايب لأن ما فيه بديل حاضر — لا يبقى بلا صاحب، بس يبان أحمر
  if (result.assignedWhileAbsent && counselor) {
    const note = assignedToAbsentLog(result.visit.name, {
      name: counselor.name,
      nameAr: counselor.nameAr ?? null,
      quietWorkingDays: workingDaysSinceLastSeen(counselor.lastSeenAt, systemClock.now()),
    })
    await logActivity(
      pool,
      session,
      'visit_assigned_to_absent',
      'visit',
      result.visit.id,
      note.en,
      note.ar
    )
  }

  // ما فيه ولا مستشار بالشفت يغطي هالوجهة — العميل فعلاً بلا صاحب
  if (result.visit.counselorId === null) {
    const unassigned = leftUnassignedLog(result.visit.name, null)
    await logActivity(
      pool,
      session,
      'visit_left_unassigned',
      'visit',
      result.visit.id,
      unassigned.en,
      unassigned.ar
    )
  }

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

  return NextResponse.json({
    ok: true,
    visitId: result.visit.id,
    counselorName: counselor?.name ?? null,
  })
}
