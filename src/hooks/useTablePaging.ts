'use client'
import { useEffect, useState } from 'react'
import {
  DEFAULT_PAGE_SIZE,
  paginateRows,
  parsePageSize,
  type PageSize,
  type PageSlice,
} from '../domain/pagination/paginateRows'
import { readStoredValue, writeStoredValue } from '../lib/safeLocalStorage'

// نفس الحارس اللي كان هنا، بس صار بمكان واحد يستخدمه الثيم واللغة كمان
function readStoredPageSize(storageKey: string): PageSize {
  return parsePageSize(readStoredValue(storageKey))
}

function storePageSize(storageKey: string, size: PageSize) {
  writeStoredValue(storageKey, String(size))
}

export interface TablePaging<T> {
  slice: PageSlice<T>
  pageSize: PageSize
  setPageSize: (size: PageSize) => void
  setPage: (page: number) => void
  resetToFirstPage: () => void
}

// كل جدول له مفتاح تخزين خاص فيه — عشان اختيار "١٠٠ صف" بصفحة الزيارات ما
// يفرض نفسه على جدول التأشيرات
export function useTablePaging<T>(rows: readonly T[], storageKey: string): TablePaging<T> {
  const [pageSize, setPageSizeState] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPageSizeState(readStoredPageSize(storageKey))
  }, [storageKey])

  function setPageSize(size: PageSize) {
    setPageSizeState(size)
    setPage(1)
    storePageSize(storageKey, size)
  }

  return {
    slice: paginateRows(rows, page, pageSize),
    pageSize,
    setPageSize,
    setPage,
    resetToFirstPage: () => setPage(1),
  }
}
