'use client'
import { NAME_SEARCH_LIMIT, SEARCH_TRUNCATED_HEADER } from '../../../domain/text/searchPage'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '../../../i18n/LanguageContext'
import { localizedName } from '../../../i18n/localizedName'
import type { Language } from '../../../i18n/translations'
import { translateErrorCode } from '../../../i18n/translateErrorCode'
import { ClientHistoryBadge } from '../../../components/ClientHistoryBadge'
import { useVisiblePolling } from '../../../hooks/useVisiblePolling'
import { COUNTRY_LABEL_KEYS, isKnownCountryScope } from '../../../i18n/countryLabels'
import { isApplicationOpen, type ApplicationStatus } from '../../../domain/entities/application'
import { FollowUpDueBadge } from '../../../components/FollowUpDueBadge'
import { CounselorAwayNote } from '../../../components/CounselorAwayNote'
import { CounselorShiftNote } from '../../../components/CounselorShiftNote'
import { TopScrollWrap } from '../../../components/TopScrollWrap'
import { TablePagingBar, TablePager } from '../../../components/TablePaging'
import { useTablePaging } from '../../../hooks/useTablePaging'
import {
  DATE_RANGE_PRESETS,
  computeDateRangeForPreset,
  type DateRangePreset,
} from '../../../domain/time/dateRangePresets'
import { kuwaitRangeQuery } from '../../../domain/time/kuwaitDateRange'
import { presetLabelKey } from '../presetLabelKey'
import { UNASSIGNED_COUNSELOR_ID } from '../../../domain/routing/unassignedCounselor'
import { KUWAIT_TIME_ZONE } from '../../../domain/time/kuwaitTime'
import { useDialog } from '../../../hooks/useDialog'

// نفس إيقاع لوحتي "المتواجدون الآن" والإشراف. مكتب الاستقبال يترك هالشاشة
// مفتوحة طول اليوم، وقبل كذا ما كانت تتحدّث إلا لو تغيّر فلتر — فزيارة جديدة
// أو إعادة تعيين ما تبان أبدًا، والموظفة تشوف طابور الصباح الساعة أربع
const POLL_INTERVAL_MS = 20 * 1000

const PAGE_SIZE_STORAGE_KEY = 'visits-page-size'

type VisitStudentStatus = 'waiting' | 'in_session' | 'follow_up_needed' | 'closed'

interface VisitRow {
  id: string
  type: 'new' | 'follow_up' | 'visa'
  desiredCountry: string | null
  name: string
  phone: string
  counselorId: string | null
  counselorName: string | null
  counselorNameAr: string | null
  counselorSignedInToday: boolean | null
  counselorQuietWorkingDays: number | null
  counselorShift: 'day' | 'night' | null
  status: 'next' | 'closed'
  studentStatus: VisitStudentStatus | null
  createdAt: string
  pickedUpAt: string | null
  closedAt: string | null
  note: string | null
  followUpDueAt: string | null
}

const STUDENT_STATUS_LABEL_KEY: Record<
  VisitStudentStatus,
  'statusWaiting' | 'statusInSession' | 'statusFollowUpNeeded' | 'statusClosed'
> = {
  waiting: 'statusWaiting',
  in_session: 'statusInSession',
  follow_up_needed: 'statusFollowUpNeeded',
  closed: 'statusClosed',
}
const STUDENT_STATUS_PILL_CLASS: Record<VisitStudentStatus, string> = {
  waiting: 'watch',
  in_session: 'on-track',
  follow_up_needed: 'inactive',
  closed: 'on-track',
}

interface ApplicationRow {
  id: string
  kind: 'visa' | 'exam'
  name: string
  phone: string
  counselorId: string | null
  counselorName: string | null
  counselorNameAr: string | null
  counselorSignedInToday: boolean | null
  counselorQuietWorkingDays: number | null
  counselorShift: 'day' | 'night' | null
  status: ApplicationStatus
  createdAt: string
  acceptedAt: string | null
  closedAt: string | null
}

// الاسم يجي محلولاً من السيرفر مع الصف نفسه. لو المستشار ما عاد موجود بجدول
// المستخدمين نقول "مستشار غير معروف" — أوضح من معرّف خام ما يفيد أحد
function counselorDisplayName(
  row: { counselorName: string | null; counselorNameAr: string | null },
  language: Language,
  unknownLabel: string
): string {
  return row.counselorName
    ? localizedName(row.counselorName, row.counselorNameAr, language)
    : unknownLabel
}

function formatTimelineWhen(isoDate: string, language: string): string {
  return new Date(isoDate).toLocaleString(language, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: KUWAIT_TIME_ZONE,
  })
}

interface CounselorOption {
  id: string
  name: string
  nameAr: string | null
}

type SortField = 'date' | 'name' | 'status'
type SortDir = 'asc' | 'desc'

type CombinedRow =
  { rowKind: 'visit'; data: VisitRow } | { rowKind: 'application'; data: ApplicationRow }

function sortValue(row: CombinedRow, field: SortField): string {
  if (field === 'date') return row.data.createdAt
  if (field === 'name') return row.data.name.toLocaleLowerCase()
  return row.data.status
}

function sortCombinedRows(rows: CombinedRow[], field: SortField, dir: SortDir): CombinedRow[] {
  const sorted = [...rows].sort((a, b) => sortValue(a, field).localeCompare(sortValue(b, field)))
  return dir === 'asc' ? sorted : sorted.reverse()
}

// القطع يوصل بهيدر مو بالجسم — الرد يظل مصفوفة زي ما هو
async function fetchVisits(query: string): Promise<{ rows: VisitRow[]; truncated: boolean }> {
  const response = await fetch(`/api/admin/visits${query}`)
  const truncated = response.headers?.get(SEARCH_TRUNCATED_HEADER) === 'true'
  const data = await response.json()
  return { rows: Array.isArray(data) ? data : [], truncated }
}

async function fetchApplications(
  kind: 'visa' | 'exam',
  query: string
): Promise<{ rows: ApplicationRow[]; truncated: boolean }> {
  const response = await fetch(`/api/applications/kind/${kind}${query}`)
  if (!response.ok) return { rows: [], truncated: false }
  const truncated = response.headers?.get(SEARCH_TRUNCATED_HEADER) === 'true'
  const data = await response.json()
  return { rows: Array.isArray(data) ? data : [], truncated }
}

async function fetchCounselors(): Promise<CounselorOption[]> {
  const response = await fetch('/api/counselors/active')
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

async function fetchAllCounselors(): Promise<CounselorOption[]> {
  const response = await fetch('/api/counselors/all')
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export function VisitsPanel({ role }: { role: 'admin' | 'super_admin' }) {
  const { t, language } = useLanguage()
  // ?focus=<id> يجينا من سجل النشاط — نعرض السجل المقصود بس بدل ما نرمي المستخدم بقائمة كاملة
  const searchParams = useSearchParams()
  const focusId = searchParams.get('focus')
  // ?counselor=<id> يجينا من "عرض الزيارات" بلوحة الـ KPI — نعرض زيارات هالمستشار بس
  const counselorFilterId = searchParams.get('counselor')
  // ?waiting=<سطل> يجي من لوحة الإشعارات — بدون أي حد تواريخ، عشان الصفحة
  // تعرض نفس العملاء اللي عدّهم الجرس بالضبط
  const waitingFilter = searchParams.get('waiting')
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [counselors, setCounselors] = useState<CounselorOption[]>([])
  const [allCounselors, setAllCounselors] = useState<CounselorOption[]>([])
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
    kind: 'visit' | 'application'
  } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set())
  // نفس سلوك لوحة الـKPI: النطاق الافتراضي يتبع التقويم بتوقيت الكويت
  const [preset, setPreset] = useState<DateRangePreset>('week')
  const [manualRange, setManualRange] = useState<{ from: string; to: string } | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  // البحث انقطع عند السقف: لازم يُقال، وإلا بدا كأن الباقي مو موجود
  const [visitsTruncated, setVisitsTruncated] = useState(false)
  // مع التحديث الدوري صار السباق حقيقي: رد قديم يوصل بعد رد أحدث فيدهسه،
  // فتشوف نتائج فلتر ما عاد معروضًا. نفس حارس AdminDashboard
  const latestVisitsRequest = useRef(0)
  const latestApplicationsRequest = useRef(0)
  const [applicationsTruncated, setApplicationsTruncated] = useState(false)
  const [allTimeTotal, setAllTimeTotal] = useState<number | null>(null)
  const range = manualRange ?? computeDateRangeForPreset(preset, new Date())
  const rangeQuery = kuwaitRangeQuery(range)
  function requestDelete(id: string, name: string, kind: 'visit' | 'application') {
    setDeleteError(null)
    setPendingDelete({ id, name, kind })
  }

  function closeDeleteModal() {
    setPendingDelete(null)
    setDeleteError(null)
  }

  function handleSort(field: SortField) {
    paging.resetToFirstPage()
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'date' ? 'desc' : 'asc')
    }
  }

  // لو انحفظت قيمة قديمة أو غير معروفة، نعرضها كما هي بدل ما نخفيها أو نطيح
  function countryLabel(value: string): string {
    return isKnownCountryScope(value) ? t('countries', COUNTRY_LABEL_KEYS[value]) : value
  }

  function toggleNote(visitId: string) {
    setExpandedNoteIds((current) => {
      const next = new Set(current)
      if (next.has(visitId)) next.delete(visitId)
      else next.add(visitId)
      return next
    })
  }

  useEffect(() => {
    fetchCounselors().then(setCounselors)
    fetchAllCounselors().then(setAllCounselors)
    fetch('/api/admin/visits/total')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setAllTimeTotal(typeof data?.total === 'number' ? data.total : null))
      .catch(() => setAllTimeTotal(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    refresh()
    if (role === 'super_admin') refreshApplications()
    paging.resetToFirstPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeQuery?.from, rangeQuery?.to, activeSearch, waitingFilter])

  // التحديث الدوري. ما يمس ترقيم الصفحات ولا الفلاتر — الأثر الوحيد إن
  // الصفوف تصير طازجة، فالموظفة ما تشوف طابور صباحي الساعة أربع
  useVisiblePolling(() => {
    void refresh()
    if (role === 'super_admin') void refreshApplications()
  }, POLL_INTERVAL_MS)

  // البحث يتجاهل التواريخ عمدًا ويغطي كل الأرشيف؛ بدونه نلتزم بالنطاق المعروض
  function listQuery(): string | null {
    if (waitingFilter) return `?waiting=${encodeURIComponent(waitingFilter)}`
    if (activeSearch) return `?q=${encodeURIComponent(activeSearch)}`
    if (!rangeQuery) return null
    return `?from=${encodeURIComponent(rangeQuery.from)}&to=${encodeURIComponent(rangeQuery.to)}`
  }

  async function refresh() {
    const query = listQuery()
    if (query === null) return
    const requestId = ++latestVisitsRequest.current
    const page = await fetchVisits(query)
    // وصل متأخرًا وفيه أحدث منه: نتركه يروح بدل ما يرجّع الشاشة للخلف
    if (requestId !== latestVisitsRequest.current) return
    setVisits(page.rows)
    setVisitsTruncated(page.truncated)
  }

  async function refreshApplications() {
    // الطلبات ما لها سطل انتظار — الفلتر هذا للزيارات فقط، فنخفي الطلبات
    // بدل ما نرسل لهم باراميتر ما يفهمونه ونعرض خليط ما أحد طلبه
    if (waitingFilter) {
      setApplications([])
      return
    }
    const query = listQuery()
    if (query === null) return
    const requestId = ++latestApplicationsRequest.current
    const [visa, exam] = await Promise.all([
      fetchApplications('visa', query),
      fetchApplications('exam', query),
    ])
    if (requestId !== latestApplicationsRequest.current) return
    setApplications([...visa.rows, ...exam.rows])
    setApplicationsTruncated(visa.truncated || exam.truncated)
  }

  async function handleAssign(visitId: string, counselorId: string) {
    await fetch('/api/admin/reassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId, counselorId }),
    })
    await refresh()
  }

  async function handleUnassign(visitId: string) {
    await fetch('/api/admin/reassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId, counselorId: null }),
    })
    await refresh()
  }

  async function handleAssignApplication(
    applicationId: string,
    kind: 'visa' | 'exam',
    counselorId: string
  ) {
    await fetch(`/api/applications/kind/${kind}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, counselorId }),
    })
    await refreshApplications()
  }

  async function handleUnassignApplication(applicationId: string, kind: 'visa' | 'exam') {
    await fetch(`/api/applications/kind/${kind}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, counselorId: null }),
    })
    await refreshApplications()
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    const { id, kind } = pendingDelete
    try {
      const url = kind === 'visit' ? `/api/admin/visits/${id}` : `/api/applications/${id}`
      const response = await fetch(url, { method: 'DELETE' })
      const result = await response.json()
      if (!result.ok) {
        setDeleteError(
          translateErrorCode(language, result.reason) ?? t('visits', 'couldNotDeleteVisit')
        )
        return
      }
      setPendingDelete(null)
      setDeleteError(null)
      if (kind === 'visit') await refresh()
      else await refreshApplications()
    } catch {
      setDeleteError(t('visits', 'couldNotDeleteVisit'))
    }
  }

  const combinedRows: CombinedRow[] = [
    ...visits.map((data): CombinedRow => ({ rowKind: 'visit', data })),
    ...applications.map((data): CombinedRow => ({ rowKind: 'application', data })),
  ]
  const sortedRows = sortCombinedRows(combinedRows, sortField, sortDir)
  const shownRows = focusId
    ? sortedRows.filter((row) => row.data.id === focusId)
    : counselorFilterId === UNASSIGNED_COUNSELOR_ID
      ? sortedRows.filter((row) => row.data.counselorId === null)
      : counselorFilterId
        ? sortedRows.filter((row) => row.data.counselorId === counselorFilterId)
        : sortedRows

  // اسم البانر: من صف محلول بالسيرفر أول، وإلا من قائمة كل المستشارين (مو
  // المفلترة بالدوام). لو ما توفر ولا واحد نقول "غير معروف" بدل المعرّف الخام
  const namedRow = shownRows.find((row) => row.data.counselorName !== null)?.data
  const listedCounselor = allCounselors.find((c) => c.id === counselorFilterId)
  const counselorFilterName = namedRow
    ? counselorDisplayName(namedRow, language, t('visits', 'unknownCounselor'))
    : listedCounselor
      ? localizedName(listedCounselor.name, listedCounselor.nameAr, language)
      : null

  const paging = useTablePaging(shownRows, PAGE_SIZE_STORAGE_KEY)
  const pageSlice = paging.slice

  const visitCountByPhone: Record<string, number> = {}
  for (const row of combinedRows) {
    visitCountByPhone[row.data.phone] = (visitCountByPhone[row.data.phone] ?? 0) + 1
  }

  function renderVisitRow(visit: VisitRow) {
    return (
      <tr key={visit.id}>
        <td data-label={t('visits', 'name')}>
          {visit.name}
          {visit.note && (
            // زر حقيقي: كان div ينضغط بالماوس بس، فالملاحظة المقصوصة ما تنقرا كاملة
            // بالكيبورد. aria-expanded يقول لقارئ الشاشة إذا انفتحت فعلاً
            <button
              type="button"
              className={`row-note ${expandedNoteIds.has(visit.id) ? 'expanded' : ''}`}
              aria-expanded={expandedNoteIds.has(visit.id)}
              onClick={() => toggleNote(visit.id)}
            >
              📝 {visit.note}{' '}
              <span className="row-note-more">
                {expandedNoteIds.has(visit.id) ? t('visits', 'noteLess') : t('visits', 'noteMore')}
              </span>
            </button>
          )}
        </td>
        <td data-label={t('visits', 'phone')}>
          {visit.phone}{' '}
          <ClientHistoryBadge phone={visit.phone} count={visitCountByPhone[visit.phone] ?? 1} />
        </td>
        <td data-label={t('visits', 'type')}>
          {t('visits', visit.type)}
          {/* الوجهة اللي اختارها العميل هي اللي وجّهته لهالمستشار — بدونها ما أحد
              يعرف ليش انسدحت الزيارة لفلان. زيارات المتابعة والتأشيرة ما تسأل عنها */}
          {visit.desiredCountry && (
            <div className="row-sub">{countryLabel(visit.desiredCountry)}</div>
          )}
        </td>
        <td data-label={t('visits', 'status')}>
          <span className={`pill ${visit.status === 'closed' ? 'on-track' : 'watch'}`}>
            {t('visits', visit.status === 'closed' ? 'statusClosed' : 'statusOpen')}
          </span>
        </td>
        <td data-label={t('visits', 'studentStatus')}>
          {visit.studentStatus ? (
            <>
              <span className={`pill ${STUDENT_STATUS_PILL_CLASS[visit.studentStatus]}`}>
                {t('students', STUDENT_STATUS_LABEL_KEY[visit.studentStatus])}
              </span>
              {visit.studentStatus === 'follow_up_needed' && visit.followUpDueAt && (
                <div className="row-sub">
                  <FollowUpDueBadge followUpDueAt={visit.followUpDueAt} language={language} t={t} />
                </div>
              )}
            </>
          ) : (
            '—'
          )}
        </td>
        <td data-label={t('visits', 'counselor')}>
          {role === 'super_admin' ? (
            <div className="counselor-cell">
              {visit.counselorId ? (
                <>
                  {/* الاسم وزر الإلغاء بسطر واحد، والغياب سطر تحتهما: الشارة
                      كانت تلف فتفصل الزر عن الاسم اللي يخصه */}
                  <div className="counselor-line">
                    <span className="counselor-name">
                      {counselorDisplayName(visit, language, t('visits', 'unknownCounselor'))}
                    </span>
                    <CounselorShiftNote shift={visit.counselorShift} />
                    <button
                      type="button"
                      className="unassign-x"
                      title={t('visits', 'unassign')}
                      aria-label={t('visits', 'unassignNamed').replace(
                        '{name}',
                        counselorDisplayName(visit, language, t('visits', 'unknownCounselor'))
                      )}
                      onClick={() => handleUnassign(visit.id)}
                    >
                      ✕
                    </button>
                  </div>
                  <CounselorAwayNote
                    isOpen={visit.status === 'next'}
                    signedInToday={visit.counselorSignedInToday}
                    quietWorkingDays={visit.counselorQuietWorkingDays}
                  />
                </>
              ) : (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) handleAssign(visit.id, e.target.value)
                  }}
                >
                  <option value="">{t('visits', 'chooseCounselor')}</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {localizedName(c.name, c.nameAr, language)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : visit.counselorId ? (
            <>
              {counselorDisplayName(visit, language, t('visits', 'unknownCounselor'))}
              <CounselorAwayNote
                isOpen={visit.status === 'next'}
                signedInToday={visit.counselorSignedInToday}
                quietWorkingDays={visit.counselorQuietWorkingDays}
              />
            </>
          ) : (
            t('visits', 'unassigned')
          )}
        </td>
        <td data-label={t('visits', 'timeline')}>
          <div className="mini-timeline">
            <div className="mini-timeline-step done">
              <span className="mini-timeline-dot" />
              <span className="mini-timeline-label">{t('visits', 'timelineSubmitted')}</span>
              <span className="mini-timeline-when">
                {formatTimelineWhen(visit.createdAt, language)}
              </span>
            </div>
            <div className={`mini-timeline-step ${visit.pickedUpAt ? 'done' : 'pending'}`}>
              <span className="mini-timeline-dot" />
              <span className="mini-timeline-label">{t('visits', 'timelinePickedUp')}</span>
              <span className="mini-timeline-when">
                {visit.pickedUpAt
                  ? formatTimelineWhen(visit.pickedUpAt, language)
                  : t('visits', 'timelineNotYet')}
              </span>
            </div>
            <div className={`mini-timeline-step ${visit.closedAt ? 'done' : 'pending'}`}>
              <span className="mini-timeline-dot" />
              <span className="mini-timeline-label">{t('visits', 'timelineClosed')}</span>
              <span className="mini-timeline-when">
                {visit.closedAt
                  ? formatTimelineWhen(visit.closedAt, language)
                  : t('visits', 'timelineNotYet')}
              </span>
            </div>
          </div>
        </td>
        {role === 'super_admin' && (
          <td className="cell-actions">
            <button
              type="button"
              className="action-danger"
              onClick={() => requestDelete(visit.id, visit.name, 'visit')}
            >
              {t('visits', 'delete')}
            </button>
          </td>
        )}
      </tr>
    )
  }

  function renderApplicationRow(application: ApplicationRow) {
    return (
      <tr key={application.id} className="applications-merged-row">
        <td data-label={t('visits', 'name')}>{application.name}</td>
        <td data-label={t('visits', 'phone')}>
          {application.phone}{' '}
          <ClientHistoryBadge
            phone={application.phone}
            count={visitCountByPhone[application.phone] ?? 1}
          />
        </td>
        <td data-label={t('visits', 'type')}>
          {t('visits', application.kind === 'visa' ? 'visaApplication' : 'examApplication')}
        </td>
        <td data-label={t('visits', 'status')}>
          <span className="pill watch">{t('applications', application.status)}</span>
        </td>
        <td data-label={t('visits', 'studentStatus')}>—</td>
        <td data-label={t('visits', 'counselor')}>
          {role === 'super_admin' ? (
            <div className="counselor-cell">
              {application.counselorId ? (
                <>
                  {/* الاسم وزر الإلغاء بسطر واحد، والغياب سطر تحتهما: الشارة
                      كانت تلف فتفصل الزر عن الاسم اللي يخصه */}
                  <div className="counselor-line">
                    <span className="counselor-name">
                      {counselorDisplayName(application, language, t('visits', 'unknownCounselor'))}
                    </span>
                    <CounselorShiftNote shift={application.counselorShift} />
                    <button
                      type="button"
                      className="unassign-x"
                      title={t('visits', 'unassign')}
                      aria-label={t('visits', 'unassignNamed').replace(
                        '{name}',
                        counselorDisplayName(application, language, t('visits', 'unknownCounselor'))
                      )}
                      onClick={() => handleUnassignApplication(application.id, application.kind)}
                    >
                      ✕
                    </button>
                  </div>
                  <CounselorAwayNote
                    isOpen={isApplicationOpen(application.status)}
                    signedInToday={application.counselorSignedInToday}
                    quietWorkingDays={application.counselorQuietWorkingDays}
                  />
                </>
              ) : (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      handleAssignApplication(application.id, application.kind, e.target.value)
                  }}
                >
                  <option value="">{t('visits', 'chooseCounselor')}</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {localizedName(c.name, c.nameAr, language)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : application.counselorId ? (
            <>
              {counselorDisplayName(application, language, t('visits', 'unknownCounselor'))}
              <CounselorAwayNote
                isOpen={isApplicationOpen(application.status)}
                signedInToday={application.counselorSignedInToday}
                quietWorkingDays={application.counselorQuietWorkingDays}
              />
            </>
          ) : (
            t('visits', 'unassigned')
          )}
        </td>
        <td data-label={t('visits', 'timeline')}>
          <div className="mini-timeline">
            <div className="mini-timeline-step done">
              <span className="mini-timeline-dot" />
              <span className="mini-timeline-label">{t('visits', 'timelineSubmitted')}</span>
              <span className="mini-timeline-when">
                {formatTimelineWhen(application.createdAt, language)}
              </span>
            </div>
            <div className={`mini-timeline-step ${application.acceptedAt ? 'done' : 'pending'}`}>
              <span className="mini-timeline-dot" />
              <span className="mini-timeline-label">{t('visits', 'timelinePickedUp')}</span>
              <span className="mini-timeline-when">
                {application.acceptedAt
                  ? formatTimelineWhen(application.acceptedAt, language)
                  : t('visits', 'timelineNotYet')}
              </span>
            </div>
            <div className={`mini-timeline-step ${application.closedAt ? 'done' : 'pending'}`}>
              <span className="mini-timeline-dot" />
              <span className="mini-timeline-label">{t('visits', 'timelineClosed')}</span>
              <span className="mini-timeline-when">
                {application.closedAt
                  ? formatTimelineWhen(application.closedAt, language)
                  : t('visits', 'timelineNotYet')}
              </span>
            </div>
          </div>
        </td>
        {role === 'super_admin' && (
          <td className="cell-actions">
            <button
              type="button"
              className="action-danger"
              onClick={() => requestDelete(application.id, application.name, 'application')}
            >
              {t('visits', 'delete')}
            </button>
          </td>
        )}
      </tr>
    )
  }

  function formatDay(dateInput: string): string {
    const parsed = new Date(`${dateInput}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime())
      ? dateInput
      : parsed.toLocaleDateString(language, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  }

  const countSummary = activeSearch
    ? t('visits', 'searchMatches')
        .replace('{count}', String(pageSlice.total))
        .replace('{term}', activeSearch)
    : t('visits', 'showingRangeScope')
        .replace('{from}', String(pageSlice.from))
        .replace('{to}', String(pageSlice.to))
        .replace('{total}', String(pageSlice.total))
        .replace('{period}', `${formatDay(range.from)} – ${formatDay(range.to)}`)
        .replace('{all}', allTimeTotal === null ? '…' : String(allTimeTotal))

  function applyPreset(nextPreset: DateRangePreset) {
    setPreset(nextPreset)
    setManualRange(null)
  }

  function runSearch(term: string) {
    setSearchInput(term)
    setActiveSearch(term.trim())
  }

  // التركيز يروح لـ"إلغاء" مو "حذف": Enter بالعادة ما لازم يحذف سجل عميل
  const deleteCancelRef = useRef<HTMLButtonElement>(null)
  const deleteDialog = useDialog({
    open: !!pendingDelete,
    onClose: closeDeleteModal,
    initialFocusRef: deleteCancelRef,
  })

  return (
    <div className="accounts-panel">
      <h3>{t('visits', 'title')}</h3>
      {focusId && (
        <div className="focus-banner">
          <span>
            {shownRows.length ? t('visits', 'focusShowing') : t('visits', 'focusMissing')}
          </span>
          <a href="/admin/visits">{t('visits', 'focusShowAll')}</a>
        </div>
      )}
      {waitingFilter && !focusId && (
        <div className="focus-banner">
          <span>{t('visits', 'showingFromNotifications')}</span>
          <a href="/admin/visits">{t('visits', 'focusShowAll')}</a>
        </div>
      )}
      {counselorFilterId && !focusId && (
        <div className="focus-banner">
          <span>
            {counselorFilterId === UNASSIGNED_COUNSELOR_ID
              ? t('visits', 'showingUnassignedVisits')
              : t('visits', 'counselorFilterShowing').replace(
                  '{name}',
                  counselorFilterName ?? t('visits', 'unknownCounselor')
                )}
          </span>
          <a href="/admin/visits">{t('visits', 'focusShowAll')}</a>
        </div>
      )}
      <div className="visits-filter-row">
        <label>
          {t('admin', 'rangePresetLabel')}
          <select
            value={manualRange ? '' : preset}
            disabled={Boolean(activeSearch)}
            onChange={(e) => applyPreset(e.target.value as DateRangePreset)}
          >
            {manualRange && <option value="">{t('admin', 'rangePresetLabel')}</option>}
            {DATE_RANGE_PRESETS.map((option) => (
              <option key={option} value={option}>
                {t('admin', presetLabelKey(option))}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('admin', 'dateFrom')}
          <input
            type="date"
            value={range.from}
            disabled={Boolean(activeSearch)}
            onChange={(e) => setManualRange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          {t('admin', 'dateTo')}
          <input
            type="date"
            value={range.to}
            disabled={Boolean(activeSearch)}
            onChange={(e) => setManualRange({ ...range, to: e.target.value })}
          />
        </label>
        <label className="visits-search">
          {t('visits', 'searchLabel')}
          <span className="visits-search-box">
            <input
              type="text"
              value={searchInput}
              placeholder={t('visits', 'searchPlaceholder')}
              onChange={(e) => runSearch(e.target.value)}
            />
            {activeSearch && (
              <button
                type="button"
                aria-label={t('visits', 'searchClear')}
                onClick={() => runSearch('')}
              >
                ✕
              </button>
            )}
          </span>
        </label>
      </div>
      <div className="sort-row sort-row-mobile">
        <label>
          {t('visits', 'sortBy')}
          <select
            value={sortField}
            onChange={(e) => {
              setSortField(e.target.value as SortField)
              paging.resetToFirstPage()
            }}
          >
            <option value="date">{t('visits', 'sortDate')}</option>
            <option value="name">{t('visits', 'sortName')}</option>
            <option value="status">{t('visits', 'sortStatus')}</option>
          </select>
        </label>
        <button
          type="button"
          className="dir-btn"
          onClick={() => {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
            paging.resetToFirstPage()
          }}
        >
          <span className="arrow">{sortDir === 'desc' ? '↓' : '↑'}</span>
        </button>
      </div>
      <TablePagingBar
        slice={pageSlice}
        pageSize={paging.pageSize}
        onPageSizeChange={paging.setPageSize}
        summary={countSummary}
      />
      {/* السقف قطع النتائج: نقولها بدل ما نخلي الموظفة تستنتج إن العميل مو موجود */}
      {(visitsTruncated || applicationsTruncated) && (
        <p className="visits-search-truncated" role="status">
          {t('visits', 'searchTruncated').replace('{count}', String(NAME_SEARCH_LIMIT))}
        </p>
      )}
      <TopScrollWrap>
        <table className="accounts-table visits-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="th-sortable" onClick={() => handleSort('name')}>
                  {t('visits', 'name')} {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>{t('visits', 'phone')}</th>
              <th>{t('visits', 'type')}</th>
              <th>
                <button type="button" className="th-sortable" onClick={() => handleSort('status')}>
                  {t('visits', 'status')}{' '}
                  {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>{t('visits', 'studentStatus')}</th>
              <th>{t('visits', 'counselor')}</th>
              <th>
                <button type="button" className="th-sortable" onClick={() => handleSort('date')}>
                  {t('visits', 'timeline')}{' '}
                  {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              {role === 'super_admin' && <th>{t('visits', 'delete')}</th>}
            </tr>
          </thead>
          <tbody>
            {pageSlice.rows.map((row) =>
              row.rowKind === 'visit' ? renderVisitRow(row.data) : renderApplicationRow(row.data)
            )}
          </tbody>
        </table>
      </TopScrollWrap>

      {activeSearch && pageSlice.total === 0 && (
        <p className="visits-search-empty">
          {t('visits', 'searchNoMatch').replace('{term}', activeSearch)}
          <span>{t('visits', 'searchPhoneHint')}</span>
        </p>
      )}
      <TablePager slice={pageSlice} onPage={paging.setPage} />

      {pendingDelete && (
        <div className="confirm-modal">
          <div className="confirm-modal-card" {...deleteDialog.dialogProps}>
            <div className="confirm-modal-icon">!</div>
            <p className="confirm-modal-title" id={deleteDialog.titleId}>
              {t('visits', 'confirmDeleteTitle')} &quot;{pendingDelete.name}&quot;?
            </p>
            {deleteError ? (
              <p className="confirm-modal-error">{deleteError}</p>
            ) : (
              <p className="confirm-modal-sub">{t('visits', 'confirmDeleteVisit')}</p>
            )}
            <div className="confirm-modal-actions">
              <button type="button" ref={deleteCancelRef} onClick={closeDeleteModal}>
                {deleteError ? t('visits', 'close') : t('visits', 'cancel')}
              </button>
              {!deleteError && (
                <button
                  type="button"
                  className="confirm-modal-danger"
                  onClick={handleConfirmDelete}
                >
                  {t('visits', 'delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
