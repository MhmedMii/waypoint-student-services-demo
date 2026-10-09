'use client'
import { useLanguage } from '../i18n/LanguageContext'
import { PAGE_SIZE_OPTIONS, pageButtons, type PageSize } from '../domain/pagination/paginateRows'
import type { PageSlice } from '../domain/pagination/paginateRows'

interface PagingBarProps {
  slice: PageSlice<unknown>
  pageSize: PageSize
  onPageSizeChange: (size: PageSize) => void
  // صفحة الزيارات تعرض عدّاد أغنى (الفترة + الإجمالي الكلي) — الباقي ياخذ الافتراضي
  summary?: React.ReactNode
}

export function TablePagingBar({ slice, pageSize, onPageSizeChange, summary }: PagingBarProps) {
  const { t } = useLanguage()
  return (
    <div className="visits-toolbar">
      <div className="visits-range" aria-live="polite">
        {summary ??
          t('paging', 'showing')
            .replace('{from}', String(slice.from))
            .replace('{to}', String(slice.to))
            .replace('{total}', String(slice.total))}
      </div>
      <div className="visits-page-size" role="group" aria-label={t('paging', 'rowsPerPage')}>
        <span>{t('paging', 'rowsPerPage')}</span>
        <div className="visits-seg">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <button
              type="button"
              key={size}
              className={size === pageSize ? 'on' : ''}
              aria-pressed={size === pageSize}
              onClick={() => onPageSizeChange(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ما نعرض أزرار الصفحات إذا كل شي يطلع بصفحة وحدة — الجداول الصغيرة تبقى نظيفة
export function TablePager({
  slice,
  onPage,
}: {
  slice: PageSlice<unknown>
  onPage: (page: number) => void
}) {
  const { t } = useLanguage()
  if (slice.pageCount <= 1) return null

  return (
    <nav className="visits-pager" aria-label={t('paging', 'pagination')}>
      <button type="button" disabled={slice.page === 1} onClick={() => onPage(slice.page - 1)}>
        {t('paging', 'prev')}
      </button>
      {pageButtons(slice.page, slice.pageCount).map((button, index) =>
        button === 'gap' ? (
          <span key={`gap-${index}`} className="visits-pager-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            type="button"
            key={button}
            className={button === slice.page ? 'on' : ''}
            aria-current={button === slice.page ? 'page' : undefined}
            aria-label={t('paging', 'pageNumber').replace('{page}', String(button))}
            onClick={() => onPage(button)}
          >
            {button}
          </button>
        )
      )}
      <button
        type="button"
        disabled={slice.page === slice.pageCount}
        onClick={() => onPage(slice.page + 1)}
      >
        {t('paging', 'next')}
      </button>
    </nav>
  )
}
