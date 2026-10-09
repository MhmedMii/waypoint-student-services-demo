'use client'
import { useState } from 'react'
import {
  MagnifyingGlass,
  ArrowUpRight,
  FileText,
  DownloadSimple,
  CheckCircle,
  ArrowRight,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { canTransitionApplicationStatus } from '../domain/workflow/applicationStatusTransitions'
import { useDemo } from './DemoProvider'
import { PEOPLE, SERVICES_AR } from './fixtures'
import {
  Drawer,
  PageHeading,
  ExportButton,
  PersonName,
  Status,
  Pager,
  Empty,
  exportRows,
  STATE_LABELS,
  downloadDocument,
} from './ui'
import type { ApplicationState } from './types'

export function Applications({ kind }: { kind: 'visa' | 'exam' }) {
  const { data, dispatch, tr, language, role } = useDemo()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const applications = data.applications.filter(
    (a) =>
      a.kind === kind &&
      (role !== 'counselor' || a.counselorId === 'team-04') &&
      (filter === 'all' || a.status === filter) &&
      `${a.id} ${PEOPLE.find((p) => p.id === a.personId)!.name} ${PEOPLE.find((p) => p.id === a.personId)!.nameAr}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )
  const application = data.applications.find((a) => a.id === selected)
  const statuses = Object.keys(STATE_LABELS).filter((s) =>
    [
      'pending',
      'under_review',
      'documents_requested',
      'submitted_to_source',
      'approved',
      'rejected',
    ].includes(s)
  ) as ApplicationState[]
  const safePage = Math.min(page, Math.max(1, Math.ceil(applications.length / 8)))
  const serviceName = (service: string) =>
    language === 'ar' ? (SERVICES_AR[service] ?? service) : service
  async function exportReport() {
    await exportRows(
      `waypoint-demo-${kind}`,
      ['Demo application', 'Demo student', 'Service', 'Status', 'Simulated payment'],
      applications.map((a) => [
        a.id,
        PEOPLE.find((p) => p.id === a.personId)!.name,
        a.service,
        a.status,
        a.paid ? 'Simulated paid' : 'Not simulated',
      ])
    )
  }
  return (
    <>
      <PageHeading
        title={
          kind === 'visa'
            ? tr('A clear path to the next destination.', 'مسار واضح نحو الوجهة التالية.')
            : tr('Ready for the next milestone.', 'جاهز للإنجاز التالي.')
        }
        description={
          kind === 'visa'
            ? tr(
                'Track fictional visa applications from first submission to a decision.',
                'تابع طلبات التأشيرات الوهمية من التقديم إلى القرار.'
              )
            : tr(
                'Keep fictional IELTS and TOEFL bookings in one place.',
                'اجمع حجوزات آيلتس وتوفل الوهمية في مكان واحد.'
              )
        }
        actions={
          <>
            <ExportButton onClick={exportReport} />
            <Link href={`/apply?kind=${kind}`} className="button">
              {tr('Try an application', 'جرّب طلباً')}
              <ArrowUpRight size={17} />
            </Link>
          </>
        }
      />
      <div className="application-summary">
        <span>
          {tr('In progress', 'قيد التنفيذ')}
          <strong>
            {applications.filter((a) => !['approved', 'rejected'].includes(a.status)).length}
          </strong>
        </span>
        <span>
          {tr('Documents needed', 'مستندات مطلوبة')}
          <strong>{applications.filter((a) => a.status === 'documents_requested').length}</strong>
        </span>
        <span>
          {tr('Approved', 'مقبول')}
          <strong>{applications.filter((a) => a.status === 'approved').length}</strong>
        </span>
      </div>
      <section className="panel">
        <div className="filter-toolbar">
          <label className="search-field">
            <MagnifyingGlass size={18} />
            <span className="sr-only">{tr('Search applications', 'البحث عن طلبات')}</span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder={tr('Search student or application…', 'ابحث عن طالب أو طلب…')}
            />
          </label>
          <label>
            <span className="sr-only">{tr('Filter application status', 'تصفية حالة الطلب')}</span>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">{tr('All statuses', 'كل الحالات')}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {tr(...STATE_LABELS[status])}
                </option>
              ))}
            </select>
          </label>
          <span className="toolbar-note">
            {tr('Fictional applications only', 'طلبات وهمية فقط')}
          </span>
        </div>
        {applications.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tr('Student', 'الطالب')}</th>
                  <th>{tr('Service', 'الخدمة')}</th>
                  <th>{tr('Application', 'الطلب')}</th>
                  <th>{tr('Status', 'الحالة')}</th>
                  <th>{tr('Documents', 'المستندات')}</th>
                  <th>{tr('Details', 'التفاصيل')}</th>
                </tr>
              </thead>
              <tbody>
                {applications.slice((safePage - 1) * 8, safePage * 8).map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button className="person-button" onClick={() => setSelected(a.id)}>
                        <PersonName id={a.personId} />
                      </button>
                    </td>
                    <td>{serviceName(a.service)}</td>
                    <td>
                      <span className="mono-text">{a.id}</span>
                    </td>
                    <td>
                      <Status state={a.status} />
                    </td>
                    <td>
                      <span className="document-count">
                        <FileText size={16} />
                        {a.documents.length}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => setSelected(a.id)}
                        aria-label={tr(`Open ${a.id}`, `فتح ${a.id}`)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={tr('No matching applications', 'لا توجد طلبات مطابقة')}>
            <button
              className="button button-secondary"
              onClick={() => {
                setSearch('')
                setFilter('all')
              }}
            >
              {tr('Clear filters', 'مسح عوامل التصفية')}
            </button>
          </Empty>
        )}
        <Pager page={safePage} setPage={setPage} total={applications.length} />
      </section>
      {application && (
        <Drawer title={application.id} onClose={() => setSelected(null)}>
          <div className="drawer-person">
            <PersonName id={application.personId} />
            <Status state={application.status} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>{tr('Service', 'الخدمة')}</dt>
              <dd>{serviceName(application.service)}</dd>
            </div>
            <div>
              <dt>{tr('Submitted', 'تاريخ التقديم')}</dt>
              <dd>{new Date(application.createdAt).toLocaleDateString(language)}</dd>
            </div>
            <div>
              <dt>{tr('Demo email', 'بريد تجريبي')}</dt>
              <dd>{application.personId}@example.com</dd>
            </div>
          </dl>
          <h3 className="drawer-section-title">{tr('Sample documents', 'مستندات نموذجية')}</h3>
          <div className="sample-documents">
            {application.documents.map((doc) => (
              <button key={doc} onClick={() => downloadDocument(doc)}>
                <FileText size={21} />
                <span>
                  {language === 'ar' ? tr('مستند تجريبي وهمي', 'مستند تجريبي وهمي') : doc}
                  <small>
                    {tr(
                      'Generated text file · no personal data',
                      'ملف نصي مولّد · بدون بيانات شخصية'
                    )}
                  </small>
                </span>
                <DownloadSimple size={17} />
              </button>
            ))}
          </div>
          {role !== 'admin' && (
            <>
              <h3 className="drawer-section-title">
                {tr('Move the application forward', 'تقدم بالطلب')}
              </h3>
              <div className="status-actions">
                {statuses
                  .filter((next) => canTransitionApplicationStatus(application.status, next))
                  .map((next) => (
                    <button
                      className="button button-secondary"
                      key={next}
                      onClick={() =>
                        dispatch({
                          type: 'application-status',
                          id: application.id,
                          status: next,
                          now: Date.now(),
                        })
                      }
                    >
                      {tr(...STATE_LABELS[next])}
                      <ArrowRight size={16} />
                    </button>
                  ))}
                {['approved', 'rejected'].includes(application.status) && (
                  <p className="muted-text">
                    {tr(
                      'This fictional application has reached a final decision.',
                      'وصل هذا الطلب الوهمي إلى قرار نهائي.'
                    )}
                  </p>
                )}
              </div>
            </>
          )}
          <h3 className="drawer-section-title">{tr('Payment simulation', 'محاكاة الدفع')}</h3>
          <div className="note-box">
            <CheckCircle size={22} />
            <div>
              <strong>
                {application.paid
                  ? tr('Demo payment marked complete', 'تمت محاكاة الدفع')
                  : tr('No payment simulated yet', 'لم تتم محاكاة الدفع بعد')}
              </strong>
              <p>
                {tr(
                  'No charge is made. No payment provider is connected.',
                  'لا تتم أي عملية تحصيل. لا يوجد اتصال بمزود دفع.'
                )}
              </p>
            </div>
          </div>
          {!application.paid && role !== 'admin' && (
            <button
              className="button button-secondary button-wide"
              onClick={() => dispatch({ type: 'payment', id: application.id, now: Date.now() })}
            >
              {tr('Simulate payment', 'محاكاة الدفع')}
            </button>
          )}
          <Link href={`/apply/status/${application.id}`} className="text-link tracking-link">
            {tr('Open applicant tracking view', 'فتح واجهة متابعة الطالب')}
            <ArrowUpRight size={16} />
          </Link>
        </Drawer>
      )}
    </>
  )
}
