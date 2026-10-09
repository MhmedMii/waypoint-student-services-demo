'use client'
import { useState } from 'react'
import { Plus, Clock, UsersThree, ClipboardText, Coffee, CheckCircle } from '@phosphor-icons/react'
import { useDemo } from './DemoProvider'
import { PEOPLE } from './fixtures'
import { PageHeading, Empty, elapsed, PersonName, exportRows, ExportButton, Pager } from './ui'

export function Accounts() {
  const { data, dispatch, role, tr, language } = useDemo()
  if (role !== 'super_admin')
    return (
      <Empty title={tr('Explore accounts in the owner demo', 'استكشف الحسابات في عرض المالك')}>
        <p>
          {tr(
            'Choose Owner demo in the toolbar to manage fictional accounts.',
            'اختر عرض المالك من شريط الأدوات لإدارة الحسابات الوهمية.'
          )}
        </p>
      </Empty>
    )
  const roleName = (value: string) =>
    value === 'super_admin'
      ? tr('Workspace owner', 'مالك المساحة')
      : value === 'admin'
        ? tr('Administrator', 'مدير')
        : tr('Counselor', 'مستشار')
  return (
    <>
      <PageHeading
        title={tr('A team with a shared direction.', 'فريق يتشارك الوجهة.')}
        description={tr(
          'Explore fictional accounts and role-based access. No invitations or emails are sent.',
          'استكشف الحسابات الوهمية والصلاحيات. لا يتم إرسال دعوات أو رسائل بريد.'
        )}
        actions={
          <button
            className="button"
            disabled={data.team.length >= 12}
            onClick={() => dispatch({ type: 'add-account', now: Date.now() })}
          >
            <Plus size={18} />
            {tr('Add demo counselor', 'إضافة مستشار تجريبي')}
          </button>
        }
      />
      <section className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tr('Team member', 'عضو الفريق')}</th>
                <th>{tr('Demo email', 'البريد التجريبي')}</th>
                <th>{tr('Role', 'الدور')}</th>
                <th>{tr('Account', 'الحساب')}</th>
                <th>{tr('Action', 'الإجراء')}</th>
              </tr>
            </thead>
            <tbody>
              {data.team.map((m, i) => {
                const serving = data.visits.some(
                  (v) => v.counselorId === m.id && v.state === 'in_session'
                )
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="person-cell">
                        <span className={`avatar avatar-${i % 4}`}>
                          {m.name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <span>
                          <strong>{language === 'ar' ? m.nameAr : m.name}</strong>
                          <small>{tr('Fictional account', 'حساب وهمي')}</small>
                        </span>
                      </span>
                    </td>
                    <td className="mono-text">{m.email}</td>
                    <td>{roleName(m.role)}</td>
                    <td>
                      <span className={`availability ${!m.active ? 'inactive' : ''}`}>
                        {m.active ? tr('Active', 'نشط') : tr('Inactive', 'غير نشط')}
                      </span>
                    </td>
                    <td>
                      {m.role === 'super_admin' ? (
                        <span className="muted-text">{tr('Demo owner', 'مالك تجريبي')}</span>
                      ) : (
                        <button
                          className="table-action"
                          disabled={serving}
                          title={
                            serving
                              ? tr('Finish the active session first', 'أنهِ الجلسة النشطة أولاً')
                              : undefined
                          }
                          onClick={() => dispatch({ type: 'account', id: m.id, now: Date.now() })}
                        >
                          {m.active ? tr('Deactivate', 'تعطيل') : tr('Activate', 'تفعيل')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          {tr(
            'All accounts use fictional identities and example.com addresses.',
            'جميع الحسابات بهويات وهمية وعناوين example.com.'
          )}
        </div>
      </section>
    </>
  )
}
export function TeamOverview() {
  const { data, now, tr, language } = useDemo()
  return (
    <>
      <PageHeading
        title={tr('Keep your team in view.', 'فريقك في الصورة.')}
        description={tr(
          'A simulated view of availability, queues, and completed sessions.',
          'عرض محاكى للتوفر وقوائم الانتظار والجلسات المنتهية.'
        )}
      />
      <div className="team-grid">
        {data.team
          .filter((m) => m.role === 'counselor')
          .map((m, i) => {
            const assigned = data.visits.filter((v) => v.counselorId === m.id)
            const current = assigned.find((v) => v.state === 'in_session')
            const waiting = assigned.filter((v) => v.state === 'waiting').length
            const day = new Date(now)
            day.setHours(0, 0, 0, 0)
            return (
              <article className="panel member-panel" key={m.id}>
                <div className="member-heading">
                  <span className={`avatar avatar-${i % 4}`}>
                    {m.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div>
                    <h2>{language === 'ar' ? m.nameAr : m.name}</h2>
                    <p>{tr('Demo counselor', 'مستشار تجريبي')}</p>
                  </div>
                  <span
                    className={`availability ${current ? 'busy' : !m.active ? 'inactive' : ''}`}
                  >
                    {!m.active
                      ? tr('Inactive', 'غير نشط')
                      : m.onBreak
                        ? tr('On break', 'في استراحة')
                        : current
                          ? tr('In session', 'في جلسة')
                          : tr('Available', 'متاح')}
                  </span>
                </div>
                <div className="member-current">
                  {current ? (
                    <PersonName id={current.personId} />
                  ) : (
                    <>
                      <Coffee size={20} />
                      {m.onBreak
                        ? tr('Taking a break', 'في استراحة')
                        : tr('Ready for the next student', 'جاهز للطالب التالي')}
                    </>
                  )}
                </div>
                <div className="member-metrics">
                  <div>
                    <UsersThree size={18} />
                    <span>{tr('Waiting', 'ينتظر')}</span>
                    <strong>{waiting}</strong>
                  </div>
                  <div>
                    <CheckCircle size={18} />
                    <span>{tr('Done today', 'انتهى اليوم')}</span>
                    <strong>
                      {assigned.filter((v) => v.finishedAt && v.finishedAt >= day.getTime()).length}
                    </strong>
                  </div>
                  <div>
                    <Clock size={18} />
                    <span>{tr('Break time', 'وقت الاستراحة')}</span>
                    <strong>
                      {elapsed(
                        m.breakMs + (m.onBreak && m.breakStartedAt ? now - m.breakStartedAt : 0)
                      )}
                    </strong>
                  </div>
                </div>
              </article>
            )
          })}
      </div>
      <div className="note-box supervision-note">
        <ClipboardText size={23} />
        <div>
          <strong>
            {tr(
              'Demo activity, not live staff monitoring',
              'نشاط تجريبي وليس مراقبة فعلية للموظفين'
            )}
          </strong>
          <p>
            {tr(
              'Availability changes when you start a fictional session or take a break in the counselor desk.',
              'تتغير حالة التوفر عند بدء جلسة وهمية أو استراحة في مكتب المستشار.'
            )}
          </p>
        </div>
      </div>
    </>
  )
}
export function ActivityLog() {
  const { data, tr, language } = useDemo()
  const [page, setPage] = useState(1)
  const name = (id: string) => {
    const person = PEOPLE.find((p) => p.id === id)
    const member = data.team.find((m) => m.id === id)
    return language === 'ar'
      ? (person?.nameAr ?? member?.nameAr ?? id)
      : (person?.name ?? member?.name ?? id)
  }
  async function exportReport() {
    await exportRows(
      'waypoint-demo-activity',
      ['Demo event', 'Fictional subject', 'Demo timestamp'],
      data.events.map((e) => [e.action, name(e.subject), new Date(e.at).toISOString()])
    )
  }
  return (
    <>
      <PageHeading
        title={tr('The story of your workspace.', 'سجل مساحة عملك.')}
        description={tr(
          'A timeline of fictional visits, sessions, and application changes.',
          'تسلسل زمني للزيارات والجلسات وتغييرات الطلبات الوهمية.'
        )}
        actions={<ExportButton onClick={exportReport} />}
      />
      <section className="panel activity-panel">
        {data.events.slice((page - 1) * 10, page * 10).map((event) => (
          <article className="activity-item" key={event.id}>
            <span className="activity-icon">
              <ClipboardText size={19} />
            </span>
            <div>
              <h3>{language === 'ar' ? event.actionAr : event.action}</h3>
              <p>
                {name(event.subject)}
                <span> · </span>
                {tr('Fictional demo record', 'سجل تجريبي وهمي')}
              </p>
            </div>
            <time dateTime={new Date(event.at).toISOString()}>
              {new Date(event.at).toLocaleTimeString(language, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </article>
        ))}
        <Pager page={page} setPage={setPage} total={data.events.length} size={10} />
      </section>
    </>
  )
}
