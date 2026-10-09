import writeExcelFile from 'write-excel-file/node'
import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { Application, ApplicationKind } from '../../domain/entities/application'
import { translations } from '../../i18n/translations'
import { formatKuwaitDateTime } from '../../domain/time/formatKuwaitDateTime'
import { sanitizeForSpreadsheet } from '../export/sanitizeForSpreadsheet'
import { holdsScopeForApplicationKind } from '../../domain/access/applicationScope'

export type ExportApplicationsResult = { ok: true; buffer: Buffer } | { ok: false; reason: string }

interface ApplicationSheetRow {
  Name: string
  Phone: string
  Service: string
  Status: string
  'Status Note': string
  'Reference No.': string
  'Submitted At': string
  'Existing Account Username': string
  'Student Source': string
  Notes: string
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
    'Status Note': a.statusNote ? sanitizeForSpreadsheet(a.statusNote) : '—',
    'Reference No.': a.referenceNumber ? sanitizeForSpreadsheet(a.referenceNumber) : '—',
    'Submitted At': formatKuwaitDateTime(a.createdAt),
    'Existing Account Username': a.fields['existing-account-username']
      ? sanitizeForSpreadsheet(a.fields['existing-account-username'])
      : '—',
    'Student Source': a.fields['student-source']
      ? sanitizeForSpreadsheet(a.fields['student-source'])
      : '—',
    Notes: a.fields.notes ? sanitizeForSpreadsheet(a.fields.notes) : '—',
  }))
}

const APPLICATION_HEADERS: Record<'en' | 'ar', Record<keyof ApplicationSheetRow, string>> = {
  en: {
    Name: 'Name',
    Phone: 'Phone',
    Service: 'Service',
    Status: 'Status',
    'Status Note': 'Status Note',
    'Reference No.': 'Reference No.',
    'Submitted At': 'Submitted At',
    'Existing Account Username': 'Existing Account Username',
    'Student Source': 'Student Source',
    Notes: 'Notes',
  },
  ar: {
    Name: 'الاسم',
    Phone: 'الهاتف',
    Service: 'الخدمة',
    Status: 'الحالة',
    'Status Note': 'ملاحظة الحالة',
    'Reference No.': 'الرقم المرجعي',
    'Submitted At': 'تاريخ التقديم',
    'Existing Account Username': 'اسم المستخدم للحساب الحالي',
    'Student Source': 'مصدر الطالب',
    Notes: 'ملاحظات',
  },
}

function applicationsColumns(language: 'en' | 'ar') {
  const h = APPLICATION_HEADERS[language]
  return [
    { header: h.Name, cell: (r: ApplicationSheetRow) => ({ value: r.Name }) },
    { header: h.Phone, cell: (r: ApplicationSheetRow) => ({ value: r.Phone }) },
    { header: h.Service, cell: (r: ApplicationSheetRow) => ({ value: r.Service }) },
    { header: h.Status, cell: (r: ApplicationSheetRow) => ({ value: r.Status }) },
    { header: h['Status Note'], cell: (r: ApplicationSheetRow) => ({ value: r['Status Note'] }) },
    {
      header: h['Reference No.'],
      cell: (r: ApplicationSheetRow) => ({ value: r['Reference No.'] }),
    },
    {
      header: h['Submitted At'],
      cell: (r: ApplicationSheetRow) => ({ value: r['Submitted At'] }),
    },
  ]
}

// أعمدة IELTS الجديدة نضيفها بس لصادرات الاختبارات — ما تنطبق على طلبات الفيزا أصلاً
function examOnlyColumns(language: 'en' | 'ar') {
  const h = APPLICATION_HEADERS[language]
  return [
    {
      header: h['Existing Account Username'],
      cell: (r: ApplicationSheetRow) => ({ value: r['Existing Account Username'] }),
    },
    {
      header: h['Student Source'],
      cell: (r: ApplicationSheetRow) => ({ value: r['Student Source'] }),
    },
    { header: h.Notes, cell: (r: ApplicationSheetRow) => ({ value: r.Notes }) },
  ]
}

const APPLICATION_SHEET_NAMES: Record<'en' | 'ar', { visa: string; exam: string }> = {
  en: { visa: 'Visa applications', exam: 'Exam applications' },
  ar: { visa: 'طلبات التأشيرة', exam: 'طلبات الاختبارات' },
}

export async function exportApplicationsToExcel(
  actorRole: UserRole,
  actorScopes: SpecializationScope[],
  kind: ApplicationKind,
  applications: Application[],
  language: 'en' | 'ar' = 'en'
): Promise<ExportApplicationsResult> {
  if (actorRole !== 'super_admin') {
    if (actorRole !== 'counselor' || !holdsScopeForApplicationKind(actorScopes, kind)) {
      return { ok: false, reason: 'notAuthorizedScope' }
    }
  }

  const buffer = (await writeExcelFile(buildApplicationsRows(applications, language), {
    columns:
      kind === 'exam'
        ? [...applicationsColumns(language), ...examOnlyColumns(language)]
        : applicationsColumns(language),
    sheet:
      kind === 'visa'
        ? APPLICATION_SHEET_NAMES[language].visa
        : APPLICATION_SHEET_NAMES[language].exam,
  }).toBuffer()) as Buffer

  return { ok: true, buffer }
}
