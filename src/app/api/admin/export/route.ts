import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { getAdminKpis } from '../../../../application/useCases/getAdminKpis'
import {
  exportKpisToExcel,
  type ClientExportRow,
} from '../../../../application/useCases/exportKpisToExcel'
import { listAllCounselors } from '../../../../application/useCases/listAllCounselors'
import { getClientHistoriesByPhone } from '../../../../application/useCases/getClientHistory'
import { validateDateQueryParam } from '../../../../domain/validation/validateDateQueryParam'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { createPostgresApplicationRepository } from '../../../../adapters/repositories/postgresApplicationRepository'
import { logActivity } from '../../../../infrastructure/activity/logActivity'
import { translations } from '../../../../i18n/translations'
import type { ClientHistoryEntry } from '../../../../application/useCases/getClientHistory'
import { formatKuwaitDate } from '../../../../domain/time/formatKuwaitDateTime'

const DEFAULT_RANGE_DAYS_MS = 7 * 86400000

// نفس منطق entryLabel بشاشة ClientHistoryBadge — بس هنا سيرفري بدون useLanguage
function serviceEntryLabel(entry: ClientHistoryEntry, language: 'en' | 'ar'): string {
  const dict = translations[language]
  if (entry.visitType) return dict.visits[entry.visitType]
  if (entry.applicationKind) {
    const kindLabel =
      dict.visits[entry.applicationKind === 'visa' ? 'visaApplication' : 'examApplication']
    const serviceLabel = entry.serviceCode
      ? (dict.apply as Record<string, string>)[entry.serviceCode]
      : ''
    return serviceLabel ? `${kindLabel} — ${serviceLabel}` : kindLabel
  }
  return entry.label
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const fromResult = validateDateQueryParam(
    request.nextUrl.searchParams.get('from'),
    new Date(Date.now() - DEFAULT_RANGE_DAYS_MS)
  )
  if (!fromResult.isValid)
    return NextResponse.json({ ok: false, reason: fromResult.reason }, { status: 400 })

  const toResult = validateDateQueryParam(request.nextUrl.searchParams.get('to'), new Date())
  if (!toResult.isValid)
    return NextResponse.json({ ok: false, reason: toResult.reason }, { status: 400 })

  const language = request.nextUrl.searchParams.get('lang') === 'ar' ? 'ar' : 'en'
  const visitRepository = createPostgresVisitRepository(pool)
  const userRepository = createPostgresUserRepository(pool)

  const applicationRepository = createPostgresApplicationRepository(pool)
  const role = session!.user!.role
  const actorId = session!.user!.id as string
  const kpis = await getAdminKpis(
    { from: fromResult.date, to: toResult.date },
    { visitRepository, userRepository, applicationRepository }
  )
  const visits = await visitRepository.findAllInRange(fromResult.date, toResult.date)
  const counselors = await listAllCounselors({ userRepository })
  const counselorNameById = new Map(counselors.map((c) => [c.id, c.name]))

  // المسار محجوز للإدارة (requireRole فوق)، فما فيه حجب نطاقات هنا.
  // استعلامات ثابتة العدد مهما كبر التصدير — مو ثلاثة لكل عميل
  const uniquePhones = [...new Set(visits.map((v) => v.phone))]
  const historyByPhone = await getClientHistoriesByPhone(
    { role, id: actorId, scopes: [] },
    uniquePhones,
    { visitRepository, applicationRepository, userRepository }
  )

  const clients: ClientExportRow[] = visits.map((v) => {
    const entries = historyByPhone.get(v.phone) ?? []
    const servicesTaken = [...entries]
      .reverse()
      .map((e) => `${serviceEntryLabel(e, language)} (${formatKuwaitDate(e.createdAt)})`)
      .join('; ')
    return {
      name: v.name,
      phone: v.phone,
      desiredCountry: v.desiredCountry,
      counselorName: v.counselorId ? (counselorNameById.get(v.counselorId) ?? null) : null,
      visitCount: entries.length,
      servicesTaken,
    }
  })

  const result = await exportKpisToExcel(role, kpis, clients, language)
  if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason }, { status: 403 })

  // يصدّر اسم ورقم كل عميل بالفترة — لازم يكون له أثر بسجل النشاط، عكس ما كان
  // قبل. ما فيه target_type مخصص للتصدير بقاعدة البيانات، فنسجّله على حساب
  // الواجهة ترسل منتصف ليل الكويت، فقصّ الـISO كان يعطي اليوم اللي قبله
  // للبداية، والنهاية حد أعلى مفتوح بعد يوم — يعني السطر بالسجل ما يطابق
  // المدى اللي اختاره المشرف بأي طرف. آخر لحظة داخلة هي اليوم المقصود
  const exportedFrom = formatKuwaitDate(fromResult.date)
  const exportedTo = formatKuwaitDate(new Date(toResult.date.getTime() - 1))

  // المستخدم نفسه اللي صدّر — نفس المكان اللي رابط الحساب بسجل النشاط يودّيه له
  await logActivity(
    pool,
    session,
    'client_data_exported',
    'account',
    session!.user!.id,
    `Exported ${clients.length} client${clients.length === 1 ? '' : 's'} for ${exportedFrom} to ${exportedTo}`,
    `تم تصدير ${
      clients.length === 1
        ? 'عميل واحد'
        : clients.length === 2
          ? 'عميلين'
          : `${clients.length} عميل`
    } للفترة من ${exportedFrom} إلى ${exportedTo}`
  )

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="kpis.xlsx"',
    },
  })
}
