import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { submitNewClientVisit } from '../../../../application/useCases/submitNewClientVisit'
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
import { translations } from '../../../../i18n/translations'
import { COUNTRY_LABEL_KEYS, isKnownCountryScope } from '../../../../i18n/countryLabels'
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
  const result = await submitNewClientVisit(
    {
      name: body.name,
      phone: body.phone,
      desiredCountry: body.desiredCountry,
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
  // الاسم لازم يجي قبل السطر، لأن سطر "أُسندت إلى فلان" يحتاجه
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
    // الوجهة هي اللي حددت المستشار، فذكرها بالسجل يفسّر التوجيه بدون ما أحد يفتح الزيارة
    result.visit.desiredCountry
      ? `Created new-client visit for ${result.visit.name} — ${result.visit.desiredCountry}${withheld.en}`
      : `Created new-client visit for ${result.visit.name}${withheld.en}`,
    result.visit.desiredCountry
      ? `تم إنشاء زيارة عميل جديد لـ ${result.visit.name} — ${
          isKnownCountryScope(result.visit.desiredCountry)
            ? translations.ar.countries[COUNTRY_LABEL_KEYS[result.visit.desiredCountry]]
            : result.visit.desiredCountry
        }${withheld.ar}`
      : `تم إنشاء زيارة عميل جديد لـ ${result.visit.name}${withheld.ar}`
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
    const scopeLabel = result.visit.desiredCountry
      ? isKnownCountryScope(result.visit.desiredCountry)
        ? result.visit.desiredCountry
        : result.visit.desiredCountry
      : 'this destination'
    const unassigned = leftUnassignedLog(
      result.visit.name,
      null,
      result.unassignedReason
        ? {
            kind: result.unassignedReason,
            scopeLabel,
            offShiftCount: result.scopeHoldersOffShift,
          }
        : undefined
    )
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
