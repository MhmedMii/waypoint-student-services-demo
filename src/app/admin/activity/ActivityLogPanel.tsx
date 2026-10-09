'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useLanguage } from '../../../i18n/LanguageContext'
import { localizedName } from '../../../i18n/localizedName'
import { severityOf } from '../../../domain/entities/activityLog'
import type { ActivityAction, ActivitySeverity } from '../../../domain/entities/activityLog'
import {
  applyFilters,
  dayLabel,
  distinctActions,
  distinctActors,
  EMPTY_FILTERS,
  groupByDay,
  hasActiveFilters,
  legacyUnassignedAt,
  splitTrailingDetail,
} from './activityLogView'
import type { ActivityFilters, ActivityLogRow } from './activityLogView'
import { KUWAIT_TIME_ZONE } from '../../../domain/time/kuwaitTime'

// الإجراءات اللي تعني "فيه عميل معلّق على أحد مو موجود". اللون يطلع من
// الإجراء نفسه، لأن النص محفوظ نص عادي وما يقدر يحمل تنسيق
const ABSENCE_ACTIONS: ActivityAction[] = [
  'visit_left_unassigned',
  'visit_assigned_to_absent',
  'follow_up_absent_counselor',
]

// الصفوف اللي انكتبت قبل ما يصير لهالحالة إجراء خاص تحمل السبب كنص داخل
// "إنشاء زيارة". ما نعيد كتابتها بقاعدة البيانات — نتعرّف عليها ونلوّنها
// فيه جملة سبب مكتوبة بالصف نقدر نلوّنها — إمّا إجراء الغياب الجديد، أو صف
// قديم يحمل السبب كنص
function hasReasonText(row: ActivityLogRow): boolean {
  if (ABSENCE_ACTIONS.includes(row.action)) return true
  return row.action === 'visit_created' && legacyUnassignedAt(row.details) >= 0
}

// الصف يستاهل النقطة الحمرا: إمّا السبب مكتوب فيه، أو النتيجة لسا قائمة —
// العميل بدون مستشار لين الحين، وهذي نعرفها لأي صف مهما كان تاريخه
function isAbsenceRow(row: ActivityLogRow): boolean {
  return (
    hasReasonText(row) || (row.action === 'visit_created' && row.clientStillUnassigned === true)
  )
}

type LoadStatus = 'loading' | 'ready' | 'error'

const SEVERITY_ORDER: ActivitySeverity[] = ['routine', 'privilege', 'destructive']
const SEVERITY_MARK: Record<ActivitySeverity, string> = {
  routine: '✓',
  privilege: '▲',
  destructive: '✕',
}

// الحدث اللي حذف هدفه ما فيه سجل نفتحه — نعرض نص بدل رابط ميت
const DELETED_ACTIONS: ActivityAction[] = [
  'visit_deleted',
  'application_deleted',
  'account_deleted',
]

// نمرر الـid بالرابط عشان الصفحة تفلتر عليه، مو بس تودّينا لقائمة عامة.
// صفحة الحسابات محصورة على super_admin، فللأدمن العادي ما نعرض رابط أصلاً.
function targetHref(row: ActivityLogRow, role: 'admin' | 'super_admin'): string | null {
  if (DELETED_ACTIONS.includes(row.action)) return null
  if (row.targetType === 'account') {
    return role === 'super_admin'
      ? `/admin/accounts?focus=${encodeURIComponent(row.targetId)}`
      : null
  }
  return `/admin/visits?focus=${encodeURIComponent(row.targetId)}`
}

interface LogsResponse {
  rows: ActivityLogRow[]
  totalInRange: number
  totalAllTime: number
}

// الفلتر الزمني يروح للسيرفر: قبل كان يفلتر داخل آخر ٢٠٠ حدث محمّلة، فاختيار
// "آخر ٣٠ يوم" ما كان يقدر يوصل لأبعد منها أبدًا
async function fetchLogs(days: number | 'all'): Promise<LogsResponse> {
  const response = await fetch(`/api/admin/activity-logs?days=${days}`)
  if (!response.ok) throw new Error(`activity-logs responded ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data?.rows)) throw new Error('activity-logs returned an unexpected shape')
  return data
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function sameTarget(a: ActivityLogRow, b: ActivityLogRow): boolean {
  return a.targetType === b.targetType && a.targetId === b.targetId
}

const TARGET_TYPE_KEY = {
  account: 'targetAccount',
  visit: 'targetVisit',
  application: 'targetApplication',
} as const

export function ActivityLogPanel({ role }: { role: 'admin' | 'super_admin' }) {
  const { t, language } = useLanguage()
  // صفوف الخدمة الذاتية نعرضها بتسمية مترجمة بدل الاسم الإنجليزي المخزّن
  const actorLabel = (row: ActivityLogRow) =>
    row.actorRole === 'system'
      ? t('activityLog', 'systemActor')
      : localizedName(row.actorName, row.actorNameAr, language)
  const roleLabel = (role: string) =>
    role === 'system'
      ? t('activityLog', 'systemRole')
      : t('nav', role as 'super_admin' | 'admin' | 'counselor')
  const targetTypeLabel = (targetType: ActivityLogRow['targetType']) =>
    t('activityLog', TARGET_TYPE_KEY[targetType])
  // النسخة العربية غير متوفرة على الصفوف القديمة المسجّلة قبل إضافة العمود —
  // تفضل تعرض بالإنجليزي بهالحالة بدل نص فاضي
  const detailsFor = (row: ActivityLogRow) =>
    language === 'ar' && row.detailsAr ? row.detailsAr : row.details

  // الأحمر على سبب الغياب بس، مو على الجملة كلها ولا على اسم الإجراء
  function renderDetails(row: ActivityLogRow) {
    const details = detailsFor(row)
    // بدون جملة سبب ما فيه شي نلوّنه — النقطة وحدها تكفي. لو قسمنا هنا
    // كان اللون وقع على اسم الدولة بآخر السطر
    if (!hasReasonText(row)) return details ?? row.targetId
    const { head, tail } = splitTrailingDetail(details)
    if (tail === null) return details ?? row.targetId
    return (
      <>
        {head}
        <span className="activity-detail-absent">{tail}</span>
      </>
    )
  }
  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [totals, setTotals] = useState<{ inRange: number; allTime: number }>({
    inRange: 0,
    allTime: 0,
  })
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [filters, setFilters] = useState<ActivityFilters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  // نثبّت "الآن" على وقت وصول البيانات — لو أخذناه كل رندر، التجميع بالأيام
  // يتزحلق تحت المستخدم لو ضلت الصفحة مفتوحة عبر منتصف الليل
  const [now, setNow] = useState(() => new Date())
  const listRef = useRef<HTMLDivElement>(null)

  function load(days: number | 'all' = filters.days) {
    setStatus('loading')
    fetchLogs(days)
      .then((data) => {
        setRows(data.rows)
        setTotals({ inRange: data.totalInRange, allTime: data.totalAllTime })
        setNow(new Date())
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(() => {
    load(filters.days)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.days])

  const visible = useMemo(() => applyFilters(rows, filters, now), [rows, filters, now])
  // الفترة فيها أكثر مما حمّلنا (سقف المسار) — الرقم الحقيقي من السيرفر، مو من طول القائمة
  const capped = rows.length < totals.inRange
  // Infinity = بدون لمّ صفوف — كل حدث يبان مستقل، القائمة نظيفة بدون طبقة "×3" إضافية
  const groups = useMemo(() => groupByDay(visible, Number.POSITIVE_INFINITY), [visible])
  const actors = useMemo(() => distinctActors(rows), [rows])
  const actions = useMemo(() => distinctActions(rows), [rows])
  const filtering = hasActiveFilters(filters)

  const navigableIds = useMemo(() => visible.map((row) => row.id), [visible])
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  )
  const otherOnTarget = useMemo(() => {
    if (!selected) return []
    return rows
      .filter((row) => sameTarget(row, selected))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [rows, selected])

  function moveSelection(offset: number) {
    if (!navigableIds.length) return
    const current = selectedId ? navigableIds.indexOf(selectedId) : -1
    const next = Math.min(Math.max(current + offset, 0), navigableIds.length - 1)
    focusRow(navigableIds[current === -1 ? 0 : next])
  }

  function focusRow(id: string) {
    setSelectedId(id)
    listRef.current?.querySelector<HTMLElement>(`[data-option-id="${id}"]`)?.focus()
  }

  function openDetail(id: string) {
    setSelectedId(id)
    setDetailOpen(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(-1)
    } else if (event.key === 'Home' && navigableIds.length) {
      event.preventDefault()
      focusRow(navigableIds[0])
    } else if (event.key === 'End' && navigableIds.length) {
      event.preventDefault()
      focusRow(navigableIds[navigableIds.length - 1])
    } else if ((event.key === 'Enter' || event.key === ' ') && selectedId) {
      event.preventDefault()
      openDetail(selectedId)
    }
  }

  function renderRow(row: ActivityLogRow) {
    const severity = severityOf(row.action)
    const isSelected = row.id === selectedId
    return (
      <div
        key={row.id}
        role="option"
        aria-selected={isSelected}
        tabIndex={isSelected || (!selectedId && navigableIds[0] === row.id) ? 0 : -1}
        data-option-id={row.id}
        className={`activity-row severity-${severity}${isSelected ? ' is-selected' : ''}`}
        onClick={() => openDetail(row.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openDetail(row.id)
          }
        }}
      >
        <span
          className={`activity-row-dot ${severity}${isAbsenceRow(row) ? ' absent-choice' : ''}`}
          aria-hidden="true"
        />
        <span className="activity-avatar" aria-hidden="true">
          {initialsOf(actorLabel(row))}
        </span>
        <span className="activity-row-main">
          <span className="activity-row-line">
            <b>{actorLabel(row)}</b> — {t('activityLog', row.action)}
          </span>
          <span className="activity-row-meta">
            <span className="activity-target-chip">{targetTypeLabel(row.targetType)}</span>
            {renderDetails(row)}
          </span>
        </span>
        <span className="activity-row-time tnum">
          {new Date(row.createdAt).toLocaleTimeString(language, {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: KUWAIT_TIME_ZONE,
          })}
        </span>
      </div>
    )
  }

  function renderDetail() {
    if (!selected) return null
    const severity = severityOf(selected.action)
    return (
      <div className="activity-detail-page">
        <button type="button" className="activity-back" onClick={() => setDetailOpen(false)}>
          <span className="dir-arrow">←</span> {t('activityLog', 'backToLog')}
        </button>

        <div className="activity-ev-head">
          <span className="activity-avatar activity-avatar-lg" aria-hidden="true">
            {initialsOf(actorLabel(selected))}
          </span>
          <div className="activity-ev-title">
            <h4>
              {actorLabel(selected)} — {t('activityLog', selected.action)}
            </h4>
            <p className="activity-detail-when tnum">
              {new Date(selected.createdAt).toLocaleString(language, {
                timeZone: KUWAIT_TIME_ZONE,
              })}
            </p>
          </div>
          <span className={`activity-chip ${severity}`}>
            {SEVERITY_MARK[severity]} {t('activityLog', severity)}
          </span>
        </div>

        <div className="activity-detail-grid">
          <div className="activity-detail-card">
            <div className="activity-card-lab">{t('activityLog', 'actor')}</div>
            <div className="activity-who-row">
              <span className="activity-avatar" aria-hidden="true">
                {initialsOf(actorLabel(selected))}
              </span>
              <div>
                <div className="activity-who-name">{actorLabel(selected)}</div>
                <div className="activity-who-role">{roleLabel(selected.actorRole)}</div>
              </div>
            </div>
          </div>

          <div className="activity-detail-card">
            <div className="activity-card-lab">{t('activityLog', 'action')}</div>
            <dl className="activity-kv">
              <dt>{t('activityLog', 'action')}</dt>
              <dd>{t('activityLog', selected.action)}</dd>
              <dt>{t('activityLog', 'severity')}</dt>
              <dd>{t('activityLog', severity)}</dd>
              <dt>{t('activityLog', 'eventId')}</dt>
              <dd>
                <code>{selected.id}</code>
              </dd>
            </dl>
          </div>

          <div className="activity-detail-card">
            <div className="activity-card-lab">{t('activityLog', 'target')}</div>
            <dl className="activity-kv">
              <dt>{t('activityLog', 'detailType')}</dt>
              <dd>{targetTypeLabel(selected.targetType)}</dd>
              <dt>{t('activityLog', 'detailRecord')}</dt>
              <dd>
                <code>{selected.targetId}</code>
              </dd>
            </dl>
          </div>

          <div className="activity-detail-card activity-full-card">
            <div className="activity-card-lab">{t('activityLog', 'recorded')}</div>
            <div className="activity-recorded-text">
              {/* الصفوف القديمة المسجّلة قبل عمود detailsAr ترجع بالإنجليزي فقط —
                  نعزلها ثنائي الاتجاه عشان ما تكسر السطر العربي، ونعرض تنبيه بهالحالة بس */}
              <bdi>{detailsFor(selected) ?? '—'}</bdi>
              {!(language === 'ar' && selected.detailsAr) && (
                <span className="activity-recorded-src">{t('activityLog', 'recordedSource')}</span>
              )}
            </div>
          </div>

          {otherOnTarget.length > 1 && (
            <div className="activity-detail-card activity-full-card">
              <div className="activity-card-lab">{t('activityLog', 'otherActivity')}</div>
              <div className="activity-timeline-mini">
                {otherOnTarget.map((row) => (
                  <div
                    key={row.id}
                    className={`activity-tl-item${row.id === selected.id ? ' now' : ''}`}
                  >
                    <span className="activity-tl-dot" aria-hidden="true" />
                    <span className="activity-tl-body">
                      <span className="activity-tl-time tnum">
                        {new Date(row.createdAt).toLocaleTimeString(language, {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: KUWAIT_TIME_ZONE,
                        })}
                      </span>
                      {t('activityLog', row.action)} — {actorLabel(row)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="activity-actions-row">
          <button
            type="button"
            className="activity-btn secondary"
            onClick={() => setDetailOpen(false)}
          >
            <span className="dir-arrow">←</span> {t('activityLog', 'backToLog')}
          </button>
          {targetHref(selected, role) ? (
            <a className="activity-btn primary" href={targetHref(selected, role)!}>
              {t('activityLog', 'openTarget')} <span className="dir-arrow">→</span>
            </a>
          ) : (
            <p className="activity-target-gone">{t('activityLog', 'targetGone')}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="accounts-panel activity-panel">
      <div className="activity-panel-head">
        <div>
          <h3>{t('activityLog', 'title')}</h3>
          {!detailOpen && <p className="activity-subtitle">{t('activityLog', 'subtitle')}</p>}
        </div>
        {status === 'ready' && rows.length > 0 && !detailOpen && (
          // الفترة اللي على الشاشة تروح مع الرابط — قبل، التصدير ما كان يعرفها أصلاً.
          // البحث والفلاتر ما تروح عن قصد: الملف السجل الكامل للفترة، والفلترة بالإكسل
          <a
            className="activity-export"
            href={`/api/admin/activity-logs/export?lang=${language}&days=${filters.days}`}
          >
            {t('activityLog', 'export')}
          </a>
        )}
      </div>

      {status === 'loading' && (
        <div className="activity-state" aria-live="polite">
          <span className="activity-skeleton w90" />
          <span className="activity-skeleton w60" />
          <span className="activity-skeleton w75" />
          <span className="activity-skeleton w40" />
          <p className="activity-state-msg">{t('activityLog', 'loading')}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="activity-state is-error" role="alert">
          <strong>{t('activityLog', 'errorTitle')}</strong>
          <p className="activity-state-msg">{t('activityLog', 'errorHint')}</p>
          <button type="button" className="activity-retry" onClick={() => load()}>
            {t('activityLog', 'retry')}
          </button>
        </div>
      )}

      {status === 'ready' && rows.length === 0 && (
        <div className="activity-state">
          <strong>{t('activityLog', 'empty')}</strong>
          <p className="activity-state-msg">{t('activityLog', 'emptyHint')}</p>
        </div>
      )}

      {status === 'ready' && rows.length > 0 && detailOpen && selected && renderDetail()}

      {status === 'ready' && rows.length > 0 && !detailOpen && (
        <>
          <div className="activity-toolbar">
            <input
              type="search"
              className="activity-search"
              placeholder={t('activityLog', 'searchPlaceholder')}
              aria-label={t('activityLog', 'searchPlaceholder')}
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            />
            <select
              aria-label={t('activityLog', 'severity')}
              value={filters.severity}
              onChange={(event) =>
                setFilters({ ...filters, severity: event.target.value as ActivitySeverity | 'all' })
              }
            >
              <option value="all">{t('activityLog', 'allSeverities')}</option>
              {SEVERITY_ORDER.map((severity) => (
                <option key={severity} value={severity}>
                  {t('activityLog', severity)}
                </option>
              ))}
            </select>
            <select
              aria-label={t('activityLog', 'action')}
              value={filters.action}
              onChange={(event) =>
                setFilters({ ...filters, action: event.target.value as ActivityAction | 'all' })
              }
            >
              <option value="all">{t('activityLog', 'allActions')}</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {t('activityLog', action)}
                </option>
              ))}
            </select>
            <select
              aria-label={t('activityLog', 'actor')}
              value={filters.actor}
              onChange={(event) => setFilters({ ...filters, actor: event.target.value })}
            >
              <option value="all">{t('activityLog', 'allActors')}</option>
              {actors.map((actor) => (
                <option key={actor.name} value={actor.name}>
                  {localizedName(actor.name, actor.nameAr, language)}
                </option>
              ))}
            </select>
            <select
              aria-label={t('activityLog', 'time')}
              value={String(filters.days)}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  days: event.target.value === 'all' ? 'all' : Number(event.target.value),
                })
              }
            >
              <option value="all">{t('activityLog', 'anyDate')}</option>
              <option value="1">{t('activityLog', 'today')}</option>
              <option value="7">{t('activityLog', 'last7Days')}</option>
              <option value="30">{t('activityLog', 'last30Days')}</option>
            </select>
            {filtering && (
              <button
                type="button"
                className="activity-clear"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                {t('activityLog', 'clearFilters')}
              </button>
            )}
            <span className="activity-count">
              {t('activityLog', 'countInPeriod')
                .replace('{shown}', String(visible.length))
                .replace('{inRange}', String(totals.inRange))
                .replace(
                  '{period}',
                  filters.days === 'all'
                    ? t('activityLog', 'periodAllTime')
                    : t('activityLog', 'periodLastDays').replace('{days}', String(filters.days))
                )
                .replace('{all}', String(totals.allTime))}
            </span>
          </div>

          {/* السقف قطع الفترة: نقولها فوق القائمة، بنفس شكل تنبيه البحث المقطوع.
              البحث والفلاتر تشتغل على المحمّل بس، فحدث أقدم ببساطة ما يطلع */}
          {capped && (
            <p className="activity-capped" role="status">
              {t('activityLog', 'cappedNotice').replace('{max}', String(rows.length))}
            </p>
          )}

          {visible.length === 0 ? (
            <div className="activity-state">
              <strong>{t('activityLog', 'emptyFiltered')}</strong>
              <p className="activity-state-msg">{t('activityLog', 'emptyFilteredHint')}</p>
              <button
                type="button"
                className="activity-retry"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                {t('activityLog', 'clearFilters')}
              </button>
            </div>
          ) : (
            <div
              className="activity-list"
              role="listbox"
              aria-label={t('activityLog', 'title')}
              ref={listRef}
              onKeyDown={handleKeyDown}
            >
              {groups.map((group) => (
                <div key={group.key} className="activity-day-group">
                  <div className="activity-day">
                    {dayLabel(
                      group.date,
                      now,
                      language,
                      t('activityLog', 'today'),
                      t('activityLog', 'yesterday')
                    )}
                  </div>
                  {group.items.map((item) => (item.kind === 'event' ? renderRow(item.row) : null))}
                </div>
              ))}
              <p className="activity-boundary">
                {capped
                  ? t('activityLog', 'showingRecent')
                      .replace('{count}', String(rows.length))
                      .replace('{inRange}', String(totals.inRange))
                  : t('activityLog', 'showingAll').replace('{count}', String(rows.length))}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
