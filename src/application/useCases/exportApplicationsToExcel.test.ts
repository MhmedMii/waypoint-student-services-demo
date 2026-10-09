import { describe, it, expect } from 'vitest'
import readExcelFile, { readSheet } from 'read-excel-file/node'
import { exportApplicationsToExcel } from './exportApplicationsToExcel'
import type { Application } from '../../domain/entities/application'

const app: Application = {
  id: 'a1',
  applicationNumber: 'VISA-0001',
  kind: 'visa',
  serviceCode: 'uk-student',
  name: 'Fictional Student R',
  phone: '51234567',
  email: null,
  fields: {},
  status: 'pending',
  statusNote: null,
  referenceNumber: null,
  counselorId: null,
  paymentUrl: null,
  acceptedAt: null,
  closedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date(),
}

function rowsToObjects(rows: unknown[][]): Record<string, unknown>[] {
  const [header, ...dataRows] = rows
  return dataRows.map((row) => Object.fromEntries(header.map((h, i) => [String(h), row[i]])))
}

describe('exportApplicationsToExcel', () => {
  it('allows super_admin and produces a sheet with expected row count', async () => {
    const result = await exportApplicationsToExcel('super_admin', [], 'visa', [app])
    expect(result.ok).toBe(true)
    if (result.ok) {
      const sheets = await readExcelFile(result.buffer)
      expect(sheets.map((s) => s.sheet)).toContain('Visa applications')
      const rows = rowsToObjects(await readSheet(result.buffer, 'Visa applications'))
      expect(rows).toHaveLength(1)
    }
  })

  it('allows a scoped counselor', async () => {
    const result = await exportApplicationsToExcel('counselor', ['visa_services'], 'visa', [app])
    expect(result.ok).toBe(true)
  })

  it('rejects an unscoped counselor', async () => {
    const result = await exportApplicationsToExcel('counselor', ['exam_services'], 'visa', [app])
    expect(result.ok).toBe(false)
  })

  it('rejects an admin actor', async () => {
    const result = await exportApplicationsToExcel('admin', ['visa_services'], 'visa', [app])
    expect(result.ok).toBe(false)
  })

  it('neutralizes formula-injection-style status notes', async () => {
    const risky = { ...app, statusNote: '=HYPERLINK("http://evil.example")' }
    const result = await exportApplicationsToExcel('super_admin', [], 'visa', [risky])
    expect(result.ok).toBe(true)
    if (result.ok) {
      const rows = rowsToObjects(await readSheet(result.buffer, 'Visa applications'))
      expect(String(rows[0]['Status Note']).startsWith("'=")).toBe(true)
    }
  })

  it('adds IELTS-specific columns for exam exports, populated from fields', async () => {
    const ieltsApp: Application = {
      ...app,
      kind: 'exam',
      serviceCode: 'ielts',
      fields: {
        'existing-account-username': 'student@example.com',
        'student-source': 'Walk in',
        notes: 'Prefers morning slots',
      },
    }
    const result = await exportApplicationsToExcel('super_admin', [], 'exam', [ieltsApp])
    expect(result.ok).toBe(true)
    if (result.ok) {
      const rows = rowsToObjects(await readSheet(result.buffer, 'Exam applications'))
      expect(rows[0]['Existing Account Username']).toBe('student@example.com')
      expect(rows[0]['Student Source']).toBe('Walk in')
      expect(rows[0].Notes).toBe('Prefers morning slots')
    }
  })

  it('does not add IELTS-specific columns to visa exports', async () => {
    const result = await exportApplicationsToExcel('super_admin', [], 'visa', [app])
    expect(result.ok).toBe(true)
    if (result.ok) {
      const rows = rowsToObjects(await readSheet(result.buffer, 'Visa applications'))
      expect(rows[0]['Existing Account Username']).toBeUndefined()
      expect(rows[0]['Student Source']).toBeUndefined()
      expect(rows[0].Notes).toBeUndefined()
    }
  })

  it('translates the sheet name, headers, service, and status in Arabic mode', async () => {
    const result = await exportApplicationsToExcel('super_admin', [], 'visa', [app], 'ar')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const sheets = await readExcelFile(result.buffer)
      expect(sheets.map((s) => s.sheet)).toContain('طلبات التأشيرة')
      const rows = rowsToObjects(await readSheet(result.buffer, 'طلبات التأشيرة'))
      expect(rows[0]['الخدمة']).toBe('بريطانيا — تأشيرة طالب')
      expect(rows[0]['الحالة']).toBe('قيد الانتظار')
    }
  })
})
