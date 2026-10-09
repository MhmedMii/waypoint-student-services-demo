'use client'
import { useState } from 'react'
import {
  Play,
  Check,
  Coffee,
  ArrowRight,
  Clock,
  UsersThree,
  ClipboardText,
} from '@phosphor-icons/react'
import { useDemo } from './DemoProvider'
import { PageHeading, PersonName, elapsed, Empty, countryName } from './ui'

export function CounselorDesk() {
  const { data, dispatch, now, tr, language } = useDemo()
  const [counselorId, setCounselorId] = useState('team-01')
  const [outcome, setOutcome] = useState<'closed' | 'follow_up_needed'>('closed')
  const [note, setNote] = useState('')
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const counselor = data.team.find((m) => m.id === counselorId)!
  const assigned = data.visits.filter((v) => v.counselorId === counselorId)
  const current = assigned.find((v) => v.state === 'in_session')
  const waiting = assigned
    .filter((v) => v.state === 'waiting')
    .sort((a, b) => a.createdAt - b.createdAt)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const completed = assigned.filter((v) => v.finishedAt && v.finishedAt >= today.getTime()).length
  const breakMs =
    counselor.breakMs +
    (counselor.onBreak && counselor.breakStartedAt ? now - counselor.breakStartedAt : 0)
  const notes = [
    [
      tr(
        'Study options discussed. Ready for the next step.',
        'تمت مناقشة خيارات الدراسة. جاهز للخطوة التالية.'
      ),
      'Study options discussed. Ready for the next step.',
    ],
    [
      tr('Follow up on the fictional study plan.', 'متابعة خطة الدراسة الوهمية.'),
      'Follow up on the fictional study plan.',
    ],
  ]
  function finish() {
    dispatch({ type: 'finish', counselorId, state: outcome, note, dueAt, now: Date.now() })
    setNote('')
    setOutcome('closed')
  }
  return (
    <>
      <PageHeading
        title={tr('Make room for the next conversation.', 'مساحة للمحادثة التالية.')}
        description={tr(
          'A focused desk for your queue, sessions, and follow-ups.',
          'مكتب واضح لقائمة الانتظار والجلسات والمتابعات.'
        )}
        actions={
          <label className="field-label compact-field">
            {tr('Explore a demo counselor', 'استكشف مستشاراً تجريبياً')}
            <select value={counselorId} onChange={(e) => setCounselorId(e.target.value)}>
              {data.team
                .filter((m) => m.role === 'counselor' && m.active)
                .map((m) => (
                  <option value={m.id} key={m.id}>
                    {language === 'ar' ? m.nameAr : m.name}
                  </option>
                ))}
            </select>
          </label>
        }
      />
      <div className="desk-grid">
        <section className="panel session-panel">
          <div className="session-header">
            <span className="eyebrow">{tr('YOUR COUNSELOR DESK', 'مكتب المستشار')}</span>
            <span className={`availability ${current ? 'busy' : ''}`}>
              {counselor.onBreak
                ? tr('On a break', 'في استراحة')
                : current
                  ? tr('In session', 'في جلسة')
                  : tr('Available', 'متاح')}
            </span>
          </div>
          <div className="session-center">
            {current ? (
              <PersonName id={current.personId} />
            ) : (
              <span className="desk-icon">
                {counselor.onBreak ? <Coffee size={36} /> : <UsersThree size={36} />}
              </span>
            )}
            <h2>
              {current
                ? tr('A conversation in progress', 'محادثة جارية')
                : counselor.onBreak
                  ? tr('Take a little breathing room.', 'خذ وقتاً للاستراحة.')
                  : tr('Ready when you are.', 'جاهز عندما تكون مستعداً.')}
            </h2>
            <p>
              {current
                ? tr('Give this student your full attention.', 'امنح هذا الطالب كامل اهتمامك.')
                : tr(
                    'Start the next fictional visit when you’re ready.',
                    'ابدأ الزيارة الوهمية التالية عندما تكون مستعداً.'
                  )}
            </p>
            <div
              className="session-timer"
              aria-label={tr('Elapsed session time', 'وقت الجلسة المنقضي')}
            >
              {elapsed(
                current?.startedAt
                  ? now - current.startedAt
                  : counselor.onBreak && counselor.breakStartedAt
                    ? now - counselor.breakStartedAt
                    : 0
              )}
            </div>
            <span className="timer-caption">
              {current
                ? tr('Session time', 'وقت الجلسة')
                : counselor.onBreak
                  ? tr('Break time', 'وقت الاستراحة')
                  : tr('No session running', 'لا توجد جلسة جارية')}
            </span>
          </div>
          {current && (
            <div className="session-outcome">
              <label className="field-label">
                {tr('Session outcome', 'نتيجة الجلسة')}
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                >
                  <option value="closed">{tr('Completed', 'مكتملة')}</option>
                  <option value="follow_up_needed">
                    {tr('Follow-up needed', 'متابعة مطلوبة')}
                  </option>
                </select>
              </label>
              {outcome === 'follow_up_needed' && (
                <label className="field-label">
                  {tr('Follow-up date', 'تاريخ المتابعة')}
                  <input
                    type="date"
                    required
                    min={new Date(now).toISOString().slice(0, 10)}
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </label>
              )}
              <label className="field-label">
                {tr('Fictional session note', 'ملاحظة وهمية للجلسة')}
                <select value={note} onChange={(e) => setNote(e.target.value)}>
                  <option value="">{tr('No note', 'بدون ملاحظة')}</option>
                  {notes.map(([label, value]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="session-buttons">
            {current ? (
              <button
                className="button button-wide"
                disabled={outcome === 'follow_up_needed' && !dueAt}
                onClick={finish}
              >
                <Check size={20} />
                {tr('Finish session', 'إنهاء الجلسة')}
              </button>
            ) : (
              <button
                className="button button-wide"
                disabled={!waiting.length || counselor.onBreak || !counselor.active}
                onClick={() => dispatch({ type: 'start', counselorId, now: Date.now() })}
              >
                <Play size={18} weight="fill" />
                {tr('Start next visit', 'بدء الزيارة التالية')}
              </button>
            )}
            <button
              className="button button-secondary button-wide"
              disabled={!!current || !counselor.active}
              onClick={() => dispatch({ type: 'break', counselorId, now: Date.now() })}
            >
              <Coffee size={19} />
              {counselor.onBreak
                ? tr('Return from break', 'العودة من الاستراحة')
                : tr('Take a break', 'بدء استراحة')}
            </button>
          </div>
        </section>
        <div className="desk-side">
          <section className="panel desk-stats">
            <h2>{tr('Your day so far', 'يومك حتى الآن')}</h2>
            <div>
              <span>
                <Check size={19} />
                {tr('Sessions completed today', 'الجلسات المنتهية اليوم')}
              </span>
              <strong>{completed}</strong>
            </div>
            <div>
              <span>
                <UsersThree size={19} />
                {tr('Students waiting', 'الطلاب في الانتظار')}
              </span>
              <strong>{waiting.length}</strong>
            </div>
            <div>
              <span>
                <Clock size={19} />
                {tr('Total break time', 'إجمالي وقت الاستراحة')}
              </span>
              <strong>{elapsed(breakMs)}</strong>
            </div>
          </section>
          <section className="panel queue-panel">
            <div className="panel-heading">
              <h2>{tr('Up next', 'التالي')}</h2>
              <span className="count-badge">{waiting.length}</span>
            </div>
            {waiting.length ? (
              waiting.map((v, i) => (
                <div className="queue-row" key={v.id}>
                  <span className="queue-number">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <PersonName id={v.personId} subtitle={false} />
                    <small>
                      {countryName(v.country, language)} · {tr('Demo visit', 'زيارة تجريبية')}
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </div>
              ))
            ) : (
              <Empty title={tr('Your queue is clear', 'قائمة الانتظار فارغة')}>
                <p>
                  {tr(
                    'Register a fictional visit to explore the next session.',
                    'سجّل زيارة وهمية لاستكشاف الجلسة التالية.'
                  )}
                </p>
              </Empty>
            )}
          </section>
          <div className="desk-tip">
            <ClipboardText size={23} />
            <p>
              {tr(
                'Each session starts with your click. Finishing a visit never starts the next student automatically.',
                'تبدأ كل جلسة بنقرة منك. إنهاء الزيارة لا يبدأ جلسة الطالب التالي تلقائياً.'
              )}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
