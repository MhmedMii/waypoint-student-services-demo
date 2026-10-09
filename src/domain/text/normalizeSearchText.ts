// حروف عربية تُكتب بأكثر من صورة وتُنطق نفسها — الموظف ما يعرف كيف انكتب الاسم
// بالمكتب، فنوحّدها بالطرفين (النص المكتوب والاسم المخزّن) قبل المقارنة
const LETTER_FOLD: Record<string, string> = {
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ة: 'ه',
  ى: 'ي',
  ؤ: 'و',
  ئ: 'ي',
}
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

// التشكيل (فتحة/ضمة/شدة…) والتطويل ـ زينة كتابية، ما تغيّر الاسم
const DIACRITICS_AND_TATWEEL = /[ً-ْٰـ]/g

export function normalizeSearchText(value: string): string {
  return value
    .replace(DIACRITICS_AND_TATWEEL, '')
    .replace(/[أإآٱةىؤئ]/g, (letter) => LETTER_FOLD[letter] ?? letter)
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
    .toLowerCase()
    .trim()
}

const KUWAIT_PHONE_LENGTH = 8

// رقم الهاتف مشفّر بقاعدة البيانات ويُطابق ببصمة كاملة — فبحث الرقم لازم يكون
// الثمانية أرقام كاملة، عكس الاسم اللي مخزّن نص عادي ويقبل جزء منه
export function isPhoneSearch(term: string): boolean {
  const normalized = normalizeSearchText(term)
  return normalized.length === KUWAIT_PHONE_LENGTH && /^\d+$/.test(normalized)
}

export function matchesName(name: string, term: string): boolean {
  return normalizeSearchText(name).includes(normalizeSearchText(term))
}
