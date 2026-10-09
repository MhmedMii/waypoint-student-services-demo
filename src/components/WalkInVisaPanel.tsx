'use client'
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { localizedName } from '../i18n/localizedName'
import { CounselorAwayNote } from './CounselorAwayNote'
import { VisitDetailModal, type VisitDetailRow } from './VisitDetailModal'
import { TablePagingBar, TablePager } from './TablePaging'
import { useTablePaging } from '../hooks/useTablePaging'
import { matchesClientSearch } from '../domain/text/matchesClientSearch'
import { KUWAIT_TIME_ZONE } from '../domain/time/kuwaitTime'

const STUDENT_STATUS_PILL_CLASS: Record<string, string> = {
  waiting: 'watch',
  in_session: 'on-track',
  follow_up_needed: 'inactive',
  closed: 'on-track',
}
const STUDENT_STATUS_LABEL_KEY: Record<
  string,
  'statusWaiting' | 'statusInSession' | 'statusFollowUpNeeded' | 'statusClosed'
> = {
  waiting: 'statusWaiting',
  in_session: 'statusInSession',
  follow_up_needed: 'statusFollowUpNeeded',
  closed: 'statusClosed',
}

interface CounselorOption {
  id: string
  name: string
  nameAr: string | null
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

async function fetchActiveCounselors(): Promise<CounselorOption[]> {
  const response = await fetch('/api/counselors/active')
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

async function fetchWalkInVisaVisits(): Promise<VisitDetailRow[]> {
  const response = await fetch('/api/visits/type/visa')
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export function WalkInVisaPanel({ role }: { role: 'admin' | 'super_admin' | 'counselor' }) {
  const { t, language } = useLanguage()
  const [visits, setVisits] = useState<VisitDetailRow[]>([])
  const [counselors, setCounselors] = useState<CounselorOption[]>([])
  const [viewingVisitFor, setViewingVisitFor] = useState<string | null>(null)
  // جدول مستقل بصفحته الخاصة — عدّاده ما يختلط مع جدول طلبات التأشيرة فوقه
  const [search, setSearch] = useState('')
  const shownVisits = visits.filter((visit) =>
    matchesClientSearch([visit.name, visit.phone], search)
  )
  const paging = useTablePaging(shownVisits, 'walk-in-visa-page-size')

  useEffect(() => {
    void refresh()
    fetchActiveCounselors().then(setCounselors)
  }, [])

  async function refresh() {
    setVisits(await fetchWalkInVisaVisits())
  }

  // نفس نقطة النهاية اللي تستخدمها صفحة الزيارات — مسار واحد للتعيين، عشان
  // التعيين من هنا ومن هناك يسوّي نفس الشي بالضبط
  async function assign(visitId: string, counselorId: string | null) {
    await fetch('/api/admin/reassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId, counselorId }),
    })
    await refresh()
  }

  // الاسم يجي مع الصف من السيرفر — ما نعتمد على قائمة "النشطين" اللي تستثني
  // اللي خارج دوامه، وما نعرض المعرّف الخام أبدًا
  function counselorLabel(visit: VisitDetailRow): string {
    return visit.counselorName
      ? localizedName(visit.counselorName, visit.counselorNameAr ?? null, language)
      : t('visits', 'unassigned')
  }

  if (visits.length === 0) return null

  return (
    <div className="accounts-panel">
      <h3>{t('applications', 'walkInVisaTitle')}</h3>
      <div className="visits-filter-row">
        <label className="visits-search">
          {t('applications', 'searchLabel')}
          <span className="visits-search-box">
            <input
              type="text"
              value={search}
              placeholder={t('visits', 'searchPlaceholder')}
              onChange={(e) => {
                setSearch(e.target.value)
                paging.resetToFirstPage()
              }}
            />
            {search && (
              <button
                type="button"
                aria-label={t('applications', 'searchClear')}
                onClick={() => {
                  setSearch('')
                  paging.resetToFirstPage()
                }}
              >
                ✕
              </button>
            )}
          </span>
        </label>
      </div>
      <TablePagingBar
        slice={paging.slice}
        pageSize={paging.pageSize}
        onPageSizeChange={paging.setPageSize}
        summary={
          search.trim()
            ? t('applications', 'searchMatches')
                .replace('{count}', String(paging.slice.total))
                .replace('{total}', String(visits.length))
                .replace('{term}', search.trim())
            : undefined
        }
      />
      <div className="table-wrap">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>{t('visits', 'name')}</th>
              <th>{t('visits', 'phone')}</th>
              <th>{t('visits', 'status')}</th>
              <th>{t('visits', 'studentStatus')}</th>
              <th>{t('visits', 'counselor')}</th>
              <th>{t('visits', 'timeline')}</th>
            </tr>
          </thead>
          <tbody>
            {paging.slice.rows.map((visit) => (
              <tr
                key={visit.id}
                className="app-row-clickable"
                onClick={() => setViewingVisitFor(visit.id)}
              >
                <td data-label={t('visits', 'name')}>
                  {/* نفس نمط جدول الطلبات: زر على الاسم، والصف يظل صف */}
                  <button
                    type="button"
                    className="row-open-button"
                    aria-haspopup="dialog"
                    onClick={(e) => {
                      e.stopPropagation()
                      setViewingVisitFor(visit.id)
                    }}
                  >
                    {visit.name}
                  </button>
                </td>
                <td data-label={t('visits', 'phone')}>{visit.phone}</td>
                <td data-label={t('visits', 'status')}>
                  <span className={`pill ${visit.status === 'closed' ? 'on-track' : 'watch'}`}>
                    {t('visits', visit.status === 'closed' ? 'statusClosed' : 'statusOpen')}
                  </span>
                </td>
                <td data-label={t('visits', 'studentStatus')}>
                  {visit.studentStatus ? (
                    <span className={`pill ${STUDENT_STATUS_PILL_CLASS[visit.studentStatus]}`}>
                      {t('students', STUDENT_STATUS_LABEL_KEY[visit.studentStatus])}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td
                  data-label={t('visits', 'counselor')}
                  onClick={(event) => event.stopPropagation()}
                >
                  {role === 'super_admin' ? (
                    <div className="counselor-cell">
                      {visit.counselorId ? (
                        <>
                          <div className="counselor-line">
                            <span className="counselor-name">{counselorLabel(visit)}</span>
                            <button
                              type="button"
                              className="unassign-x"
                              title={t('visits', 'unassign')}
                              aria-label={t('visits', 'unassignNamed').replace(
                                '{name}',
                                counselorLabel(visit)
                              )}
                              onClick={() => assign(visit.id, null)}
                            >
                              ✕
                            </button>
                          </div>
                          <CounselorAwayNote
                            isOpen={visit.status === 'next'}
                            signedInToday={visit.counselorSignedInToday ?? null}
                            quietWorkingDays={visit.counselorQuietWorkingDays ?? null}
                          />
                        </>
                      ) : (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) assign(visit.id, e.target.value)
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
                      {counselorLabel(visit)}
                      <CounselorAwayNote
                        isOpen={visit.status === 'next'}
                        signedInToday={visit.counselorSignedInToday ?? null}
                        quietWorkingDays={visit.counselorQuietWorkingDays ?? null}
                      />
                    </>
                  ) : (
                    // المستشار ما يقدر يعيّن، بس "غير معيّن" أوضح من خانة فاضية
                    <span className="dim">{t('visits', 'unassigned')}</span>
                  )}
                </td>
                <td data-label={t('visits', 'timeline')}>
                  <div className="mini-timeline">
                    <div className="mini-timeline-step done">
                      <span className="mini-timeline-dot" />
                      <span className="mini-timeline-label">
                        {t('visits', 'timelineSubmitted')}
                      </span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {search.trim() && paging.slice.total === 0 && (
        <p className="visits-search-empty">
          {t('applications', 'searchNoMatch').replace('{term}', search.trim())}
        </p>
      )}
      <TablePager slice={paging.slice} onPage={paging.setPage} />

      {viewingVisitFor &&
        (() => {
          const visit = visits.find((v) => v.id === viewingVisitFor)
          if (!visit) return null
          return <VisitDetailModal visit={visit} onClose={() => setViewingVisitFor(null)} />
        })()}
    </div>
  )
}
