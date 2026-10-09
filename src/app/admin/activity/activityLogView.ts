import { severityOf } from '../../../domain/entities/activityLog'
import type { ActivityAction, ActivitySeverity } from '../../../domain/entities/activityLog'
import { DETAIL_TAIL_SEPARATOR } from '../../../infrastructure/activity/followUpCounselorLog'
import { startOfKuwaitDay, KUWAIT_TIME_ZONE } from '../../../domain/time/kuwaitTime'

// الصف زي ما يوصل من /api/admin/activity-logs — التواريخ تجينا نصوص JSON مو Date
export interface ActivityLogRow {
  id: string
  actorId: string | null
  actorName: string
  actorNameAr: string | null
  actorRole: string
  action: ActivityAction
  targetType: 'account' | 'visit' | 'application'
  targetId: string
  details: string | null
  detailsAr: string | null
  createdAt: string
  // يجي من السيرفر: هل الزيارة اللي يشير لها هالصف لسا مفتوحة وبدون مستشار.
  // هذي الحقيقة الوحيدة اللي نقدر نتأكد منها للصفوف القديمة
  clientStillUnassigned?: boolean
}

export interface ActivityFilters {
  search: string
  action: ActivityAction | 'all'
  actor: string
  severity: ActivitySeverity | 'all'
  days: number | 'all'
}

export const EMPTY_FILTERS: ActivityFilters = {
  search: '',
  action: 'all',
  actor: 'all',
  severity: 'all',
  days: 'all',
}

export function hasActiveFilters(filters: ActivityFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.action !== 'all' ||
    filters.actor !== 'all' ||
    filters.severity !== 'all' ||
    filters.days !== 'all'
  )
}

// صفوف الكشك والفورم العام ما لها actor_id — نرجع للاسم عشان التجميع والعدّ
// ما يعتبرون كل الصفوف الذاتية شخص واحد بالغلط
function actorKey(row: ActivityLogRow): string {
  return row.actorId ?? `name:${row.actorName}`
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// بداية اليوم المحلي — نستخدمها للفلترة بالأيام وعشان نعرف "اليوم" بالهيدر
// كان منتصف ليل جهاز القارئ. السجل يقرأه فريق بالكويت عن أحداث بالكويت،
// فالحد لازم يكون منتصف ليل الكويت مهما كانت ساعة الجهاز
function startOfLocalDay(date: Date): Date {
  return startOfKuwaitDay(date)
}

export function applyFilters(
  rows: ActivityLogRow[],
  filters: ActivityFilters,
  now: Date
): ActivityLogRow[] {
  const needle = filters.search.trim().toLowerCase()
  const cutoff =
    filters.days === 'all'
      ? null
      : new Date(startOfLocalDay(now).getTime() - (filters.days - 1) * 24 * 60 * 60 * 1000)

  return rows.filter((row) => {
    if (filters.action !== 'all' && row.action !== filters.action) return false
    if (filters.actor !== 'all' && row.actorName !== filters.actor) return false
    if (filters.severity !== 'all' && severityOf(row.action) !== filters.severity) return false
    if (cutoff && new Date(row.createdAt) < cutoff) return false
    if (needle) {
      const haystack = `${row.actorName} ${row.details ?? ''} ${row.targetId}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })
}

export interface ActivitySummary {
  today: number
  actorsToday: number
  routine: number
  privilege: number
  destructive: number
}

// الهيدر يعدّ اليوم فقط — نافذة الـ200 صف ما تكفي لأسبوع بيوم مزحوم،
// فأي عدّاد أطول من يوم يطلع ناقص بصمت
export function summarizeToday(rows: ActivityLogRow[], now: Date): ActivitySummary {
  const summary: ActivitySummary = {
    today: 0,
    actorsToday: 0,
    routine: 0,
    privilege: 0,
    destructive: 0,
  }
  const actors = new Set<string>()

  for (const row of rows) {
    if (!isSameLocalDay(new Date(row.createdAt), now)) continue
    summary.today += 1
    actors.add(actorKey(row))
    summary[severityOf(row.action)] += 1
  }

  summary.actorsToday = actors.size
  return summary
}

export type FeedItem =
  | { kind: 'event'; row: ActivityLogRow }
  | { kind: 'bundle'; rows: ActivityLogRow[]; actorName: string; action: ActivityAction }

export interface DayGroup {
  key: string
  date: Date
  items: FeedItem[]
}

export const BUNDLE_THRESHOLD = 3

// نلمّ الصفوف المتتالية اللي نفس المستخدم ونفس الإجراء بصف واحد بعدّاد،
// عشان يوم مزحوم ما يصير قائمة تكرار ما تنقرأ
function bundleRun(run: ActivityLogRow[], threshold: number): FeedItem[] {
  if (run.length >= threshold) {
    return [{ kind: 'bundle', rows: run, actorName: run[0].actorName, action: run[0].action }]
  }
  return run.map((row) => ({ kind: 'event', row }) as FeedItem)
}

function buildItems(dayRows: ActivityLogRow[], threshold: number): FeedItem[] {
  const items: FeedItem[] = []
  let run: ActivityLogRow[] = []

  for (const row of dayRows) {
    const head = run[0]
    if (head && actorKey(head) === actorKey(row) && head.action === row.action) {
      run.push(row)
      continue
    }
    if (run.length) items.push(...bundleRun(run, threshold))
    run = [row]
  }
  if (run.length) items.push(...bundleRun(run, threshold))

  return items
}

export function groupByDay(
  rows: ActivityLogRow[],
  threshold: number = BUNDLE_THRESHOLD
): DayGroup[] {
  // الصفوف تجي مرتّبة تنازلي من الـAPI — نمشي عليها بالترتيب ونقسمها ليوم محلي
  const days: { key: string; date: Date; rows: ActivityLogRow[] }[] = []

  for (const row of rows) {
    const start = startOfLocalDay(new Date(row.createdAt))
    const key = start.toISOString()
    const last = days[days.length - 1]
    if (last && last.key === key) last.rows.push(row)
    else days.push({ key, date: start, rows: [row] })
  }

  return days.map((day) => ({
    key: day.key,
    date: day.date,
    items: buildItems(day.rows, threshold),
  }))
}

export function dayLabel(
  date: Date,
  now: Date,
  language: string,
  todayLabel: string,
  yesterdayLabel: string
): string {
  if (isSameLocalDay(date, now)) return todayLabel
  const yesterday = new Date(startOfLocalDay(now).getTime() - 24 * 60 * 60 * 1000)
  if (isSameLocalDay(date, yesterday)) return yesterdayLabel
  return date.toLocaleDateString(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: KUWAIT_TIME_ZONE,
  })
}

export type DenseSortField = 'createdAt' | 'actorName' | 'action' | 'targetType'
export type SortDir = 'asc' | 'desc'

// وضع "مضغوط" — جدول مفلطح بدون تجميع أيام ولا لمّ صفوف؛ الفرز هنا مستقل
// عن ترتيب groupByDay الافتراضي (تنازلي بالوقت) عشان يقدر يفرز بأي عمود
export function sortRows(
  rows: ActivityLogRow[],
  field: DenseSortField,
  dir: SortDir
): ActivityLogRow[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (field === 'createdAt')
      return sign * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return sign * a[field].localeCompare(b[field])
  })
}

export interface ActorOption {
  name: string
  nameAr: string | null
}

// الفلترة تبقى على actorName الخام (زي ما هو بالصفوف) — بس نرجّع nameAr كمان
// عشان القائمة المنسدلة تعرض التسمية المترجمة بدل الإنجليزي دايمًا
export function distinctActors(rows: ActivityLogRow[]): ActorOption[] {
  const byName = new Map<string, ActorOption>()
  for (const row of rows) {
    if (!byName.has(row.actorName))
      byName.set(row.actorName, { name: row.actorName, nameAr: row.actorNameAr })
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function distinctActions(rows: ActivityLogRow[]): ActivityAction[] {
  return Array.from(new Set(rows.map((row) => row.action))).sort()
}
// صفوف قديمة كُتبت قبل ما يصير لهالحالة صف مستقل: السبب محشور بآخر سطر
// "إنشاء زيارة" كنص. ما نعيد كتابة التاريخ — نتعرّف عليه وقت العرض ونلوّنه،
// فالسجل يظل يقول اللي صار وقتها بالضبط
const LEGACY_UNASSIGNED_MARKERS = [' — left unassigned:', ' — تُركت بدون تعيين:']

export function legacyUnassignedAt(details: string | null): number {
  if (!details) return -1
  for (const marker of LEGACY_UNASSIGNED_MARKERS) {
    const at = details.indexOf(marker)
    if (at >= 0) return at
  }
  return -1
}

// السطر محفوظ نص عادي، فعشان نلوّن آخره بس لازم نلقاه. مولّد السطر
// (followUpCounselorLog) يضمن إن آخر " — " هو الفاصل قبل "ما حضر من N يوم عمل".
// ما فيه فاصل؟ نرجّع السطر كامل بدون تلوين — ما يقدر يكسر الصف
export function splitTrailingDetail(details: string | null): { head: string; tail: string | null } {
  if (!details) return { head: '', tail: null }
  // الصف القديم فيه أكثر من " — " (الاسم ثم الوجهة ثم السبب)، فنقسم عند
  // السبب نفسه مو عند آخر واحدة — وإلا لوّنّا اسم الدولة
  const legacy = legacyUnassignedAt(details)
  const at = legacy >= 0 ? legacy : details.lastIndexOf(DETAIL_TAIL_SEPARATOR)
  if (at < 0) return { head: details, tail: null }
  return {
    head: details.slice(0, at + DETAIL_TAIL_SEPARATOR.length),
    tail: details.slice(at + DETAIL_TAIL_SEPARATOR.length),
  }
}
