'use client'
import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  UsersThree,
  CheckCircle,
  Clock,
  ArrowRight,
  CalendarBlank,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useDemo } from './DemoProvider'
import { PEOPLE } from './fixtures'
import {
  PageHeading,
  ExportButton,
  PersonName,
  Status,
  TextLink,
  countryName,
  exportRows,
} from './ui'
import { RegisterButton } from './DemoShell'
import type { DemoVisit } from './types'

function weekBuckets(visits: DemoVisit[], now: number, language: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - 6 + i)
    return {
      label: date.toLocaleDateString(language === 'ar' ? 'ar' : 'en', { weekday: 'short' }),
      value: visits.filter(
        (v) => v.createdAt >= date.getTime() && v.createdAt < date.getTime() + 86400000
      ).length,
    }
  })
}
function VolumeChart({ visits }: { visits: DemoVisit[] }) {
  const { now, language, tr } = useDemo()
  const buckets = weekBuckets(visits, now, language)
  const max = Math.max(4, ...buckets.map((b) => b.value))
  const y = (value: number) => 160 - (value / max) * 126
  const points = buckets.map((b, i) => `${36 + i * 80},${y(b.value)}`)
  return (
    <div className="volume-chart">
      <svg
        viewBox="0 0 552 202"
        role="img"
        aria-label={tr(
          `Visits over seven days: ${buckets.map((b) => `${b.label} ${b.value}`).join(', ')}`,
          `الزيارات خلال سبعة أيام: ${buckets.map((b) => `${b.label} ${b.value}`).join('، ')}`
        )}
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="36"
              x2="516"
              y1={34 + i * 42}
              y2={34 + i * 42}
              stroke="var(--line)"
              strokeDasharray="3 5"
            />
            <text x="12" y={38 + i * 42}>
              {Math.round(max * (1 - i / 3))}
            </text>
          </g>
        ))}
        <path d={`M${points.join(' L')} L516,160 L36,160 Z`} fill="var(--accent-soft)" />
        <path
          d={`M${points.join(' L')}`}
          stroke="var(--accent)"
          strokeWidth="3"
          fill="none"
          strokeLinejoin="round"
        />
        {buckets.map((b, i) => (
          <g key={b.label}>
            <circle
              cx={36 + i * 80}
              cy={y(b.value)}
              r="4.5"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="2"
            >
              <title>
                {b.label}: {b.value}
              </title>
            </circle>
            <text x={36 + i * 80} y="190" textAnchor="middle">
              {b.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
export function Overview() {
  const { data, now, tr, language, role } = useDemo()
  const [range, setRange] = useState('week')
  const start = useMemo(() => {
    const date = new Date(now)
    date.setHours(0, 0, 0, 0)
    if (range !== 'today') date.setDate(date.getDate() - (range === 'week' ? 6 : 29))
    return date.getTime()
  }, [now, range])
  const visits = data.visits.filter((v) => v.createdAt >= start)
  const completed = visits.filter((v) => v.state === 'closed')
  const waiting = visits.filter((v) => v.state === 'waiting')
  const timed = visits.filter((v) => v.startedAt && v.finishedAt)
  const average = timed.length
    ? Math.round(
        timed.reduce((sum, v) => sum + (v.finishedAt! - v.startedAt!), 0) / timed.length / 60000
      )
    : 0
  const metrics = [
    {
      en: 'Total visits',
      ar: 'إجمالي الزيارات',
      value: visits.length,
      note: tr(
        `${visits.filter((v) => v.kind === 'new').length} first-time visits`,
        `${visits.filter((v) => v.kind === 'new').length} زيارة أولى`
      ),
      icon: UsersThree,
    },
    {
      en: 'Completed',
      ar: 'مكتملة',
      value: completed.length,
      note: tr(
        `${Math.round((completed.length / Math.max(1, visits.length)) * 100)}% of selected visits`,
        `${Math.round((completed.length / Math.max(1, visits.length)) * 100)}٪ من الزيارات المحددة`
      ),
      icon: CheckCircle,
    },
    {
      en: 'Waiting now',
      ar: 'في الانتظار الآن',
      value: waiting.length,
      note: tr('Ready for a counselor', 'جاهز لمقابلة مستشار'),
      icon: Clock,
    },
    {
      en: 'Avg. session',
      ar: 'متوسط الجلسة',
      value: average,
      note: tr('Minutes per completed session', 'دقائق لكل جلسة منتهية'),
      icon: CalendarBlank,
    },
  ]
  async function exportReport() {
    await exportRows(
      'waypoint-demo-report',
      ['Demo student', 'Visit type', 'Country', 'Status'],
      visits.map((v) => [PEOPLE.find((p) => p.id === v.personId)!.name, v.kind, v.country, v.state])
    )
  }
  return (
    <>
      <PageHeading
        title={tr('Every student. A clear next step.', 'لكل طالب، خطوة تالية واضحة.')}
        description={tr(
          'Your workspace at a glance. Keep the day moving forward.',
          'مساحة عملك في لمحة. تابع سير اليوم بكل وضوح.'
        )}
        actions={
          <>
            <ExportButton onClick={exportReport} />
            {role === 'super_admin' && <RegisterButton />}
          </>
        }
      />
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">{tr('THE WAYPOINT WORKSPACE', 'مساحة وايبوينت')}</span>
          <h2>
            {tr('From first hello', 'من اللقاء الأول')}
            <br />
            {tr('to what comes next.', 'إلى الخطوة التالية.')}
          </h2>
          <p>
            {tr(
              'Bring visits, applications, and your team into one clear view.',
              'اجمع الزيارات والطلبات والفريق في مساحة واحدة واضحة.'
            )}
          </p>
          <Link href="/apply">
            {tr('Try the student experience', 'جرّب تجربة الطالب')}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div
          className="journey-visual"
          aria-label={tr(
            'Student journey: register, connect, progress',
            'رحلة الطالب: التسجيل، التواصل، التقدم'
          )}
        >
          <div className="journey-line" />
          <div className="journey-step">
            <span>01</span>
            <strong>{tr('Register', 'التسجيل')}</strong>
            <small>{tr('A first conversation', 'المحادثة الأولى')}</small>
          </div>
          <div className="journey-step">
            <span>02</span>
            <strong>{tr('Connect', 'التواصل')}</strong>
            <small>{tr('The right counselor', 'المستشار المناسب')}</small>
          </div>
          <div className="journey-step">
            <span>03</span>
            <strong>{tr('Move forward', 'التقدم')}</strong>
            <small>{tr('A clear next step', 'خطوة تالية واضحة')}</small>
          </div>
        </div>
      </section>
      <div className="section-toolbar">
        <h2>{tr('Workspace overview', 'نظرة عامة على العمل')}</h2>
        <div
          className="range-switch"
          aria-label={tr('Report date range', 'الفترة الزمنية للتقرير')}
        >
          {[
            ['today', 'Today', 'اليوم'],
            ['week', '7 days', '٧ أيام'],
            ['month', '30 days', '٣٠ يوماً'],
          ].map(([value, en, ar]) => (
            <button
              key={value}
              className={range === value ? 'selected' : ''}
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {tr(en, ar)}
            </button>
          ))}
        </div>
      </div>
      <section className="metrics-grid" aria-label={tr('Key metrics', 'المؤشرات الرئيسية')}>
        {metrics.map(({ en, ar, value, note, icon: Icon }, i) => (
          <article className="metric" key={en}>
            <div className="metric-label">
              {tr(en, ar)}
              <Icon size={19} />
            </div>
            <div className="metric-value">
              {value}
              {i === 3 && <span>{tr('min', 'د')}</span>}
            </div>
            <p>
              <span className={i === 1 ? 'positive' : ''}>{note}</span>
            </p>
          </article>
        ))}
      </section>
      <div className="overview-grid">
        <section className="panel volume-panel">
          <div className="panel-heading">
            <div>
              <h2>{tr('Visit activity', 'نشاط الزيارات')}</h2>
              <p>{tr('A view of the last seven days', 'عرض آخر سبعة أيام')}</p>
            </div>
            <span className="chart-legend">
              <i />
              {tr('Visits', 'الزيارات')}
            </span>
          </div>
          <VolumeChart visits={data.visits} />
        </section>
        <section className="panel counselor-summary">
          <div className="panel-heading">
            <div>
              <h2>{tr('Your team, today', 'فريقك اليوم')}</h2>
              <p>{tr('A little clarity for a busy day', 'وضوح أكبر ليوم حافل')}</p>
            </div>
            <TextLink href="/admin/supervision">{tr('View team', 'عرض الفريق')}</TextLink>
          </div>
          <div className="team-summary-list">
            {data.team
              .filter((m) => m.role === 'counselor' && m.active)
              .slice(0, 4)
              .map((member, i) => {
                const current = data.visits.some(
                  (v) => v.counselorId === member.id && v.state === 'in_session'
                )
                const count = data.visits.filter(
                  (v) => v.counselorId === member.id && v.state === 'waiting'
                ).length
                return (
                  <div key={member.id} className="team-summary-row">
                    <span className={`avatar avatar-${i}`}>
                      {member.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </span>
                    <span>
                      <strong>{language === 'ar' ? member.nameAr : member.name}</strong>
                      <small>
                        {member.onBreak
                          ? tr('On a break', 'في استراحة')
                          : current
                            ? tr('With a student', 'مع طالب')
                            : tr('Available', 'متاح')}
                      </small>
                    </span>
                    <span className="queue-count">
                      {count}
                      <small>{tr('waiting', 'ينتظر')}</small>
                    </span>
                  </div>
                )
              })}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{tr('Recent student visits', 'آخر زيارات الطلاب')}</h2>
            <p>
              {tr('The latest conversations in your workspace', 'آخر المحادثات في مساحة العمل')}
            </p>
          </div>
          <TextLink href="/admin/visits">{tr('All visits', 'كل الزيارات')}</TextLink>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tr('Student', 'الطالب')}</th>
                <th>{tr('Destination', 'الوجهة')}</th>
                <th>{tr('Counselor', 'المستشار')}</th>
                <th>{tr('Status', 'الحالة')}</th>
                <th>
                  <span className="sr-only">{tr('Details', 'التفاصيل')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visits.slice(0, 5).map((visit) => {
                const counselor = data.team.find((m) => m.id === visit.counselorId)
                return (
                  <tr key={visit.id}>
                    <td>
                      <PersonName id={visit.personId} />
                    </td>
                    <td>{countryName(visit.country, language)}</td>
                    <td>
                      {counselor
                        ? language === 'ar'
                          ? counselor.nameAr
                          : counselor.name
                        : tr('Unassigned', 'غير معين')}
                    </td>
                    <td>
                      <Status state={visit.state} />
                    </td>
                    <td>
                      <Link
                        href={`/admin/visits?visit=${visit.id}`}
                        className="icon-button"
                        aria-label={tr('View visit details', 'عرض تفاصيل الزيارة')}
                      >
                        <ArrowRight size={17} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!visits.length && (
            <p className="inline-empty">
              {tr('No visits in this date range.', 'لا توجد زيارات في هذه الفترة.')}
            </p>
          )}
        </div>
      </section>
    </>
  )
}
