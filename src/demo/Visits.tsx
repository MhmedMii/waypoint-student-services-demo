'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MagnifyingGlass, ArrowUpRight, ClipboardText } from '@phosphor-icons/react'
import { useDemo } from './DemoProvider'
import { PEOPLE, COUNTRIES } from './fixtures'
import {
  Drawer,
  PageHeading,
  ExportButton,
  PersonName,
  Status,
  Pager,
  Empty,
  countryName,
  exportRows,
  elapsed,
} from './ui'
import { RegisterButton } from './DemoShell'

export function Visits({ personal = false }: { personal?: boolean }) {
  const { data, dispatch, tr, language, role } = useDemo()
  const params = useSearchParams()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [country, setCountry] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(params.get('visit'))
  const [counselorId, setCounselorId] = useState('team-01')
  const visits = data.visits.filter((v) => {
    const person = PEOPLE.find((p) => p.id === v.personId)!
    const name = `${person.name} ${person.nameAr}`.toLowerCase()
    return (
      (!personal || v.counselorId === counselorId) &&
      (filter === 'all' || v.state === filter) &&
      (country === 'all' || v.country === country) &&
      name.includes(search.toLowerCase())
    )
  })
  const visit = data.visits.find((v) => v.id === selected)
  const safePage = Math.min(page, Math.max(1, Math.ceil(visits.length / 8)))
  const memberName = (id: string | null) => {
    const member = data.team.find((m) => m.id === id)
    return member
      ? language === 'ar'
        ? member.nameAr
        : member.name
      : tr('Needs assignment', 'بحاجة إلى تعيين')
  }
  async function exportReport() {
    await exportRows(
      'waypoint-demo-visits',
      ['Demo student', 'Demo contact ID', 'Destination', 'Counselor', 'Status'],
      visits.map((v) => [
        PEOPLE.find((p) => p.id === v.personId)!.name,
        `DEMO-${v.personId.slice(-2)}`,
        v.country,
        memberName(v.counselorId),
        v.state,
      ])
    )
  }
  return (
    <>
      <PageHeading
        title={
          personal
            ? tr('A little closer to every student.', 'أقرب إلى كل طالب.')
            : tr('Student visits', 'زيارات الطلاب')
        }
        description={tr(
          'From a first visit to the next conversation. All identities below are fictional.',
          'من الزيارة الأولى إلى المحادثة التالية. جميع الهويات أدناه وهمية.'
        )}
        actions={
          <>
            <ExportButton onClick={exportReport} />
            {role === 'super_admin' && <RegisterButton />}
          </>
        }
      />
      <section className="panel">
        <div className="filter-toolbar">
          <label className="search-field">
            <MagnifyingGlass size={18} />
            <span className="sr-only">{tr('Search demo students', 'البحث عن طلاب تجريبيين')}</span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder={tr('Search students…', 'ابحث عن طالب…')}
            />
          </label>
          <label>
            <span className="sr-only">{tr('Filter status', 'تصفية الحالة')}</span>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">{tr('All statuses', 'كل الحالات')}</option>
              <option value="waiting">{tr('Waiting', 'في الانتظار')}</option>
              <option value="in_session">{tr('In session', 'في جلسة')}</option>
              <option value="follow_up_needed">{tr('Follow-up due', 'متابعة مطلوبة')}</option>
              <option value="closed">{tr('Completed', 'مكتمل')}</option>
            </select>
          </label>
          <label>
            <span className="sr-only">{tr('Filter destination', 'تصفية الوجهة')}</span>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">{tr('All destinations', 'كل الوجهات')}</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {countryName(c, language)}
                </option>
              ))}
            </select>
          </label>
          {personal && (
            <label>
              <span className="sr-only">{tr('Demo counselor', 'المستشار التجريبي')}</span>
              <select
                value={counselorId}
                onChange={(e) => {
                  setCounselorId(e.target.value)
                  setPage(1)
                }}
              >
                {data.team
                  .filter((m) => m.role === 'counselor')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {language === 'ar' ? m.nameAr : m.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        {visits.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tr('Student', 'الطالب')}</th>
                  <th>{tr('Visit type', 'نوع الزيارة')}</th>
                  <th>{tr('Destination', 'الوجهة')}</th>
                  <th>{tr('Counselor', 'المستشار')}</th>
                  <th>{tr('Status', 'الحالة')}</th>
                  <th>{tr('Details', 'التفاصيل')}</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice((safePage - 1) * 8, safePage * 8).map((v) => (
                  <tr key={v.id}>
                    <td>
                      <button className="person-button" onClick={() => setSelected(v.id)}>
                        <PersonName id={v.personId} />
                      </button>
                    </td>
                    <td>
                      {v.kind === 'new'
                        ? tr('First visit', 'زيارة أولى')
                        : v.kind === 'follow_up'
                          ? tr('Follow-up', 'متابعة')
                          : tr('Visa / services', 'تأشيرات / خدمات')}
                    </td>
                    <td>{countryName(v.country, language)}</td>
                    <td>{memberName(v.counselorId)}</td>
                    <td>
                      <Status state={v.state} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => setSelected(v.id)}
                        aria-label={tr(
                          `View ${PEOPLE.find((p) => p.id === v.personId)!.name}`,
                          'عرض الطالب'
                        )}
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
          <Empty title={tr('No matching visits', 'لا توجد زيارات مطابقة')}>
            <p>
              {tr(
                'Try a different student name, destination, or status.',
                'جرّب اسم طالب أو وجهة أو حالة أخرى.'
              )}
            </p>
            <button
              className="button button-secondary"
              onClick={() => {
                setSearch('')
                setFilter('all')
                setCountry('all')
              }}
            >
              {tr('Clear filters', 'مسح عوامل التصفية')}
            </button>
          </Empty>
        )}
        <Pager page={safePage} setPage={setPage} total={visits.length} />
      </section>
      {visit && (
        <Drawer title={tr('Visit details', 'تفاصيل الزيارة')} onClose={() => setSelected(null)}>
          <div className="drawer-person">
            <PersonName id={visit.personId} />
            <Status state={visit.state} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>{tr('Contact identifier', 'معرّف التواصل')}</dt>
              <dd>DEMO-{visit.personId.slice(-2)}</dd>
            </div>
            <div>
              <dt>{tr('Destination', 'الوجهة')}</dt>
              <dd>{countryName(visit.country, language)}</dd>
            </div>
            <div>
              <dt>{tr('Counselor', 'المستشار')}</dt>
              <dd>{memberName(visit.counselorId)}</dd>
            </div>
            <div>
              <dt>{tr('Registered', 'وقت التسجيل')}</dt>
              <dd>{new Date(visit.createdAt).toLocaleString(language)}</dd>
            </div>
            <div>
              <dt>{tr('Session duration', 'مدة الجلسة')}</dt>
              <dd>
                {visit.startedAt && visit.finishedAt
                  ? elapsed(visit.finishedAt - visit.startedAt)
                  : '—'}
              </dd>
            </div>
            {visit.dueAt && (
              <div>
                <dt>{tr('Follow-up date', 'تاريخ المتابعة')}</dt>
                <dd>{visit.dueAt}</dd>
              </div>
            )}
          </dl>
          <div className="note-box">
            <ClipboardText size={20} />
            <div>
              <strong>{tr('Session note', 'ملاحظة الجلسة')}</strong>
              <p>{visit.note || tr('No demo note added yet.', 'لم تتم إضافة ملاحظة تجريبية.')}</p>
            </div>
          </div>
          {role === 'super_admin' && visit.state !== 'in_session' && (
            <label className="field-label">
              {tr('Reassign counselor', 'تغيير المستشار')}
              <select
                value={visit.counselorId ?? ''}
                onChange={(e) =>
                  dispatch({
                    type: 'assign',
                    visitId: visit.id,
                    counselorId: e.target.value,
                    now: Date.now(),
                  })
                }
              >
                <option value="" disabled>
                  {tr('Select a counselor', 'اختر مستشاراً')}
                </option>
                {data.team
                  .filter((m) => m.active && m.role === 'counselor')
                  .map((m) => (
                    <option value={m.id} key={m.id}>
                      {language === 'ar' ? m.nameAr : m.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <p className="fictional-note">
            {tr(
              'Fictional identity. No phone number or personal record is stored.',
              'هوية وهمية. لا يتم تخزين رقم هاتف أو سجل شخصي.'
            )}
          </p>
        </Drawer>
      )}
    </>
  )
}
