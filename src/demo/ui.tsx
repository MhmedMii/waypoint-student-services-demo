'use client'
import { ArrowUpRight, X, DownloadSimple, ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { SheetData } from 'write-excel-file/browser'
import { useDemo } from './DemoProvider'
import { PEOPLE, COUNTRY_AR } from './fixtures'
import type { ApplicationState, VisitState } from './types'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Waypoint demo home">
      <svg className="brand-mark" viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <rect width="44" height="44" rx="13" fill="currentColor" />
        <path
          d="M11 12v15a6 6 0 0 0 12 0V17a5 5 0 0 1 10 0v15"
          stroke="var(--brand-ink)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="11" cy="12" r="2.5" fill="var(--brand-ink)" />
        <circle cx="33" cy="32" r="2.5" fill="var(--brand-ink)" />
      </svg>
      {!compact && (
        <span>
          waypoint<span className="brand-sub">STUDENT SERVICES</span>
        </span>
      )}
    </Link>
  )
}
export const STATE_LABELS: Record<VisitState | ApplicationState, [string, string]> = {
  waiting: ['Waiting', 'في الانتظار'],
  in_session: ['In session', 'في جلسة'],
  follow_up_needed: ['Follow-up due', 'متابعة مطلوبة'],
  closed: ['Completed', 'مكتمل'],
  pending: ['New application', 'طلب جديد'],
  under_review: ['Under review', 'قيد المراجعة'],
  documents_requested: ['Documents needed', 'مستندات مطلوبة'],
  submitted_to_source: ['Submitted', 'تم الإرسال'],
  approved: ['Approved', 'مقبول'],
  rejected: ['Rejected', 'مرفوض'],
}
export function Status({ state }: { state: VisitState | ApplicationState }) {
  const { tr } = useDemo()
  return (
    <span className={`status-tag status-${state}`}>
      <span className="status-dot" />
      {tr(...STATE_LABELS[state])}
    </span>
  )
}
export function PersonName({ id, subtitle = true }: { id: string; subtitle?: boolean }) {
  const { language, tr } = useDemo()
  const person = PEOPLE.find((p) => p.id === id)
  if (!person) return <span>{tr('Demo student', 'طالب تجريبي')}</span>
  return (
    <span className="person-cell">
      <span className={`avatar avatar-${PEOPLE.indexOf(person) % 4}`} aria-hidden="true">
        {person.name
          .split(' ')
          .map((n) => n[0])
          .join('')}
      </span>
      <span>
        <strong>{language === 'ar' ? person.nameAr : person.name}</strong>
        {subtitle && (
          <small>
            {tr('Demo student', 'طالب تجريبي')} · {person.id.slice(-2)}
          </small>
        )}
      </span>
    </span>
  )
}
export function countryName(country: string, language: string) {
  return language === 'ar' ? (COUNTRY_AR[country] ?? country) : country
}
export function elapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-symbol" aria-hidden="true">
        ↗
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  )
}
export function Drawer({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = 'demo-drawer-title'
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="detail-drawer"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="drawer-head">
        <span className="eyebrow">WAYPOINT / DEMO</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={useDemo().tr('Close details', 'إغلاق التفاصيل')}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  )
}
export function Pager({
  page,
  setPage,
  total,
  size = 8,
}: {
  page: number
  setPage: (value: number) => void
  total: number
  size?: number
}) {
  const { tr } = useDemo()
  const pages = Math.max(1, Math.ceil(total / size))
  return (
    <div className="table-footer">
      <span>{tr(`${total} records · all fictional`, `${total} سجل · جميعها وهمية`)}</span>
      <div className="pagination">
        <button
          className="icon-button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          aria-label={tr('Previous page', 'الصفحة السابقة')}
        >
          <ArrowLeft size={16} />
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          className="icon-button"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          aria-label={tr('Next page', 'الصفحة التالية')}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-link">
      {children}
      <ArrowUpRight size={16} />
    </Link>
  )
}
export async function exportRows(
  filename: string,
  headings: string[],
  rows: (string | number)[][]
) {
  const writeXlsxFile = (await import('write-excel-file/browser')).default
  const sheet: SheetData = [
    [{ value: 'DEMO — ALL RECORDS ARE FICTIONAL', fontWeight: 'bold' as const }],
    headings.map((value) => ({ value, fontWeight: 'bold' as const })),
    ...rows.map((row) =>
      row.map((value) =>
        typeof value === 'number' ? { value, type: Number } : { value, type: String }
      )
    ),
  ]
  await writeXlsxFile(sheet, { columns: headings.map(() => ({ width: 24 })) }).toFile(
    `${filename}.xlsx`
  )
}
export function ExportButton({ onClick }: { onClick: () => Promise<void> }) {
  const { tr } = useDemo()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function handleExport() {
    setBusy(true)
    setError(false)
    try {
      await onClick()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="export-control">
      <button
        className="button button-secondary"
        disabled={busy}
        onClick={() => void handleExport()}
      >
        <DownloadSimple size={17} />
        {busy ? tr('Exporting…', 'جارٍ التصدير…') : tr('Export report', 'تصدير تقرير')}
      </button>
      {error && (
        <span role="alert" className="export-error">
          {tr('Export failed. Try again.', 'تعذر التصدير. حاول مجدداً.')}
        </span>
      )}
    </div>
  )
}
export function downloadDocument(name: string) {
  const blob = new Blob(
    [
      `DEMO — FICTIONAL DOCUMENT\n\n${name}\n\nThis is a generated demonstration file.\nIt contains no passport, identity, academic, or customer records.\nNo personal information was collected.\n`,
    ],
    { type: 'text/plain;charset=utf-8' }
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
