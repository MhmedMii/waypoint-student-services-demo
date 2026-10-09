// سقف أمان، مو ترقيم صفحات: بحث بحرف واحد على جدول كبير يسحب كل شي ويفك
// تشفير رقم بكل صف. المطابقات ترتّب بالأحدث أولاً، فاللي يهم يجي أول
export const NAME_SEARCH_LIMIT = 500

// نسحب صف زيادة عن السقف عشان نعرف إذا فيه بعده — بدونه القطع يصير صامت:
// موظفة تدوّر "محمد" وتلقى النتائج مقطوعة بلا أي إشارة، فتستنتج إن العميل
// مو موجود. الصف الزائد ما ينعرض، وظيفته الوحيدة إنه يقول "فيه أكثر"
export const NAME_SEARCH_FETCH_LIMIT = NAME_SEARCH_LIMIT + 1

export interface SearchPage<T> {
  rows: T[]
  truncated: boolean
}

export function takeSearchPage<T>(matches: T[]): SearchPage<T> {
  if (matches.length <= NAME_SEARCH_LIMIT) return { rows: matches, truncated: false }
  return { rows: matches.slice(0, NAME_SEARCH_LIMIT), truncated: true }
}

// اسم الهيدر اللي يتفق عليه الطرفان. نمرّرها بهيدر مو بجسم الرد: المسارات
// ترجّع مصفوفة، وتحويلها لكائن يكسر كل من يقرأها اليوم بلا فايدة تُذكر
export const SEARCH_TRUNCATED_HEADER = 'x-search-truncated'
