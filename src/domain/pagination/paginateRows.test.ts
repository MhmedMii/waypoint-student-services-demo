import { describe, it, expect } from 'vitest'
import { paginateRows, pageButtons, parsePageSize } from './paginateRows'

const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('paginateRows', () => {
  it('returns the first page slice with its range and total', () => {
    const slice = paginateRows(rows(143), 1, 20)
    expect(slice.rows).toHaveLength(20)
    expect(slice).toMatchObject({ page: 1, pageCount: 8, from: 1, to: 20, total: 143 })
  })

  it('returns a shorter last page', () => {
    const slice = paginateRows(rows(143), 8, 20)
    expect(slice.rows).toEqual(rows(143).slice(140))
    expect(slice).toMatchObject({ page: 8, from: 141, to: 143 })
  })

  it('handles an exact multiple of the page size without an empty extra page', () => {
    expect(paginateRows(rows(40), 2, 20)).toMatchObject({ pageCount: 2, from: 21, to: 40 })
  })

  it('handles an empty list as page 1 of 1 with a 0–0 range', () => {
    expect(paginateRows([], 1, 20)).toMatchObject({
      rows: [],
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
      total: 0,
    })
  })

  it('clamps an out-of-range or invalid page instead of returning nothing', () => {
    expect(paginateRows(rows(30), 9, 10).page).toBe(3)
    expect(paginateRows(rows(30), 0, 10).page).toBe(1)
    expect(paginateRows(rows(30), -4, 10).page).toBe(1)
    expect(paginateRows(rows(30), NaN, 10).page).toBe(1)
  })

  it('shows everything on one page when the list is shorter than the page size', () => {
    expect(paginateRows(rows(7), 1, 100)).toMatchObject({ pageCount: 1, from: 1, to: 7 })
  })
})

describe('pageButtons', () => {
  it('lists every page when there are few', () => {
    expect(pageButtons(1, 3)).toEqual([1, 2, 3])
  })

  it('keeps first and last with a gap, and neighbours of the current page', () => {
    expect(pageButtons(1, 8)).toEqual([1, 2, 'gap', 8])
    expect(pageButtons(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
    expect(pageButtons(8, 8)).toEqual([1, 'gap', 7, 8])
  })

  it('fills a single missing page instead of showing a gap for it', () => {
    expect(pageButtons(4, 6)).toEqual([1, 2, 3, 4, 5, 6])
    expect(pageButtons(3, 8)).toEqual([1, 2, 3, 4, 'gap', 8])
  })

  it('returns just page 1 for a single page', () => {
    expect(pageButtons(1, 1)).toEqual([1])
  })
})

describe('parsePageSize', () => {
  it('accepts the four allowed sizes (as numbers or strings)', () => {
    expect(parsePageSize(10)).toBe(10)
    expect(parsePageSize('50')).toBe(50)
    expect(parsePageSize(100)).toBe(100)
  })

  it('falls back to 20 for anything else', () => {
    for (const bad of [null, undefined, '', 'abc', 15, 0, -1, '1000']) {
      expect(parsePageSize(bad)).toBe(20)
    }
  })
})
