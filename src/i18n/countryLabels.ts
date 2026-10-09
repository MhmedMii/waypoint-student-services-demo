import { COUNTRY_SCOPES } from '../domain/entities/counselor'
import type { Dictionary } from './translations'

// القيمة المخزّنة بقاعدة البيانات هي اسم النطاق نفسه ('USA')، وهذا يربطها بمفتاح
// الترجمة المعروض. كان مكرر بثلاث شاشات، فجمعناه هنا.
export const COUNTRY_LABEL_KEYS: Record<
  (typeof COUNTRY_SCOPES)[number],
  keyof Dictionary['countries']
> = {
  Medicine: 'medicine',
  USA: 'usa',
  'UK & Ireland': 'ukIreland',
  'Australia & New Zealand': 'ausNz',
  'Europe & Other Countries': 'europeOther',
  GCC: 'gcc',
  Egypt: 'egypt',
}

export function isKnownCountryScope(value: string): value is (typeof COUNTRY_SCOPES)[number] {
  return value in COUNTRY_LABEL_KEYS
}
