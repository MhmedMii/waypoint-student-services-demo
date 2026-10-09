export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 20

export function parsePageSize(value: unknown): PageSize {
  const parsed = Number(value)
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as PageSize)
    : DEFAULT_PAGE_SIZE
}

export interface PageSlice<T> {
  rows: T[]
  page: number
  pageCount: number
  from: number
  to: number
  total: number
}

// لو الصفحة المطلوبة برا النطاق (مثلاً انحذفت سجلات) نرجّعها لأقرب صفحة صالحة
// بدل ما نعرض جدول فاضي
export function paginateRows<T>(rows: readonly T[], page: number, pageSize: number): PageSlice<T> {
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount)
  const start = (safePage - 1) * pageSize
  const sliced = rows.slice(start, start + pageSize)
  return {
    rows: sliced,
    page: safePage,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: start + sliced.length,
    total,
  }
}

export type PageButton = number | 'gap'

// أزرار الصفحات: أول وآخر صفحة دايم ظاهرين، وحول الصفحة الحالية جيران، والباقي "…"
export function pageButtons(page: number, pageCount: number): PageButton[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1])
  const numbers = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)
  const result: PageButton[] = []
  numbers.forEach((n, i) => {
    if (i > 0) {
      const gap = n - numbers[i - 1]
      if (gap === 2) result.push(n - 1)
      else if (gap > 2) result.push('gap')
    }
    result.push(n)
  })
  return result
}
