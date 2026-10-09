import writeExcelFile, { getSheetData } from 'write-excel-file/node'
import type { UserRole } from '../../domain/entities/user'
import type { AdminKpis } from './getAdminKpis'
import { UNASSIGNED_COUNSELOR_ID } from '../../domain/routing/unassignedCounselor'
import { translations } from '../../i18n/translations'
import { COUNTRY_LABEL_KEYS, isKnownCountryScope } from '../../i18n/countryLabels'
import { localizedName } from '../../i18n/localizedName'
import { sanitizeForSpreadsheet } from '../export/sanitizeForSpreadsheet'

export type ExportKpisResult = { ok: true; buffer: Buffer } | { ok: false; reason: string }

function countryLabel(value: string, language: 'en' | 'ar'): string {
  return isKnownCountryScope(value)
    ? translations[language].countries[COUNTRY_LABEL_KEYS[value]]
    : value
}

export interface ClientExportRow {
  name: string
  phone: string
  desiredCountry: string | null
  counselorName: string | null
  visitCount: number
  servicesTaken: string
}

interface ClientSheetRow {
  Name: string
  'Phone Number': string
  'Desired Country': string
  'Counselor Assigned': string
  'Visit Count': number
  'Services Taken': string
}

function buildClientsRows(clients: ClientExportRow[], language: 'en' | 'ar'): ClientSheetRow[] {
  return clients.map((c) => ({
    Name: sanitizeForSpreadsheet(c.name),
    'Phone Number': c.phone,
    'Desired Country': c.desiredCountry ? countryLabel(c.desiredCountry, language) : '—',
    'Counselor Assigned': c.counselorName ? sanitizeForSpreadsheet(c.counselorName) : '—',
    'Visit Count': c.visitCount,
    'Services Taken': sanitizeForSpreadsheet(c.servicesTaken),
  }))
}

const CLIENT_HEADERS: Record<'en' | 'ar', Record<keyof ClientSheetRow, string>> = {
  en: {
    Name: 'Name',
    'Phone Number': 'Phone Number',
    'Desired Country': 'Desired Country',
    'Counselor Assigned': 'Counselor Assigned',
    'Visit Count': 'Visit Count',
    'Services Taken': 'Services Taken',
  },
  ar: {
    Name: 'الاسم',
    'Phone Number': 'رقم الهاتف',
    'Desired Country': 'الدولة المطلوبة',
    'Counselor Assigned': 'المستشار المسؤول',
    'Visit Count': 'عدد الزيارات',
    'Services Taken': 'الخدمات المُقدَّمة',
  },
}

function clientsColumns(language: 'en' | 'ar') {
  const h = CLIENT_HEADERS[language]
  return [
    { header: h.Name, cell: (r: ClientSheetRow) => ({ value: r.Name }) },
    { header: h['Phone Number'], cell: (r: ClientSheetRow) => ({ value: r['Phone Number'] }) },
    {
      header: h['Desired Country'],
      cell: (r: ClientSheetRow) => ({ value: r['Desired Country'] }),
    },
    {
      header: h['Counselor Assigned'],
      cell: (r: ClientSheetRow) => ({ value: r['Counselor Assigned'] }),
    },
    { header: h['Visit Count'], cell: (r: ClientSheetRow) => ({ value: r['Visit Count'] }) },
    {
      header: h['Services Taken'],
      cell: (r: ClientSheetRow) => ({ value: r['Services Taken'] }),
    },
  ]
}

interface CounselorSheetRow {
  Counselor: string
  Visits: number
  Closed: number
  'Avg handling (min)': number | string
}

function buildCounselorRows(kpis: AdminKpis, language: 'en' | 'ar'): CounselorSheetRow[] {
  return kpis.counselorPerformance.map((c) => ({
    Counselor: sanitizeForSpreadsheet(
      c.counselorId === UNASSIGNED_COUNSELOR_ID
        ? translations[language].admin.unassignedCounselor
        : localizedName(c.counselorName, c.counselorNameAr, language)
    ),
    Visits: c.visitCount,
    Closed: c.closedCount,
    'Avg handling (min)': c.avgHandlingMs !== null ? Math.round(c.avgHandlingMs / 60000) : '—',
  }))
}

const COUNSELOR_HEADERS: Record<'en' | 'ar', Record<keyof CounselorSheetRow, string>> = {
  en: {
    Counselor: 'Counselor',
    Visits: 'Visits',
    Closed: 'Closed',
    'Avg handling (min)': 'Avg handling (min)',
  },
  ar: {
    Counselor: 'المستشار',
    Visits: 'الزيارات',
    Closed: 'المغلقة',
    'Avg handling (min)': 'متوسط وقت المعالجة (دقيقة)',
  },
}

function counselorColumns(language: 'en' | 'ar') {
  const h = COUNSELOR_HEADERS[language]
  return [
    { header: h.Counselor, cell: (r: CounselorSheetRow) => ({ value: r.Counselor }) },
    { header: h.Visits, cell: (r: CounselorSheetRow) => ({ value: r.Visits }) },
    { header: h.Closed, cell: (r: CounselorSheetRow) => ({ value: r.Closed }) },
    {
      header: h['Avg handling (min)'],
      cell: (r: CounselorSheetRow) => ({ value: r['Avg handling (min)'] }),
    },
  ]
}

interface CountrySheetRow {
  Country: string
  Count: number
}

function buildCountryRows(kpis: AdminKpis, language: 'en' | 'ar'): CountrySheetRow[] {
  return kpis.countryBreakdown.map((c) => ({
    Country: countryLabel(c.country, language),
    Count: c.count,
  }))
}

const COUNTRY_SHEET_HEADERS: Record<'en' | 'ar', Record<keyof CountrySheetRow, string>> = {
  en: { Country: 'Country', Count: 'Count' },
  ar: { Country: 'الدولة', Count: 'العدد' },
}

function countryColumns(language: 'en' | 'ar') {
  const h = COUNTRY_SHEET_HEADERS[language]
  return [
    { header: h.Country, cell: (r: CountrySheetRow) => ({ value: r.Country }) },
    { header: h.Count, cell: (r: CountrySheetRow) => ({ value: r.Count }) },
  ]
}

interface SummarySheetRow {
  Metric: string
  Value: number
}

const SUMMARY_METRIC_LABELS: Record<
  'en' | 'ar',
  {
    newClients: string
    followUps: string
    visaOther: string
    statusNext: string
    statusClosed: string
    within24h: string
    over24h: string
    inProgress: string
  }
> = {
  en: {
    newClients: 'New clients',
    followUps: 'Follow-ups',
    visaOther: 'Visa / other',
    statusNext: 'Status: next',
    statusClosed: 'Status: closed',
    within24h: 'Applications finished within 24h',
    over24h: 'Applications finished over 24h',
    inProgress: 'Applications still in progress',
  },
  ar: {
    newClients: 'عملاء جدد',
    followUps: 'متابعات',
    visaOther: 'تأشيرة / أخرى',
    statusNext: 'الحالة: مفتوحة',
    statusClosed: 'الحالة: مغلقة',
    within24h: 'طلبات أُنجزت خلال 24 ساعة',
    over24h: 'طلبات أُنجزت بعد 24 ساعة',
    inProgress: 'طلبات لا تزال قيد المعالجة',
  },
}

function buildSummaryRows(kpis: AdminKpis, language: 'en' | 'ar'): SummarySheetRow[] {
  const labels = SUMMARY_METRIC_LABELS[language]
  return [
    { Metric: labels.newClients, Value: kpis.totalByType.new },
    { Metric: labels.followUps, Value: kpis.totalByType.follow_up },
    { Metric: labels.visaOther, Value: kpis.totalByType.visa },
    { Metric: labels.statusNext, Value: kpis.funnel.next },
    { Metric: labels.statusClosed, Value: kpis.funnel.closed },
    { Metric: labels.within24h, Value: kpis.turnaround.within24h },
    { Metric: labels.over24h, Value: kpis.turnaround.over24h },
    { Metric: labels.inProgress, Value: kpis.turnaround.inProgress },
  ]
}

const SUMMARY_SHEET_HEADERS: Record<'en' | 'ar', Record<keyof SummarySheetRow, string>> = {
  en: { Metric: 'Metric', Value: 'Value' },
  ar: { Metric: 'المؤشر', Value: 'القيمة' },
}

function summaryColumns(language: 'en' | 'ar') {
  const h = SUMMARY_SHEET_HEADERS[language]
  return [
    { header: h.Metric, cell: (r: SummarySheetRow) => ({ value: r.Metric }) },
    { header: h.Value, cell: (r: SummarySheetRow) => ({ value: r.Value }) },
  ]
}

const SHEET_NAMES: Record<
  'en' | 'ar',
  { clients: string; summary: string; country: string; counselor: string }
> = {
  en: {
    clients: 'Clients',
    summary: 'Summary',
    country: 'Country breakdown',
    counselor: 'Counselor performance',
  },
  ar: {
    clients: 'العملاء',
    summary: 'الملخص',
    country: 'توزيع الدول',
    counselor: 'أداء المستشارين',
  },
}

export async function exportKpisToExcel(
  actorRole: UserRole,
  kpis: AdminKpis,
  clients: ClientExportRow[],
  language: 'en' | 'ar' = 'en'
): Promise<ExportKpisResult> {
  if (actorRole !== 'admin' && actorRole !== 'super_admin') {
    return { ok: false, reason: 'onlyAdminOrSuperAdminExport' }
  }

  const sheetNames = SHEET_NAMES[language]
  const buffer = (await writeExcelFile([
    {
      data: getSheetData(buildClientsRows(clients, language), clientsColumns(language)),
      sheet: sheetNames.clients,
    },
    {
      data: getSheetData(buildSummaryRows(kpis, language), summaryColumns(language)),
      sheet: sheetNames.summary,
    },
    {
      data: getSheetData(buildCountryRows(kpis, language), countryColumns(language)),
      sheet: sheetNames.country,
    },
    {
      data: getSheetData(buildCounselorRows(kpis, language), counselorColumns(language)),
      sheet: sheetNames.counselor,
    },
  ]).toBuffer()) as Buffer

  return { ok: true, buffer }
}
