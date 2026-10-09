'use client'
import { useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { translateErrorCode } from '../../i18n/translateErrorCode'
import { useVisiblePolling } from '../../hooks/useVisiblePolling'
import { MAX_NOTE_LENGTH } from '../../domain/validation/validateNote'
import type { VisitStudentStatus } from '../../domain/entities/visit'
import { defaultFollowUpDueDate } from '../../domain/time/defaultFollowUpDueDate'

interface QueueView {
  currentVisit: { id: string; name: string } | null
  elapsed: { status: string; elapsedMs?: number }
  waitingCount: number
  nextWaitingName: string | null
  breakTotalMsToday: number
  openBreakElapsed: { status: string; elapsedMs?: number }
  servedToday: number
  avgHandlingMs: number | null
}

const REFRESH_INTERVAL_MS = 5000
const REQUEST_TIMEOUT_MS = 8000

// شاشة المستشار كانت تاخذ أي رد وتحطه بالحالة: لما تنتهي الجلسة يرد المسار
// {ok:false} بحالة 401، فتصير هي الـ view — كائن ناقص يعدّي شرط !view لأنه
// مو فارغ، وأول قراءة لـ openBreakElapsed.status ترمي والشاشة تطلع بيضاء.
// المستشار يرجع من عند عميل ويلقى صفحة فاضية بلا أي تفسير
type QueueFetchResult =
  { ok: true; view: QueueView } | { ok: false; reason: 'unauthorized' | 'failed' | 'timeout' }

// نتأكد من الشكل قبل ما نصدّقه — الحارس الحقيقي ضد أي رد ما نتوقعه
function isQueueView(data: unknown): data is QueueView {
  if (typeof data !== 'object' || data === null) return false
  const v = data as Record<string, unknown>
  return (
    typeof v.elapsed === 'object' &&
    v.elapsed !== null &&
    typeof v.openBreakElapsed === 'object' &&
    v.openBreakElapsed !== null &&
    typeof v.waitingCount === 'number'
  )
}

async function fetchQueue(): Promise<QueueFetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch('/api/counselor/queue', { signal: controller.signal })
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: 'unauthorized' }
    }
    if (!response.ok) return { ok: false, reason: 'failed' }
    const data = await response.json()
    if (!isQueueView(data)) return { ok: false, reason: 'failed' }
    return { ok: true, view: data }
  } catch {
    return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'failed' }
  } finally {
    clearTimeout(timer)
  }
}

function formatClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
}

function formatAvgHandling(ms: number | null): string {
  return ms === null ? '—' : formatClock(ms)
}

export function CounselorPanel() {
  const { t, language } = useLanguage()
  const [view, setView] = useState<QueueView | null>(null)
  // نثبّت وقت آخر جلب — العداد يتحرك محليًا كل ثانية بينه وبين الجلب الجاي،
  // بدل ما نضرب السيرفر كل ثانية بس عشان نحرّك ساعة توقيت
  const [fetchedAt, setFetchedAt] = useState(0)
  const [, setTick] = useState(0)
  const [note, setNote] = useState('')
  // بعد "إنهاء والتالي" نعرض شاشة "كيف راحت الزيارة؟" محليًا فقط — ما نطلب
  // /api/counselor/finish إلا بعد ما يضغط "تم"، عشان الحالة والملاحظة يترسلوا سوا
  const [wrappingUp, setWrappingUp] = useState<{ visitId: string; name: string } | null>(null)
  const [pendingStatus, setPendingStatus] = useState<VisitStudentStatus | null>(null)
  const [followUpDueAt, setFollowUpDueAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<'unauthorized' | 'failed' | 'timeout' | null>(null)
  // فشل الحفظ ما يمسح شي: الملاحظة والحالة والتاريخ يبقون بمكانهم للمحاولة الثانية
  const [finishError, setFinishError] = useState<string | null>(null)
  // الأزرار الثلاثة كانت ترسل وتنسى. الأخطر الاستراحة: لو الطلب طاح، المستشار
  // يظن إنه بإستراحة والنظام يظن إنه شغال — فوقته ينحسب غلط، ومعه كل متوسط
  // مبني عليه. الآن الفشل يُقال، والشاشة تتحدّث عشان تبيّن الحقيقة
  const [actionError, setActionError] = useState<string | null>(null)

  async function refresh() {
    try {
      const result = await fetchQueue()
      if (result.ok) {
        setView(result.view)
        setFailure(null)
        setFetchedAt(Date.now())
        return
      }
      // فشل تحديث والشاشة شغالة: نخلي اللي معروض مكانه مع تنبيه إنه مو طازج،
      // بدل ما نمسح شاشة مستشار قاعد مع عميل
      setFailure(result.reason)
    } catch {
      setFailure('failed')
    }
  }

  useVisiblePolling(refresh, REFRESH_INTERVAL_MS)
  useVisiblePolling(() => setTick((n) => n + 1), 1000)

  // نرجّع true فقط لما السيرفر يقبل فعلاً
  async function runAction(url: string): Promise<boolean> {
    setActionError(null)
    try {
      const response = await fetch(url, { method: 'POST' })
      if (response.ok) return true
      const body = await response.json().catch(() => null)
      const reason = typeof body?.reason === 'string' ? body.reason : null
      setActionError(translateErrorCode(language, reason) ?? t('counselor', 'actionFailedHint'))
      return false
    } catch {
      setActionError(t('counselor', 'actionFailedHint'))
      return false
    }
  }

  async function handleNext() {
    await runAction('/api/counselor/next')
    // نحدّث بالحالتين: لو فشل، الشاشة تبيّن إنه ما صار شي بدل ما تتركه يخمّن
    refresh()
  }

  function handleFinish() {
    if (!view?.currentVisit) return
    setWrappingUp({ visitId: view.currentVisit.id, name: view.currentVisit.name })
    setPendingStatus(null)
    setFollowUpDueAt('')
  }

  function pickStatus(status: VisitStudentStatus) {
    setPendingStatus(status)
    if (status === 'follow_up_needed' && !followUpDueAt) {
      setFollowUpDueAt(defaultFollowUpDueDate())
    }
  }

  async function submitFinish() {
    if (!wrappingUp || !pendingStatus) return
    if (pendingStatus === 'follow_up_needed' && !followUpDueAt) return
    setSubmitting(true)
    setFinishError(null)

    // كانت ترسل بلا ما تتأكد من الرد، وتمسح الملاحظة بأي حال. الطلب لو طاح:
    // الملاحظة اللي كتبها المستشار تروح، الزيارة تظل مفتوحة، وهو يظن إنه خلّص
    try {
      const response = await fetch('/api/counselor/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId: wrappingUp.visitId,
          studentStatus: pendingStatus,
          note: note.trim() || null,
          followUpDueAt: pendingStatus === 'follow_up_needed' ? followUpDueAt : null,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const reason = typeof body?.reason === 'string' ? body.reason : null
        setFinishError(translateErrorCode(language, reason) ?? t('counselor', 'finishFailedHint'))
        setSubmitting(false)
        return
      }
    } catch {
      setFinishError(t('counselor', 'finishFailedHint'))
      setSubmitting(false)
      return
    }

    // نجح فقط: الآن نمسح
    setNote('')
    setWrappingUp(null)
    setPendingStatus(null)
    setFollowUpDueAt('')
    setFinishError(null)
    setSubmitting(false)
    refresh()
  }

  async function handleBreakOut() {
    await runAction('/api/counselor/break-out')
    refresh()
  }

  async function handleBreakIn() {
    await runAction('/api/counselor/break-in')
    refresh()
  }

  // انتهت الجلسة: نقولها ونعطيه طريق الرجوع، مو شاشة بيضاء
  if (failure === 'unauthorized') {
    return (
      <div className="supervision-state">
        <b>{t('counselor', 'sessionEnded')}</b>
        <p>{t('counselor', 'sessionEndedHint')}</p>
        <a className="btn-orange" href="/login">
          {t('counselor', 'signIn')}
        </a>
      </div>
    )
  }
  if (!view && failure !== null) {
    return (
      <div className="supervision-state">
        <b>{t('counselor', 'loadFailed')}</b>
        <p>{t('counselor', failure === 'timeout' ? 'loadTimedOutHint' : 'loadFailedHint')}</p>
        <button type="button" className="btn-orange" onClick={() => void refresh()}>
          {t('counselor', 'retry')}
        </button>
      </div>
    )
  }
  if (!view) return <p>{t('common', 'loading')}</p>

  const isWrappingUp = wrappingUp !== null
  const isServing = view.currentVisit !== null && !isWrappingUp
  const isOnBreak = view.openBreakElapsed.status === 'running'
  // الحالة "running" بس تكبر مع الوقت — نضيف الفرق من آخر جلب عشان الساعة
  // تتحرك ثانية بثانية بالعرض حتى لو الجلب الفعلي كل 5 ثواني
  const sinceFetch = Date.now() - fetchedAt
  const clientElapsedMs =
    view.elapsed.status === 'running'
      ? (view.elapsed.elapsedMs ?? 0) + sinceFetch
      : view.elapsed.status === 'finished'
        ? (view.elapsed.elapsedMs ?? 0)
        : 0
  const breakElapsedMs =
    view.openBreakElapsed.status === 'running'
      ? (view.openBreakElapsed.elapsedMs ?? 0) + sinceFetch
      : 0

  const statusDotClass =
    isWrappingUp || isServing ? 'tone-orange' : isOnBreak ? 'tone-warning' : 'tone-faint'
  const statusLabel = isWrappingUp
    ? t('counselor', 'statusWrappingUp')
    : isServing
      ? t('counselor', 'statusServing')
      : isOnBreak
        ? t('counselor', 'statusOnBreak')
        : t('counselor', 'statusIdle')

  return (
    <div className="screen-counselor">
      {actionError !== null && (
        <p className="err" role="alert">
          {actionError}
        </p>
      )}
      {/* التحديث متعثّر والشاشة شغالة: نقول إن الأرقام مو طازجة ونتركها
          مكانها — مسح شاشة مستشار قاعد مع عميل أسوأ من رقم متأخر شوي */}
      {failure !== null && (
        <p className="supervision-stale" role="status">
          ⚠{' '}
          {t('counselor', 'staleNotice').replace(
            '{ago}',
            formatClock(Math.max(0, Date.now() - fetchedAt))
          )}
        </p>
      )}
      <header className="page-header">
        <h1>{t('counselor', 'pageTitle')}</h1>
        <span className="status-pill">
          <span className={`status-dot ${statusDotClass}`} />
          {statusLabel}
        </span>
      </header>

      <div className="stats-strip">
        <div className="stat-card">
          <span className="stat-label">{t('counselor', 'servedToday')}</span>
          <span className="stat-value">{view.servedToday}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">{t('counselor', 'avgHandling')}</span>
          <span className="stat-value">{formatAvgHandling(view.avgHandlingMs)}</span>
          {/* شرطة بلا تفسير تنقرأ كأن التطبيق ضيّع شغل الصباح — نقول السبب */}
          {view.avgHandlingMs === null && (
            <span className="stat-hint">{t('counselor', 'noTimedSessions')}</span>
          )}
        </div>
        <div className="stat-card">
          <span className="stat-label">{t('counselor', 'breakToday')}</span>
          <span className="stat-value">{formatClock(view.breakTotalMsToday + breakElapsedMs)}</span>
        </div>
      </div>

      {isWrappingUp ? (
        <div className="stopwatch-card">
          <div className="status-pick-heading">
            {t('counselor', 'howDidItGo').replace('{name}', wrappingUp.name)}
          </div>
          <p className="status-pick-note">{t('counselor', 'finishTwoChoices')}</p>
          <div className="status-pick-grid">
            <button
              className={`status-pick-btn tone-follow-up ${pendingStatus === 'follow_up_needed' ? 'selected' : ''}`}
              onClick={() => pickStatus('follow_up_needed')}
            >
              {t('students', 'statusFollowUpNeeded')}
            </button>
            <button
              className={`status-pick-btn tone-closed ${pendingStatus === 'closed' ? 'selected' : ''}`}
              onClick={() => pickStatus('closed')}
            >
              {t('students', 'statusClosed')}
            </button>
          </div>
          {pendingStatus === 'follow_up_needed' && (
            <div className="follow-up-due-box">
              <label htmlFor="follow-up-due-at" className="follow-up-due-label">
                {t('counselor', 'followUpDueLabel')}
              </label>
              <input
                id="follow-up-due-at"
                type="date"
                className="follow-up-due-input"
                value={followUpDueAt}
                onChange={(e) => setFollowUpDueAt(e.target.value)}
              />
              <div className="follow-up-due-hint">{t('counselor', 'followUpDueHint')}</div>
            </div>
          )}
          {/* الخطأ فوق الزر مباشرة، وdrole=alert عشان قارئ الشاشة يقوله كمان.
              الملاحظة ما زالت بالصندوق — الرسالة تقول هذا بصريح العبارة */}
          {finishError !== null && (
            <p className="err" role="alert">
              {finishError}
            </p>
          )}
          <button
            className="status-pick-done"
            disabled={
              !pendingStatus ||
              submitting ||
              (pendingStatus === 'follow_up_needed' && !followUpDueAt)
            }
            onClick={submitFinish}
          >
            {t(
              'counselor',
              submitting ? 'finishSaving' : finishError !== null ? 'finishRetry' : 'done'
            )}
          </button>
        </div>
      ) : (
        <>
          <div className="stopwatch-card">
            {isServing && <div className="client-name">{view.currentVisit!.name}</div>}
            <div className="stopwatch-time">{formatClock(clientElapsedMs)}</div>
            {!isServing && (
              <p>
                {view.waitingCount} {t('counselor', 'waiting')}
                {view.nextWaitingName
                  ? `${t('counselor', 'nextWaitingSeparator')}${view.nextWaitingName}`
                  : ''}
              </p>
            )}
          </div>

          {isServing && (
            <textarea
              className="visit-note-field"
              placeholder={t('counselor', 'notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={MAX_NOTE_LENGTH}
            />
          )}

          <div className="counselor-actions">
            <button
              onClick={handleNext}
              disabled={isServing || isOnBreak || view.waitingCount === 0}
            >
              {t('counselor', 'next')}
            </button>
            <button onClick={handleFinish} disabled={!isServing}>
              {t('counselor', 'finishNext')}
            </button>
          </div>

          <div className="break-controls">
            <button onClick={handleBreakOut} disabled={isServing || isOnBreak}>
              {t('counselor', 'breakOut')}
            </button>
            <button onClick={handleBreakIn} disabled={!isOnBreak}>
              {t('counselor', 'breakIn')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
