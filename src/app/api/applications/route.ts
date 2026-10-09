import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../infrastructure/auth/authOptions'
import { submitApplication } from '../../../application/useCases/submitApplication'
import { pool } from '../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../adapters/repositories/postgresApplicationRepository'
import { createPostgresSpecializationRepository } from '../../../adapters/repositories/postgresSpecializationRepository'
import { systemClock } from '../../../infrastructure/db/systemClock'
import {
  guardPublicSubmission,
  guardRepeatSubmitter,
} from '../../../infrastructure/rateLimit/guardPublicSubmission'
import { logActivity } from '../../../infrastructure/activity/logActivity'
import {
  assignedToAbsentLog,
  leftUnassignedLog,
  routingNote,
} from '../../../infrastructure/activity/routingNote'
import { workingDaysSinceLastSeen } from '../../../domain/time/workingDaysSinceLastSeen'
import { createPostgresUserRepository } from '../../../adapters/repositories/postgresUserRepository'
import { translations } from '../../../i18n/translations'

export async function POST(request: NextRequest) {
  const guard = await guardPublicSubmission(request, Date.now())
  if (guard.tooMany) {
    return NextResponse.json({ ok: false, errors: ['tooManySubmissions'] }, { status: 429 })
  }

  const body = await request.json()

  const repeat = await guardRepeatSubmitter(body.phone, Date.now())
  if (repeat.tooMany) {
    return NextResponse.json(
      { ok: false, errors: ['tooManySubmissionsFromNumber'] },
      { status: 429 }
    )
  }
  const applicationRepository = createPostgresApplicationRepository(pool)
  const result = await submitApplication(
    {
      kind: body.kind,
      serviceCode: body.serviceCode,
      name: body.name,
      phone: body.phone,
      fields: body.fields ?? {},
    },
    {
      applicationRepository,
      specializationRepository: createPostgresSpecializationRepository(pool),
      clock: systemClock,
    }
  )

  if (!result.ok) return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 })

  const session = await getServerSession(authOptions)
  const counselor = result.application.counselorId
    ? await createPostgresUserRepository(pool).findById(result.application.counselorId)
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
    'application_submitted',
    'application',
    result.application.id,
    `Submitted ${result.application.kind} application for ${result.application.name}${withheld.en}`,
    `تم تقديم طلب ${
      result.application.kind === 'visa'
        ? translations.ar.apply.visaTab
        : translations.ar.apply.examTab
    } لـ ${result.application.name}${withheld.ar}`
  )

  // العميل انعطى لغايب لأن ما فيه بديل حاضر — لا يبقى بلا صاحب، بس يبان أحمر
  if (result.assignedWhileAbsent && counselor) {
    const note = assignedToAbsentLog(result.application.name, {
      name: counselor.name,
      nameAr: counselor.nameAr ?? null,
      quietWorkingDays: workingDaysSinceLastSeen(counselor.lastSeenAt, systemClock.now()),
    })
    await logActivity(
      pool,
      session,
      'visit_assigned_to_absent',
      'application',
      result.application.id,
      note.en,
      note.ar
    )
  }

  // ما فيه ولا مستشار بالشفت يغطي هالوجهة — العميل فعلاً بلا صاحب
  if (result.application.counselorId === null) {
    const unassigned = leftUnassignedLog(result.application.name, null)
    await logActivity(
      pool,
      session,
      'visit_left_unassigned',
      'application',
      result.application.id,
      unassigned.en,
      unassigned.ar
    )
  }

  return NextResponse.json({
    ok: true,
    applicationId: result.application.id,
    applicationNumber: result.application.applicationNumber,
  })
}
