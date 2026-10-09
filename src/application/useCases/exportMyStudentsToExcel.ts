import writeExcelFile, { getSheetData } from 'write-excel-file/node'
import type { Visit } from '../../domain/entities/visit'
import type { Application } from '../../domain/entities/application'
import { translations } from '../../i18n/translations'
import { formatKuwaitDateTime } from '../../domain/time/formatKuwaitDateTime'
import { sanitizeForSpreadsheet } from '../export/sanitizeForSpreadsheet'

const VISIT_STATUS_KEY = { next: 'statusOpen', closed: 'statusClosed' } as const
const STUDENT_STATUS_KEY = {
  waiting: 'statusWaiting',
  in_session: 'statusInSession',
  follow_up_needed: 'statusFollowUpNeeded',
  closed: 'statusClosed',
} as const

interface VisitSheetRow {
  Name: string
  Phone: string
  Type: string
  Status: string
  'Student Status': string
  Submitted: string
  'Picked Up': string
  Closed: string
}

function buildVisitsRows(visits: Visit[], language: 'en' | 'ar'): VisitSheetRow[] {
  const dict = translations[language]
  return visits.map((v) => ({
    Name: sanitizeForSpreadsheet(v.name),
    Phone: v.phone,
    Type: dict.visits[v.type],
    Status: dict.visits[VISIT_STATUS_KEY[v.status]],
    'Student Status': v.studentStatus ? dict.students[STUDENT_STATUS_KEY[v.studentStatus]] : '—',
    Submitted: formatKuwaitDateTime(v.createdAt),
    'Picked Up': v.pickedUpAt ? formatKuwaitDateTime(v.pickedUpAt) : '—',
    Closed: v.closedAt ? formatKuwaitDateTime(v.closedAt) : '—',
  }))
}

const VISIT_SHEET_HEADERS: Record<'en' | 'ar', Record<keyof VisitSheetRow, string>> = {
  en: {
    Name: 'Name',
    Phone: 'Phone',
    Type: 'Type',
    Status: 'Status',
    'Student Status': 'Student Status',
    Submitted: 'Submitted',
    'Picked Up': 'Picked Up',
    Closed: 'Closed',
  },
  ar: {
    Name: 'الاسم',
    Phone: 'الهاتف',
    Type: 'النوع',
    Status: 'الحالة',
    'Student Status': 'حالة الطالب',
    Submitted: 'تاريخ التقديم',
    'Picked Up': 'تاريخ الاستلام',
    Closed: 'تاريخ الإغلاق',
  },
}

function visitsColumns(language: 'en' | 'ar') {
  const h = VISIT_SHEET_HEADERS[language]
  return [
    { header: h.Name, cell: (r: VisitSheetRow) => ({ value: r.Name }) },
    { header: h.Phone, cell: (r: VisitSheetRow) => ({ value: r.Phone }) },
    { header: h.Type, cell: (r: VisitSheetRow) => ({ value: r.Type }) },
    { header: h.Status, cell: (r: VisitSheetRow) => ({ value: r.Status }) },
    {
      header: h['Student Status'],
      cell: (r: VisitSheetRow) => ({ value: r['Student Status'] }),
    },
    { header: h.Submitted, cell: (r: VisitSheetRow) => ({ value: r.Submitted }) },
    { header: h['Picked Up'], cell: (r: VisitSheetRow) => ({ value: r['Picked Up'] }) },
    { header: h.Closed, cell: (r: VisitSheetRow) => ({ value: r.Closed }) },
  ]
}

interface ApplicationSheetRow {
  Name: string
  Phone: string
  Service: string
  Status: string
  Submitted: string
  Accepted: string
  Closed: string
}

function buildApplicationsRows(
  applications: Application[],
  language: 'en' | 'ar'
): ApplicationSheetRow[] {
  const dict = translations[language]
  return applications.map((a) => ({
    Name: sanitizeForSpreadsheet(a.name),
    Phone: a.phone,
    Service: (dict.apply as Record<string, string>)[a.serviceCode] ?? a.serviceCode,
    Status: dict.applications[a.status],
    Submitted: formatKuwaitDateTime(a.createdAt),
    Accepted: a.acceptedAt ? formatKuwaitDateTime(a.acceptedAt) : '—',
    Closed: a.closedAt ? formatKuwaitDateTime(a.closedAt) : '—',
  }))
}

const APPLICATION_SHEET_HEADERS: Record<'en' | 'ar', Record<keyof ApplicationSheetRow, string>> = {
  en: {
    Name: 'Name',
    Phone: 'Phone',
    Service: 'Service',
    Status: 'Status',
    Submitted: 'Submitted',
    Accepted: 'Accepted',
    Closed: 'Closed',
  },
  ar: {
    Name: 'الاسم',
    Phone: 'الهاتف',
    Service: 'الخدمة',
    Status: 'الحالة',
    Submitted: 'تاريخ التقديم',
    Accepted: 'تاريخ القبول',
    Closed: 'تاريخ الإغلاق',
  },
}

function applicationsColumns(language: 'en' | 'ar') {
  const h = APPLICATION_SHEET_HEADERS[language]
  return [
    { header: h.Name, cell: (r: ApplicationSheetRow) => ({ value: r.Name }) },
    { header: h.Phone, cell: (r: ApplicationSheetRow) => ({ value: r.Phone }) },
    { header: h.Service, cell: (r: ApplicationSheetRow) => ({ value: r.Service }) },
    { header: h.Status, cell: (r: ApplicationSheetRow) => ({ value: r.Status }) },
    { header: h.Submitted, cell: (r: ApplicationSheetRow) => ({ value: r.Submitted }) },
    { header: h.Accepted, cell: (r: ApplicationSheetRow) => ({ value: r.Accepted }) },
    { header: h.Closed, cell: (r: ApplicationSheetRow) => ({ value: r.Closed }) },
  ]
}

const MY_STUDENTS_SHEET_NAMES: Record<'en' | 'ar', { visits: string; applications: string }> = {
  en: { visits: 'Visits', applications: 'Applications' },
  ar: { visits: 'الزيارات', applications: 'الطلبات' },
}

export async function exportMyStudentsToExcel(
  visits: Visit[],
  applications: Application[],
  language: 'en' | 'ar' = 'en'
): Promise<Buffer> {
  const sheetNames = MY_STUDENTS_SHEET_NAMES[language]
  const buffer = (await writeExcelFile([
    {
      data: getSheetData(buildVisitsRows(visits, language), visitsColumns(language)),
      sheet: sheetNames.visits,
    },
    {
      data: getSheetData(
        buildApplicationsRows(applications, language),
        applicationsColumns(language)
      ),
      sheet: sheetNames.applications,
    },
  ]).toBuffer()) as Buffer
  return buffer
}
