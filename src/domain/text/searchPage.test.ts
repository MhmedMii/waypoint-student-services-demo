import { describe, it, expect } from 'vitest'
import {
  takeSearchPage,
  NAME_SEARCH_LIMIT,
  NAME_SEARCH_FETCH_LIMIT,
  SEARCH_TRUNCATED_HEADER,
} from './searchPage'

const rows = (count: number) => Array.from({ length: count }, (_, i) => i)

describe('takeSearchPage', () => {
  it('passes a short result through untouched', () => {
    expect(takeSearchPage(rows(3))).toEqual({ rows: [0, 1, 2], truncated: false })
  })

  it('passes an empty result through untouched', () => {
    expect(takeSearchPage([])).toEqual({ rows: [], truncated: false })
  })

  // بالضبط عند السقف: كامل وغير مقطوع — ما نقول "فيه أكثر" وما فيه
  it('does not claim truncation at exactly the ceiling', () => {
    const page = takeSearchPage(rows(NAME_SEARCH_LIMIT))
    expect(page.rows).toHaveLength(NAME_SEARCH_LIMIT)
    expect(page.truncated).toBe(false)
  })

  // الصف الزائد وحده هو الدليل إن فيه أكثر — وما ينعرض
  it('reports truncation on the extra row, and drops it', () => {
    const page = takeSearchPage(rows(NAME_SEARCH_FETCH_LIMIT))
    expect(page.rows).toHaveLength(NAME_SEARCH_LIMIT)
    expect(page.truncated).toBe(true)
  })

  it('fetches exactly one row beyond the ceiling, never more', () => {
    expect(NAME_SEARCH_FETCH_LIMIT).toBe(NAME_SEARCH_LIMIT + 1)
  })

  it('keeps the newest matches, which are the ones that sorted first', () => {
    const page = takeSearchPage(rows(NAME_SEARCH_FETCH_LIMIT))
    expect(page.rows[0]).toBe(0)
    expect(page.rows.at(-1)).toBe(NAME_SEARCH_LIMIT - 1)
  })

  // الهيدر لازم يكون حروف صغيرة: fetch يرجّع أسماء الهيدرز صغيرة دايماً
  it('names the header in lower case, as fetch reads it back', () => {
    expect(SEARCH_TRUNCATED_HEADER).toBe(SEARCH_TRUNCATED_HEADER.toLowerCase())
  })
})
