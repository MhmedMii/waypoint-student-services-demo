import { SERVICE_FORM_SCHEMAS } from './index'

// المستندات المرفوعة تُخزَّن بعنوانها الإنجليزي وقت الرفع (documentLabel)، ما
// عندنا عمود عربي مخزّن لها — نبني خريطة عكسية من كل مستندات كل الخدمات
// (نفس النص الإنجليزي يترجم لنفس العربي في كل مكان استخدمناه فيه)، ونستخدمها
// وقت العرض بس، بدون أي تغيير على البيانات المخزّنة
let cache: Map<string, string> | null = null

function buildMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const schema of Object.values(SERVICE_FORM_SCHEMAS)) {
    for (const doc of schema.documents) {
      if (!map.has(doc.label)) map.set(doc.label, doc.labelAr)
    }
  }
  return map
}

export function documentLabelAr(englishLabel: string): string | null {
  if (!cache) cache = buildMap()
  return cache.get(englishLabel) ?? null
}
