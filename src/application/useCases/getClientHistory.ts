import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { Visit } from '../../domain/entities/visit'
import type { Application } from '../../domain/entities/application'
import type { VisitRepository } from '../ports/VisitRepository'
import type { ApplicationRepository } from '../ports/ApplicationRepository'
import type { UserRepository } from '../ports/UserRepository'
import { holdsScopeForApplicationKind } from '../../domain/access/applicationScope'

export interface GetClientHistoryDeps {
  visitRepository: VisitRepository
  applicationRepository: ApplicationRepository
  userRepository: UserRepository
}

export interface ClientHistoryEntry {
  source: 'visit' | 'application'
  id: string
  label: string
  visitType: Visit['type'] | null
  applicationKind: Application['kind'] | null
  serviceCode: string | null
  // وجهة الزيارة: هي اللي تقرر إذا كانت داخل نطاق المستشار أو لا
  visitScope: string | null
  status: string
  counselorId: string | null
  counselorName: string | null
  counselorNameAr: string | null
  createdAt: Date
  // خارج نطاق المستشار: نقول إن فيه خدمة بهذا التاريخ، وما نقول وش هي.
  // إخفاؤها كامل يخلي الشارة تقول "٣ زيارات" وتعرض وحدة، أو تقول "ما فيه
  // سجل" لعميل سجله موجود — والكذب أسوأ من الكتمان
  redacted: boolean
}

export type GetClientHistoryResult =
  { ok: true; entries: ClientHistoryEntry[] } | { ok: false; reason: string }

// label تبقى إنجليزي دايمًا — تُستخدم فقط بتصدير الإكسل؛ الواجهة تترجم
// بنفسها من visitType/applicationKind/serviceCode
const VISIT_TYPE_LABEL: Record<Visit['type'], string> = {
  new: 'New client',
  follow_up: 'Follow-up',
  visa: 'Visa/other',
}

function visitToEntry(
  visit: Visit,
  counselorNameById: Map<string, { name: string; nameAr: string | null }>
): ClientHistoryEntry {
  const counselor = visit.counselorId ? counselorNameById.get(visit.counselorId) : null
  return {
    source: 'visit',
    id: visit.id,
    label: VISIT_TYPE_LABEL[visit.type],
    visitType: visit.type,
    applicationKind: null,
    serviceCode: null,
    visitScope: visit.desiredCountry,
    status: visit.status,
    counselorId: visit.counselorId,
    counselorName: counselor?.name ?? null,
    counselorNameAr: counselor?.nameAr ?? null,
    createdAt: visit.createdAt,
    redacted: false,
  }
}

function applicationToEntry(
  application: Application,
  counselorNameById: Map<string, { name: string; nameAr: string | null }>
): ClientHistoryEntry {
  const counselor = application.counselorId ? counselorNameById.get(application.counselorId) : null
  return {
    source: 'application',
    id: application.id,
    label: `${application.kind === 'visa' ? 'Visa' : 'Exam'} — ${application.serviceCode}`,
    visitType: null,
    applicationKind: application.kind,
    serviceCode: application.serviceCode,
    visitScope: null,
    status: application.status,
    counselorId: application.counselorId,
    counselorName: counselor?.name ?? null,
    counselorNameAr: counselor?.nameAr ?? null,
    createdAt: application.createdAt,
    redacted: false,
  }
}

export interface ClientHistoryActor {
  role: UserRole
  id: string
  scopes: SpecializationScope[]
}

// كل ما يبقى من السطر: فيه خدمة بهذا التاريخ. لا نوعها ولا حالتها ولا من تولّاها
function redact(entry: ClientHistoryEntry): ClientHistoryEntry {
  return {
    source: entry.source,
    id: entry.id,
    label: 'Another service',
    visitType: null,
    applicationKind: null,
    serviceCode: null,
    visitScope: null,
    status: '',
    counselorId: null,
    counselorName: null,
    counselorNameAr: null,
    createdAt: entry.createdAt,
    redacted: true,
  }
}

// اللي اشتغل على السطر بنفسه يشوفه كامل مهما كان نطاقه — هو اللي سوّاه.
// غير كذا: نطاق الوجهة للزيارة، ونوع الطلب للطلب
function isWithinScope(entry: ClientHistoryEntry, actor: ClientHistoryActor): boolean {
  if (entry.counselorId === actor.id) return true
  // نوع مجهول ما يطابق أي نطاق، فيُحجب — نفس الرفض بكل مكان
  if (entry.applicationKind)
    return holdsScopeForApplicationKind(actor.scopes, entry.applicationKind)
  if (entry.visitScope) return actor.scopes.includes(entry.visitScope as SpecializationScope)
  // زيارة بلا وجهة محددة ما تخص نطاقاً بعينه، فما فيه شي نحجبه
  return true
}

export async function getClientHistory(
  actor: ClientHistoryActor,
  phone: string,
  deps: GetClientHistoryDeps
): Promise<GetClientHistoryResult> {
  const [visits, applications, allUsers] = await Promise.all([
    deps.visitRepository.findAllByPhone(phone),
    deps.applicationRepository.findAllByPhone(phone),
    deps.userRepository.findAll(),
  ])
  const counselorNameById = new Map(
    allUsers.map((u) => [u.id, { name: u.name, nameAr: u.nameAr ?? null }])
  )

  const entries = [
    ...visits.map((v) => visitToEntry(v, counselorNameById)),
    ...applications.map((a) => applicationToEntry(a, counselorNameById)),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  // الإدارة تشوف كل شي — الشارة تظهر لهم بصفحة الزيارات وهي شغلهم
  if (actor.role === 'super_admin' || actor.role === 'admin') return { ok: true, entries }

  // المستشار ما عنده خانة بحث أصلاً: الشارة تطلع له فقط على طلابه. فاللي ما
  // تولّاه ولا مرة، ما له سبب يسأل عن سجله — والأرقام الكويتية ثمان خانات،
  // يعني قابلة للعد من أولها لآخرها لو تركنا الباب مفتوح
  const hasHandledClient = entries.some((entry) => entry.counselorId === actor.id)
  if (!hasHandledClient) return { ok: false, reason: 'notYourClient' }

  return {
    ok: true,
    entries: entries.map((entry) => (isWithinScope(entry, actor) ? entry : redact(entry))),
  }
}
// التصدير كان ينادي getClientHistory لكل عميل، وكل نداء ثلاثة استعلامات —
// وواحد منها findAll() على جدول المستخدمين كامل. تصدير فيه ٨٠٠ عميل يعني
// ٢٤٠٠ استعلام تنطلق مع بعض على Pool فيه عشرة اتصالات، فيجوع الـ Pool
// ويطيح معه تسجيل الدخول نفسه لأنه يتشارك نفس الاتصالات.
// الحل مو سقف تزامن — الحل إن الشكل غلط: ثلاثة استعلامات للتصدير كله
export async function getClientHistoriesByPhone(
  actor: ClientHistoryActor,
  phones: string[],
  deps: GetClientHistoryDeps
): Promise<Map<string, ClientHistoryEntry[]>> {
  const byPhone = new Map<string, ClientHistoryEntry[]>()
  if (phones.length === 0) return byPhone

  const unique = [...new Set(phones)]
  const [visits, applications, allUsers] = await Promise.all([
    deps.visitRepository.findAllByPhones(unique),
    deps.applicationRepository.findAllByPhones(unique),
    deps.userRepository.findAll(),
  ])
  const counselorNameById = new Map(
    allUsers.map((u) => [u.id, { name: u.name, nameAr: u.nameAr ?? null }])
  )

  const entriesByPhone = new Map<string, ClientHistoryEntry[]>()
  const push = (phone: string, entry: ClientHistoryEntry) => {
    const list = entriesByPhone.get(phone)
    if (list) list.push(entry)
    else entriesByPhone.set(phone, [entry])
  }
  for (const visit of visits) push(visit.phone, visitToEntry(visit, counselorNameById))
  for (const application of applications) {
    push(application.phone, applicationToEntry(application, counselorNameById))
  }

  // نفس قواعد النسخة المفردة بالضبط، عشان ما يفترق المعنى بين الشاشة والتصدير
  for (const phone of unique) {
    const entries = (entriesByPhone.get(phone) ?? []).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
    if (actor.role === 'super_admin' || actor.role === 'admin') {
      byPhone.set(phone, entries)
      continue
    }
    const hasHandledClient = entries.some((entry) => entry.counselorId === actor.id)
    byPhone.set(
      phone,
      hasHandledClient
        ? entries.map((entry) => (isWithinScope(entry, actor) ? entry : redact(entry)))
        : []
    )
  }
  return byPhone
}
