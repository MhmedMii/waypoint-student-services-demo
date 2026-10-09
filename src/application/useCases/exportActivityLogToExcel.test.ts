import { describe, it, expect } from 'vitest'
import { readSheet } from 'read-excel-file/node'
import { exportActivityLogToExcel } from './exportActivityLogToExcel'
import type { ActivityLog } from '../../domain/entities/activityLog'

function log(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 'l1',
    actorId: 'u1',
    actorName: 'Dev Admin',
    actorNameAr: null,
    actorRole: 'super_admin',
    action: 'visit_reassigned',
    targetType: 'visit',
    targetId: 'v1',
    details: 'Reassigned visit to Fatima Al-Rashid',
    detailsAr: 'تم إعادة تعيين الزيارة إلى فاطمة الرشيد',
    createdAt: new Date('2026-08-31T14:06:22'),
    ...overrides,
  }
}

async function readRows(bufferPromise: Promise<Buffer>): Promise<Record<string, unknown>[]> {
  const buffer = await bufferPromise
  const [header, ...dataRows] = await readSheet(buffer, 'Activity log')
  return dataRows.map((row) => Object.fromEntries(header.map((h, i) => [String(h), row[i]])))
}

describe('exportActivityLogToExcel', () => {
  it('produces one sheet with a row per log entry', async () => {
    const rows = await readRows(exportActivityLogToExcel([log(), log({ id: 'l2' })]))
    expect(rows).toHaveLength(2)
  })

  it('carries the severity alongside the raw action code', async () => {
    const [row] = await readRows(exportActivityLogToExcel([log({ action: 'account_deleted' })]))
    expect(row.Action).toBe('account_deleted')
    expect(row.Severity).toBe('destructive')
  })

  it('writes a dash when there is no recorded detail', async () => {
    const [row] = await readRows(exportActivityLogToExcel([log({ details: null })]))
    expect(row.Details).toBe('—')
  })

  it('defuses a detail string that would run as a formula', async () => {
    const [row] = await readRows(exportActivityLogToExcel([log({ details: '=SUM(A1:A9)' })]))
    expect(String(row.Details).startsWith("'")).toBe(true)
  })

  it('exports translated column headers and Arabic details in Arabic mode', async () => {
    const buffer = await exportActivityLogToExcel([log()], 'ar')
    const [header, ...dataRows] = await readSheet(buffer, 'سجل النشاط')
    expect(header).toEqual([
      'الوقت',
      'الفاعل',
      'الدور',
      'الخطورة',
      'الإجراء',
      'نوع الهدف',
      'معرّف الهدف',
      'التفاصيل',
    ])
    const row = Object.fromEntries(header.map((h, i) => [String(h), dataRows[0][i]]))
    expect(row['التفاصيل']).toBe('تم إعادة تعيين الزيارة إلى فاطمة الرشيد')
  })
})
