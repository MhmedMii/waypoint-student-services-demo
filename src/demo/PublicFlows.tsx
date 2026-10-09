'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  FileText,
  Plus,
  AirplaneTilt,
  Certificate,
  UsersThree,
  ShieldCheck,
} from '@phosphor-icons/react'
import { useDemo } from './DemoProvider'
import { PEOPLE, COUNTRIES, SERVICES, SERVICES_AR } from './fixtures'
import { Brand, PersonName, Status, countryName, downloadDocument } from './ui'
import { Preferences } from './DemoShell'
import type { VisitKind } from './types'

export function PublicFrame({ children }: { children: React.ReactNode }) {
  const { tr } = useDemo()
  return (
    <div className="public-page">
      <header className="public-header">
        <Brand />
        <div>
          <Link href="/admin" className="text-link">
            {tr('Back to workspace', 'العودة إلى مساحة العمل')}
            <ArrowLeft size={17} />
          </Link>
          <Preferences />
        </div>
      </header>
      <main className="public-main">
        <div className="public-demo-label">
          <ShieldCheck size={18} />
          {tr('Demo experience · all records are fictional', 'تجربة عرض · جميع السجلات وهمية')}
        </div>
        {children}
      </main>
      <footer className="public-footer">
        {tr(
          'No real identities, documents, payments, or email. Just a workspace to explore.',
          'بدون هويات أو مستندات أو مدفوعات أو بريد حقيقي. مساحة للاستكشاف فقط.'
        )}
      </footer>
    </div>
  )
}
export function Intake() {
  const { data, dispatch, tr, language } = useDemo()
  const [kind, setKind] = useState<VisitKind>('new')
  const [personId, setPersonId] = useState(PEOPLE[0].id)
  const [country, setCountry] = useState(PEOPLE[0].country)
  const [counselorId, setCounselorId] = useState('team-01')
  const [done, setDone] = useState(false)
  function submit(event: React.FormEvent) {
    event.preventDefault()
    dispatch({ type: 'register', personId, kind, country, counselorId, now: Date.now() })
    setDone(true)
  }
  return (
    <PublicFrame>
      <div className="public-heading">
        <span className="eyebrow">{tr('FRONT DESK', 'مكتب الاستقبال')}</span>
        <h1>
          {tr('A warm welcome.', 'بداية مرحّبة.')}
          <br />
          {tr('A clear next step.', 'خطوة تالية واضحة.')}
        </h1>
        <p>
          {tr(
            'Try registering a fictional student visit. We’ll find the right counselor.',
            'جرّب تسجيل زيارة طالب وهمي. سنختار المستشار المناسب.'
          )}
        </p>
      </div>
      {done ? (
        <section className="public-card success-card">
          <CheckCircle size={48} />
          <h2>{tr('You’re on the list.', 'تم تسجيلك.')}</h2>
          <p>
            {tr(
              'The fictional visit is now in the workspace queue.',
              'أصبحت الزيارة الوهمية في قائمة الانتظار.'
            )}
          </p>
          <PersonName id={personId} />
          <div className="button-row">
            <button className="button button-secondary" onClick={() => setDone(false)}>
              {tr('Register another', 'تسجيل زيارة أخرى')}
            </button>
            <Link href="/admin/visits" className="button">
              {tr('View the queue', 'عرض قائمة الانتظار')}
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      ) : (
        <form className="public-card" onSubmit={submit}>
          <div className="choice-tabs">
            {(
              [
                ['new', 'First visit', 'زيارة أولى'],
                ['follow_up', 'Follow-up', 'متابعة'],
                ['visa', 'Visa / services', 'تأشيرات / خدمات'],
              ] as const
            ).map(([value, en, ar]) => (
              <button
                type="button"
                key={value}
                className={kind === value ? 'selected' : ''}
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                {tr(en, ar)}
              </button>
            ))}
          </div>
          <SamplePersonSelect
            value={personId}
            onChange={(id) => {
              setPersonId(id)
              setCountry(PEOPLE.find((p) => p.id === id)!.country)
            }}
          />
          <div className="generated-identity">
            <PersonName id={personId} />
            <span>DEMO-{personId.slice(-2)}</span>
          </div>
          {kind === 'new' && (
            <label className="field-label">
              {tr('Study destination', 'وجهة الدراسة')}
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {countryName(c, language)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'follow_up' && (
            <label className="field-label">
              {tr('Choose a counselor', 'اختر مستشاراً')}
              <select value={counselorId} onChange={(e) => setCounselorId(e.target.value)}>
                {data.team
                  .filter((m) => m.role === 'counselor' && m.active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {language === 'ar' ? m.nameAr : m.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <p className="fictional-note">
            {tr(
              'Select a generated identity. This demo does not collect names or phone numbers.',
              'اختر هوية مولّدة. هذا العرض لا يجمع أسماء أو أرقام هواتف.'
            )}
          </p>
          <button className="button button-wide" type="submit">
            {tr('Register demo visit', 'تسجيل زيارة تجريبية')}
            <ArrowRight size={18} />
          </button>
        </form>
      )}
    </PublicFrame>
  )
}
function SamplePersonSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { tr, language } = useDemo()
  return (
    <label className="field-label">
      {tr('Choose a fictional identity', 'اختر هوية وهمية')}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {PEOPLE.map((p) => (
          <option key={p.id} value={p.id}>
            {language === 'ar' ? p.nameAr : p.name} · {tr('Demo', 'تجريبي')}
          </option>
        ))}
      </select>
    </label>
  )
}
export function Apply() {
  const params = useSearchParams()
  const { data, dispatch, tr, language } = useDemo()
  const initial = params.get('kind') === 'exam' ? 'exam' : 'visa'
  const [kind, setKind] = useState<'visa' | 'exam'>(initial)
  const [service, setService] = useState(SERVICES[initial][0])
  const [personId, setPersonId] = useState(PEOPLE[2].id)
  const [step, setStep] = useState(1)
  const [attached, setAttached] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  function submit() {
    const id = `WP-${2401 + data.applications.length}`
    dispatch({
      type: 'application',
      personId,
      kind,
      service,
      documents: attached ? ['Demo identity sample.txt', 'Demo study record.txt'] : [],
      now: Date.now(),
    })
    setSubmittedId(id)
  }
  return (
    <PublicFrame>
      <div className="public-heading">
        <span className="eyebrow">{tr('THE STUDENT EXPERIENCE', 'تجربة الطالب')}</span>
        <h1>
          {tr('Your next chapter', 'فصلك التالي')}
          <br />
          {tr('starts here.', 'يبدأ هنا.')}
        </h1>
        <p>
          {tr(
            'Explore a fictional visa application or exam booking, one step at a time.',
            'استكشف طلب تأشيرة أو حجز اختبار وهمياً، خطوة بخطوة.'
          )}
        </p>
      </div>
      {submittedId ? (
        <section className="public-card success-card">
          <CheckCircle size={48} />
          <h2>{tr('One step closer.', 'أقرب بخطوة.')}</h2>
          <p>{tr('Your fictional application is ready to track.', 'طلبك الوهمي جاهز للمتابعة.')}</p>
          <span className="application-reference">{submittedId}</span>
          <Link href={`/apply/status/${submittedId}`} className="button button-wide">
            {tr('Track demo application', 'متابعة الطلب التجريبي')}
            <ArrowRight size={18} />
          </Link>
          <Link href={kind === 'visa' ? '/visas' : '/exams'} className="text-link">
            {tr('See the staff view', 'عرض واجهة الموظف')}
            <ArrowRight size={16} />
          </Link>
        </section>
      ) : (
        <section className="public-card">
          <ol className="form-steps">
            {[
              [tr('Service', 'الخدمة'), 1],
              [tr('Identity', 'الهوية'), 2],
              [tr('Documents', 'المستندات'), 3],
            ].map(([label, n]) => (
              <li key={n} className={step === n ? 'current' : step > Number(n) ? 'complete' : ''}>
                <span>{step > Number(n) ? <CheckCircle size={18} /> : n}</span>
                {label}
              </li>
            ))}
          </ol>
          {step === 1 && (
            <>
              <h2>{tr('What comes next?', 'ما هي الخطوة التالية؟')}</h2>
              <p className="form-description">
                {tr('Choose a demo service to explore.', 'اختر خدمة تجريبية لاستكشافها.')}
              </p>
              <div className="service-choices">
                {(['visa', 'exam'] as const).map((value) => (
                  <button
                    className={kind === value ? 'selected' : ''}
                    key={value}
                    onClick={() => {
                      setKind(value)
                      setService(SERVICES[value][0])
                    }}
                  >
                    {value === 'visa' ? <AirplaneTilt size={27} /> : <Certificate size={27} />}
                    <strong>
                      {value === 'visa'
                        ? tr('Student visa', 'تأشيرة طالب')
                        : tr('Exam booking', 'حجز اختبار')}
                    </strong>
                    <small>
                      {value === 'visa'
                        ? tr('A new destination', 'وجهة جديدة')
                        : tr('Your next milestone', 'إنجازك التالي')}
                    </small>
                  </button>
                ))}
              </div>
              <label className="field-label">
                {tr('Select a service', 'اختر الخدمة')}
                <select value={service} onChange={(e) => setService(e.target.value)}>
                  {SERVICES[kind].map((s) => (
                    <option key={s} value={s}>
                      {language === 'ar' ? SERVICES_AR[s] : s}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <h2>{tr('Meet your fictional student.', 'تعرّف على طالبك الوهمي.')}</h2>
              <p className="form-description">
                {tr(
                  'Explore with a generated identity. No real contact details needed.',
                  'استكشف بهوية مولّدة. لا تحتاج إلى بيانات تواصل حقيقية.'
                )}
              </p>
              <SamplePersonSelect value={personId} onChange={setPersonId} />
              <div className="generated-identity">
                <PersonName id={personId} />
                <span>DEMO-{personId.slice(-2)}</span>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>{tr('Demo email', 'بريد تجريبي')}</dt>
                  <dd>{personId}@example.com</dd>
                </div>
                <div>
                  <dt>{tr('Sample study level', 'مستوى دراسي نموذجي')}</dt>
                  <dd>{tr('Undergraduate', 'بكالوريوس')}</dd>
                </div>
              </dl>
            </>
          )}
          {step === 3 && (
            <>
              <h2>{tr('A few fictional documents.', 'بعض المستندات الوهمية.')}</h2>
              <p className="form-description">
                {tr(
                  'Use generated samples to try the document flow. Real files cannot be uploaded.',
                  'استخدم نماذج مولّدة لتجربة المستندات. لا يمكن رفع ملفات حقيقية.'
                )}
              </p>
              <div className="demo-attachment">
                <FileText size={35} />
                <strong>
                  {attached
                    ? tr('Two sample documents attached', 'تم إرفاق مستندين نموذجيين')
                    : tr('Sample document pack', 'حزمة مستندات نموذجية')}
                </strong>
                <p>
                  {tr(
                    'Generated text files, clearly marked as fictional.',
                    'ملفات نصية مولّدة ومعلّمة بوضوح بأنها وهمية.'
                  )}
                </p>
                <button className="button button-secondary" onClick={() => setAttached(!attached)}>
                  {attached ? <CheckCircle size={18} /> : <Plus size={18} />}{' '}
                  {attached
                    ? tr('Remove samples', 'حذف النماذج')
                    : tr('Attach demo documents', 'إرفاق مستندات تجريبية')}
                </button>
              </div>
              <p className="fictional-note">
                {tr(
                  'Submitting only updates this browser’s demo workspace.',
                  'التقديم يحدّث مساحة العرض في هذا المتصفح فقط.'
                )}
              </p>
            </>
          )}
          <div className="form-navigation">
            {step > 1 ? (
              <button className="button button-secondary" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={18} />
                {tr('Back', 'رجوع')}
              </button>
            ) : (
              <span />
            )}
            <button className="button" onClick={() => (step < 3 ? setStep(step + 1) : submit())}>
              {step < 3
                ? tr('Continue', 'متابعة')
                : tr('Submit demo application', 'تقديم طلب تجريبي')}
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}
    </PublicFrame>
  )
}
export function Tracking() {
  const pathname = usePathname()
  const { data, dispatch, tr, language } = useDemo()
  const id = decodeURIComponent(pathname.split('/').pop() ?? '')
  const application = data.applications.find((a) => a.id === id)
  return (
    <PublicFrame>
      <div className="public-heading">
        <span className="eyebrow">{tr('APPLICATION TRACKING', 'متابعة الطلب')}</span>
        <h1>
          {tr('Your next step,', 'خطوتك التالية،')}
          <br />
          {tr('in plain sight.', 'بكل وضوح.')}
        </h1>
        <p>{tr('Follow the progress of a fictional application.', 'تابع تقدم طلب وهمي.')}</p>
      </div>
      <section className="public-card">
        {!application ? (
          <>
            <h2>{tr('This demo application isn’t here.', 'هذا الطلب التجريبي غير موجود.')}</h2>
            <p>
              {tr(
                'It may have been reset or created in a different browser.',
                'ربما تمت إعادة ضبطه أو إنشاؤه في متصفح آخر.'
              )}
            </p>
            <Link href="/apply" className="button">
              {tr('Create a fictional application', 'إنشاء طلب وهمي')}
            </Link>
          </>
        ) : (
          <>
            <div className="tracking-heading">
              <span className="mono-text">{application.id}</span>
              <Status state={application.status} />
            </div>
            <PersonName id={application.personId} />
            <h2 className="tracking-service">
              {language === 'ar' ? SERVICES_AR[application.service] : application.service}
            </h2>
            <ol className="tracking-timeline">
              {[
                [tr('Application received', 'تم استلام الطلب'), true],
                [
                  tr('Review and documents', 'المراجعة والمستندات'),
                  application.status !== 'pending',
                ],
                [
                  tr('Submitted for a decision', 'تم الإرسال لاتخاذ قرار'),
                  ['submitted_to_source', 'approved', 'rejected'].includes(application.status),
                ],
                [
                  tr('Final decision', 'القرار النهائي'),
                  ['approved', 'rejected'].includes(application.status),
                ],
              ].map(([label, done], i) => (
                <li className={done ? 'done' : ''} key={i}>
                  <span>{done ? <CheckCircle size={21} /> : i + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
            <div className="sample-documents">
              {application.documents.map((doc) => (
                <button key={doc} onClick={() => downloadDocument(doc)}>
                  <FileText size={20} />
                  <span>{tr('Fictional sample document', 'مستند نموذجي وهمي')}</span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
            <div className="note-box">
              <ShieldCheck size={23} />
              <div>
                <strong>
                  {application.paid
                    ? tr('Demo payment simulated', 'تمت محاكاة الدفع')
                    : tr('Try a payment simulation', 'جرّب محاكاة الدفع')}
                </strong>
                <p>
                  {tr(
                    'No money moves and no provider is contacted.',
                    'لا يتم تحويل أموال أو الاتصال بمزود دفع.'
                  )}
                </p>
              </div>
            </div>
            {!application.paid && (
              <button
                className="button button-wide"
                onClick={() => dispatch({ type: 'payment', id, now: Date.now() })}
              >
                {tr('Simulate payment', 'محاكاة الدفع')}
              </button>
            )}
            <p className="fictional-note">
              {tr(
                'All information is fictional and stored in this browser only.',
                'جميع المعلومات وهمية ومحفوظة في هذا المتصفح فقط.'
              )}
            </p>
          </>
        )}
      </section>
    </PublicFrame>
  )
}
export function Welcome() {
  const { tr, setRole } = useDemo()
  return (
    <PublicFrame>
      <div className="welcome-page-grid">
        <div className="public-heading">
          <span className="eyebrow">{tr('A WORKSPACE WITH DIRECTION', 'مساحة عمل ذات وجهة')}</span>
          <h1>
            {tr('Good conversations.', 'محادثات جيدة.')}
            <br />
            {tr('Brighter chapters.', 'فصول أكثر إشراقاً.')}
          </h1>
          <p>
            {tr(
              'Explore a complete student services workspace with fictional people and working demo flows.',
              'استكشف مساحة متكاملة لخدمات الطلاب بأشخاص وهميين وإجراءات تجريبية عملية.'
            )}
          </p>
          <div className="welcome-footnote">
            <ShieldCheck size={22} />
            {tr(
              'No account needed. No real data collected.',
              'لا تحتاج إلى حساب. لا يتم جمع بيانات حقيقية.'
            )}
          </div>
        </div>
        <section className="public-card role-cards">
          <h2>{tr('Choose your perspective.', 'اختر منظورك.')}</h2>
          <p>
            {tr('One workspace. Different ways to explore.', 'مساحة واحدة. طرق مختلفة للاستكشاف.')}
          </p>
          {(
            [
              [
                'super_admin',
                'Owner workspace',
                'مساحة المالك',
                'Explore dashboards, accounts, and services.',
                'استكشف اللوحات والحسابات والخدمات.',
                '/admin',
              ],
              [
                'admin',
                'Admin reporting',
                'تقارير المدير',
                'Review fictional metrics and export reports.',
                'راجع المؤشرات الوهمية وصدّر التقارير.',
                '/admin',
              ],
              [
                'counselor',
                'Counselor desk',
                'مكتب المستشار',
                'Start a session and move the queue forward.',
                'ابدأ جلسة وتابع قائمة الانتظار.',
                '/counselor',
              ],
            ] as const
          ).map(([role, en, ar, desc, descAr, href]) => (
            <Link href={href} onClick={() => setRole(role)} key={role} className="role-card">
              <UsersThree size={24} />
              <span>
                <strong>{tr(en, ar)}</strong>
                <small>{tr(desc, descAr)}</small>
              </span>
              <ArrowUpRight size={20} />
            </Link>
          ))}
          <Link href="/apply" className="button button-secondary button-wide">
            {tr('Try the applicant experience', 'جرّب تجربة الطالب')}
            <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </PublicFrame>
  )
}
