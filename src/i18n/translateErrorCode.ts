import { translations } from './translations'
import type { Language, Dictionary } from './translations'

type ErrorCode = keyof Dictionary['errors']

function isErrorCode(code: string, dict: Dictionary['errors']): code is ErrorCode {
  return code in dict
}

// use-case/domain functions تُرجع رمز خطأ خام (زي 'onlySuperAdmin') بدل جملة إنجليزية —
// هذا يترجمه وقت العرض فقط، ويستبدل أي {placeholder} بالقيم المعطاة.
// يرجّع null لأي رمز غير معروف (بدل نص افتراضي) — القرار يترك لمن يستدعيها،
// عن طريق `?? fallback`، عشان نص احتياطي مترجم مسبقًا ما ينكتب فوقه بالغلط
export function translateErrorCode(
  language: Language,
  code: string | null | undefined,
  params?: Record<string, string>
): string | null {
  if (!code) return null
  const dict = translations[language].errors
  if (!isErrorCode(code, dict)) return null
  const template = dict[code]
  if (!params) return template
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template
  )
}
