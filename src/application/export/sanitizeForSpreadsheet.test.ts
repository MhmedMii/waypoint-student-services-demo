import { describe, it, expect } from 'vitest'
import { readSheet } from 'read-excel-file/node'
import { sanitizeForSpreadsheet, FORMULA_TRIGGER_CHARS } from './sanitizeForSpreadsheet'
import { exportKpisToExcel, type ClientExportRow } from '../useCases/exportKpisToExcel'
import { exportMyStudentsToExcel } from '../useCases/exportMyStudentsToExcel'
import { exportActivityLogToExcel } from '../useCases/exportActivityLogToExcel'
import { exportApplicationsToExcel } from '../useCases/exportApplicationsToExcel'
import type { AdminKpis } from '../useCases/getAdminKpis'
import type { Visit } from '../../domain/entities/visit'
import type { Application } from '../../domain/entities/application'
import type { ActivityLog } from '../../domain/entities/activityLog'

// اسم عميل مكتوب "=HYPERLINK(...)" يصير رابطًا يضغطه موظف بالمكتب. كل الأحرف
// الأربعة، بكل ملف تصدير، مقروءة من ملف xlsx حقيقي — مو من دالة معزولة
const TRIGGERS = ['=', '+', '-', '@'] as const
const payload = (trigger: string) => `${trigger}HYPERLINK("http://evil.example","click")`

function rowsToObjects(rows: unknown[][]): Record<string, unknown>[] {
  const [header, ...dataRows] = rows
  return dataRows.map((row) => Object.fromEntries(header.map((h, i) => [String(h), row[i]])))
}

async function cell(buffer: Buffer, sheet: string, column: string): Promise<string> {
  return String(rowsToObjects(await readSheet(buffer, sheet))[0][column])
}

describe('sanitizeForSpreadsheet', () => {
  it.each(TRIGGERS)('neutralises a value starting with %s', (trigger) => {
    expect(sanitizeForSpreadsheet(payload(trigger))).toBe(`'${payload(trigger)}`)
  })

  it('guards exactly the four characters it names', () => {
    expect(FORMULA_TRIGGER_CHARS).toEqual(['=', '+', '-', '@'])
  })

  it('leaves an ordinary value untouched', () => {
    expect(sanitizeForSpreadsheet('Fictional Student R')).toBe('Fictional Student R')
    expect(sanitizeForSpreadsheet('سارة الفهد')).toBe('سارة الفهد')
  })

  // الشرطة بنص الاسم مو بأوله — ما نلمسها
  it('only looks at the first character', () => {
    expect(sanitizeForSpreadsheet('Al-Fahad')).toBe('Al-Fahad')
  })

  it('survives an empty string', () => {
    expect(sanitizeForSpreadsheet('')).toBe('')
  })
})

// تنفيذ واحد وأربعة أماكن تناديه: لو انشال الحارس، الأربعة يطيحون سوا
describe('every export runs names through the one guard', () => {
  const kpis: AdminKpis = {
    totalByType: { new: 1, follow_up: 0, visa: 0 },
    countryBreakdown: [],
    funnel: { next: 0, closed: 1 },
    counselorPerformance: [],
    turnaround: { within24h: 0, over24h: 0, inProgress: 0 },
    followUpsDue: { total: 0, overdue: 0 },
  }

  function visit(name: string): Visit {
    return {
      id: 'v1',
      type: 'new',
      name,
      phone: '51234567',
      desiredCountry: 'US',
      counselorId: null,
      linkedVisitId: null,
      status: 'closed',
      studentStatus: 'closed',
      pickedUpAt: null,
      closedAt: new Date('2026-09-01T10:00:00Z'),
      followUpDueAt: null,
      createdBy: null,
      createdAt: new Date('2026-09-01T09:00:00Z'),
      updatedAt: new Date('2026-09-01T10:00:00Z'),
    } as Visit
  }

  function application(name: string): Application {
    return {
      id: 'a1',
      applicationNumber: 'VISA-0001',
      kind: 'visa',
      serviceCode: 'uk-student',
      name,
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
      createdAt: new Date('2026-09-01T09:00:00Z'),
      updatedAt: new Date('2026-09-01T09:00:00Z'),
    } as Application
  }

  function log(actorName: string): ActivityLog {
    return {
      id: 'l1',
      actorId: null,
      actorName,
      actorNameAr: null,
      actorRole: 'system',
      action: 'visit_created',
      targetType: 'visit',
      targetId: 'v1',
      details: 'created',
      detailsAr: null,
      createdAt: new Date('2026-09-01T09:00:00Z'),
    } as ActivityLog
  }

  it.each(TRIGGERS)('KPI export neutralises a client name starting with %s', async (t) => {
    const clients: ClientExportRow[] = [
      {
        name: payload(t),
        phone: '51234567',
        desiredCountry: 'US',
        counselorName: null,
        visitCount: 1,
        servicesTaken: 'New client (2026-09-01)',
      },
    ]
    const result = await exportKpisToExcel('admin', kpis, clients)
    expect(result.ok).toBe(true)
    if (result.ok) expect(await cell(result.buffer, 'Clients', 'Name')).toBe(`'${payload(t)}`)
  })

  it.each(TRIGGERS)('My Students export neutralises a name starting with %s', async (t) => {
    const buffer = await exportMyStudentsToExcel([visit(payload(t))], [])
    expect(await cell(buffer, 'Visits', 'Name')).toBe(`'${payload(t)}`)
  })

  it.each(TRIGGERS)('activity-log export neutralises an actor starting with %s', async (t) => {
    const buffer = await exportActivityLogToExcel([log(payload(t))])
    expect(await cell(buffer, 'Activity log', 'Actor')).toBe(`'${payload(t)}`)
  })

  it.each(TRIGGERS)('applications export neutralises a name starting with %s', async (t) => {
    const result = await exportApplicationsToExcel('super_admin', [], 'visa', [
      application(payload(t)),
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(await cell(result.buffer, 'Visa applications', 'Name')).toBe(`'${payload(t)}`)
    }
  })
})
