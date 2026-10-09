import type { Language } from './translations'

// الاسم الافتراضي محفوظ زي ما كتبه الحساب أول مرة (عادة إنجليزي) — نعرض
// نسخته العربية بدل هذا بس إذا اللغة عربي وفيه نسخة عربية محفوظة له
export function localizedName(
  name: string,
  nameAr: string | null | undefined,
  language: Language
): string {
  return language === 'ar' && nameAr ? nameAr : name
}
