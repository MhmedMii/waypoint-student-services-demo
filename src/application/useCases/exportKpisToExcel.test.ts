import { describe, it, expect } from 'vitest'
import readExcelFile, { readSheet } from 'read-excel-file/node'
import { exportKpisToExcel, type ClientExportRow } from './exportKpisToExcel'
import type { AdminKpis } from './getAdminKpis'

const kpis: AdminKpis = {
  totalByType: { new: 21, follow_up: 12, visa: 4 },
  countryBreakdown: [
    { country: 'US', count: 10 },
    { country: 'UK', count: 8 },
  ],
  funnel: { next: 12, closed: 9 },
  counselorPerformance: [
    {
      counselorId: 'demoCounselorOne',
      counselorName: 'Demo Counselor One',
      counselorNameAr: null,
      active: true,
      lastSeenAt: null,
      visitCount: 14,
      closedCount: 9,
      avgHandlingMs: 1080000,
      instantCloseCount: 0,
      instantCloseAvgMs: null,
      leftOpenCount: 0,
      leftOpenAvgMs: null,
      applicationCount: 2,
    },
  ],
  turnaround: { within24h: 5, over24h: 2, inProgress: 3 },
  followUpsDue: { total: 0, overdue: 0 },
}

const clients: ClientExportRow[] = [
  {
    name: 'Test Client',
    phone: '96550000000',
    desiredCountry: 'US',
    counselorName: 'Demo Counselor One',
    visitCount: 2,
    servicesTaken: 'New client (2026-08-01); Follow-up (2026-08-10)',
  },
]

function rowsToObjects(rows: unknown[][]): Record<string, unknown>[] {
  const [header, ...dataRows] = rows
  return dataRows.map((row) => Object.fromEntries(header.map((h, i) => [String(h), row[i]])))
}

describe('exportKpisToExcel', () => {
  it('produces a readable workbook buffer for admin', async () => {
    const result = await exportKpisToExcel('admin', kpis, clients)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const sheets = await readExcelFile(result.buffer)
      const sheetNames = sheets.map((s) => s.sheet)
      expect(sheetNames).toContain('Counselor performance')
      expect(sheetNames).toContain('Clients')
      const clientsRows = rowsToObjects(await readSheet(result.buffer, 'Clients'))
      expect(clientsRows[0]).toMatchObject({
        Name: 'Test Client',
        'Phone Number': '96550000000',
        'Desired Country': 'US',
        'Counselor Assigned': 'Demo Counselor One',
        'Visit Count': 2,
        'Services Taken': 'New client (2026-08-01); Follow-up (2026-08-10)',
      })
    }
  })

  it('produces a workbook buffer for super_admin too', async () => {
    const result = await exportKpisToExcel('super_admin', kpis, clients)
    expect(result.ok).toBe(true)
  })

  it('rejects a counselor actor', async () => {
    const result = await exportKpisToExcel('counselor', kpis, clients)
    expect(result.ok).toBe(false)
  })

  it('shows the counselor name, not their raw id, in the counselor performance sheet', async () => {
    const result = await exportKpisToExcel('admin', kpis, clients)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const rows = rowsToObjects(await readSheet(result.buffer, 'Counselor performance'))
      expect(rows[0].Counselor).toBe('Demo Counselor One')
      expect(rows[0]['Counselor ID']).toBeUndefined()
      expect(Object.values(rows[0])).not.toContain('demoCounselorOne')
    }
  })

  it('shows the translated unassigned label for the unassigned bucket row', async () => {
    const kpisWithUnassigned: AdminKpis = {
      ...kpis,
      counselorPerformance: [
        ...kpis.counselorPerformance,
        {
          counselorId: 'unassigned',
          counselorName: '',
          counselorNameAr: null,
          active: true,
          lastSeenAt: null,
          visitCount: 1,
          closedCount: 0,
          avgHandlingMs: null,
          instantCloseCount: 0,
          instantCloseAvgMs: null,
          leftOpenCount: 0,
          leftOpenAvgMs: null,
          applicationCount: 0,
        },
      ],
    }
    const result = await exportKpisToExcel('admin', kpisWithUnassigned, clients)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const rows = rowsToObjects(await readSheet(result.buffer, 'Counselor performance'))
      expect(rows[1].Counselor).toBe('— unassigned —')
    }
  })

  it('defuses formula-injection payloads in the clients sheet', async () => {
    const riskyClients: ClientExportRow[] = [
      {
        name: '=HYPERLINK("http://evil.example")',
        phone: '96550000001',
        desiredCountry: null,
        counselorName: '+2+3+cmd|"/C calc"!A1',
        visitCount: 1,
        servicesTaken: '=1+1',
      },
    ]
    const result = await exportKpisToExcel('admin', kpis, riskyClients)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const rows = rowsToObjects(await readSheet(result.buffer, 'Clients'))
      expect(String(rows[0].Name).startsWith("'=")).toBe(true)
      expect(String(rows[0]['Counselor Assigned']).startsWith("'+")).toBe(true)
      expect(String(rows[0]['Services Taken']).startsWith("'=")).toBe(true)
    }
  })
})
