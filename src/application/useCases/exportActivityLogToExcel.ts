import writeExcelFile from 'write-excel-file/node'
import { severityOf } from '../../domain/entities/activityLog'
import type { ActivityLog } from '../../domain/entities/activityLog'
import { formatKuwaitDateTime } from '../../domain/time/formatKuwaitDateTime'
import { sanitizeForSpreadsheet } from '../export/sanitizeForSpreadsheet'

interface ActivityLogSheetRow {
  Time: string
  Actor: string
  Role: string
  Severity: string
  Action: string
  'Target type': string
  'Target id': string
  Details: string
}

function buildActivityLogRows(logs: ActivityLog[], language: 'en' | 'ar'): ActivityLogSheetRow[] {
  return logs.map((log) => ({
    Time: formatKuwaitDateTime(log.createdAt),
    Actor: sanitizeForSpreadsheet(
      language === 'ar' ? log.actorNameAr || log.actorName : log.actorName
    ),
    Role: log.actorRole,
    Severity: severityOf(log.action),
    Action: log.action,
    'Target type': log.targetType,
    'Target id': log.targetId,
    Details: sanitizeForSpreadsheet(
      (language === 'ar' ? log.detailsAr || log.details : log.details) ?? '—'
    ),
  }))
}

// عناوين الأعمدة — إنجليزي دايمًا هي المفتاح الداخلي (ActivityLogSheetRow)،
// بس العنوان المعروض بالإكسل يترجم حسب لغة الطالب
const ACTIVITY_LOG_HEADERS: Record<'en' | 'ar', Record<keyof ActivityLogSheetRow, string>> = {
  en: {
    Time: 'Time',
    Actor: 'Actor',
    Role: 'Role',
    Severity: 'Severity',
    Action: 'Action',
    'Target type': 'Target type',
    'Target id': 'Target id',
    Details: 'Details',
  },
  ar: {
    Time: 'الوقت',
    Actor: 'الفاعل',
    Role: 'الدور',
    Severity: 'الخطورة',
    Action: 'الإجراء',
    'Target type': 'نوع الهدف',
    'Target id': 'معرّف الهدف',
    Details: 'التفاصيل',
  },
}

function activityLogColumns(language: 'en' | 'ar') {
  const headers = ACTIVITY_LOG_HEADERS[language]
  return [
    { header: headers.Time, cell: (r: ActivityLogSheetRow) => ({ value: r.Time }) },
    { header: headers.Actor, cell: (r: ActivityLogSheetRow) => ({ value: r.Actor }) },
    { header: headers.Role, cell: (r: ActivityLogSheetRow) => ({ value: r.Role }) },
    { header: headers.Severity, cell: (r: ActivityLogSheetRow) => ({ value: r.Severity }) },
    { header: headers.Action, cell: (r: ActivityLogSheetRow) => ({ value: r.Action }) },
    {
      header: headers['Target type'],
      cell: (r: ActivityLogSheetRow) => ({ value: r['Target type'] }),
    },
    {
      header: headers['Target id'],
      cell: (r: ActivityLogSheetRow) => ({ value: r['Target id'] }),
    },
    { header: headers.Details, cell: (r: ActivityLogSheetRow) => ({ value: r.Details }) },
  ]
}

export async function exportActivityLogToExcel(
  logs: ActivityLog[],
  language: 'en' | 'ar' = 'en'
): Promise<Buffer> {
  const buffer = (await writeExcelFile(buildActivityLogRows(logs, language), {
    columns: activityLogColumns(language),
    sheet: language === 'ar' ? 'سجل النشاط' : 'Activity log',
  }).toBuffer()) as Buffer
  return buffer
}
