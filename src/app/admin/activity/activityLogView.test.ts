import { describe, it, expect } from 'vitest'
import {
  applyFilters,
  distinctActors,
  EMPTY_FILTERS,
  groupByDay,
  hasActiveFilters,
  sortRows,
  legacyUnassignedAt,
  splitTrailingDetail,
  summarizeToday,
} from './activityLogView'
import type { ActivityLogRow } from './activityLogView'
import { severityOf } from '../../../domain/entities/activityLog'

const NOW = new Date('2026-08-31T15:00:00')

function row(overrides: Partial<ActivityLogRow> = {}): ActivityLogRow {
  return {
    id: Math.random().toString(36).slice(2),
    actorId: 'u1',
    actorName: 'Dev Admin',
    actorNameAr: null,
    actorRole: 'super_admin',
    action: 'visit_created',
    targetType: 'visit',
    targetId: 'v1',
    details: 'Created new-client visit for Fictional Student G',
    detailsAr: 'تم إنشاء زيارة عميل جديد لـ ليلى حداد',
    createdAt: '2026-08-31T12:00:00',
    ...overrides,
  }
}

describe('severityOf', () => {
  it('treats deletions as destructive', () => {
    expect(severityOf('account_deleted')).toBe('destructive')
    expect(severityOf('visit_deleted')).toBe('destructive')
    expect(severityOf('application_deleted')).toBe('destructive')
  })

  it('treats access-changing account actions as privilege', () => {
    expect(severityOf('account_promoted')).toBe('privilege')
    expect(severityOf('account_downgraded')).toBe('privilege')
    expect(severityOf('account_password_reset')).toBe('privilege')
  })

  it('leaves day-to-day work routine', () => {
    expect(severityOf('visit_closed')).toBe('routine')
    expect(severityOf('account_shift_updated')).toBe('routine')
  })
})

describe('summarizeToday', () => {
  it('counts only today and buckets by severity', () => {
    const summary = summarizeToday(
      [
        row({ createdAt: '2026-08-31T09:00:00', action: 'visit_created' }),
        row({
          createdAt: '2026-08-31T10:00:00',
          action: 'application_deleted',
          actorId: 'u2',
          actorName: 'Ahmad',
        }),
        row({ createdAt: '2026-08-31T11:00:00', action: 'account_promoted' }),
        row({ createdAt: '2026-08-30T11:00:00', action: 'visit_created' }),
      ],
      NOW
    )
    expect(summary.today).toBe(3)
    expect(summary.actorsToday).toBe(2)
    expect(summary.routine).toBe(1)
    expect(summary.privilege).toBe(1)
    expect(summary.destructive).toBe(1)
  })

  it('returns zeroes on a quiet day', () => {
    const summary = summarizeToday([row({ createdAt: '2026-08-20T09:00:00' })], NOW)
    expect(summary).toEqual({ today: 0, actorsToday: 0, routine: 0, privilege: 0, destructive: 0 })
  })
})

describe('applyFilters', () => {
  const rows = [
    row({
      action: 'application_deleted',
      actorName: 'Ahmad',
      details: 'Deleted visa application for Sara',
    }),
    row({ action: 'visit_closed', actorName: 'Fatima', details: 'Closed visit for Omar' }),
    row({ action: 'visit_created', actorName: 'Fatima', createdAt: '2026-08-01T09:00:00' }),
  ]

  it('passes everything through when no filter is set', () => {
    expect(applyFilters(rows, EMPTY_FILTERS, NOW)).toHaveLength(3)
  })

  it('filters by severity', () => {
    const result = applyFilters(rows, { ...EMPTY_FILTERS, severity: 'destructive' }, NOW)
    expect(result).toHaveLength(1)
    expect(result[0].action).toBe('application_deleted')
  })

  it('filters by actor and by action', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, actor: 'Fatima' }, NOW)).toHaveLength(2)
    expect(applyFilters(rows, { ...EMPTY_FILTERS, action: 'visit_closed' }, NOW)).toHaveLength(1)
  })

  it('searches actor name and details case-insensitively', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, search: 'sara' }, NOW)).toHaveLength(1)
    expect(applyFilters(rows, { ...EMPTY_FILTERS, search: 'FATIMA' }, NOW)).toHaveLength(2)
  })

  it('keeps the whole of the current day when filtering to 1 day', () => {
    const result = applyFilters(rows, { ...EMPTY_FILTERS, days: 1 }, NOW)
    expect(result).toHaveLength(2)
  })

  it('reports whether anything is active', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: '  ' })).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, severity: 'routine' })).toBe(true)
  })
})

describe('self-service rows (no actor id)', () => {
  it('counts them by name so they are not collapsed into one actor', () => {
    const summary = summarizeToday(
      [
        row({ actorId: null, actorName: 'Self-service', action: 'visit_created' }),
        row({ actorId: null, actorName: 'Self-service', action: 'visit_created' }),
        row({ actorId: 'u1', actorName: 'Dev Admin', action: 'visit_closed' }),
      ],
      NOW
    )
    expect(summary.today).toBe(3)
    expect(summary.actorsToday).toBe(2)
  })

  it('bundles a run of them together', () => {
    const groups = groupByDay([
      row({ actorId: null, actorName: 'Self-service', action: 'visit_created' }),
      row({ actorId: null, actorName: 'Self-service', action: 'visit_created' }),
      row({ actorId: null, actorName: 'Self-service', action: 'visit_created' }),
    ])
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].kind).toBe('bundle')
  })
})

describe('groupByDay', () => {
  it('splits rows into local-day groups in the order given', () => {
    const groups = groupByDay([
      row({ createdAt: '2026-08-31T14:00:00' }),
      row({ createdAt: '2026-08-31T09:00:00', action: 'visit_closed' }),
      row({ createdAt: '2026-08-30T09:00:00' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].items).toHaveLength(1)
  })

  it('collapses a run of the same actor and action into one bundle', () => {
    const groups = groupByDay([
      row({
        createdAt: '2026-08-31T13:00:00',
        action: 'visit_closed',
        actorId: 'f1',
        actorName: 'Fatima',
      }),
      row({
        createdAt: '2026-08-31T12:00:00',
        action: 'visit_closed',
        actorId: 'f1',
        actorName: 'Fatima',
      }),
      row({
        createdAt: '2026-08-31T11:00:00',
        action: 'visit_closed',
        actorId: 'f1',
        actorName: 'Fatima',
      }),
      row({
        createdAt: '2026-08-31T10:00:00',
        action: 'visit_created',
        actorId: 'f1',
        actorName: 'Fatima',
      }),
    ])
    expect(groups[0].items).toHaveLength(2)
    const [first, second] = groups[0].items
    expect(first.kind).toBe('bundle')
    if (first.kind === 'bundle') {
      expect(first.rows).toHaveLength(3)
      expect(first.actorName).toBe('Fatima')
    }
    expect(second.kind).toBe('event')
  })

  it('leaves a short run as individual events', () => {
    const groups = groupByDay([
      row({ createdAt: '2026-08-31T13:00:00', action: 'visit_closed' }),
      row({ createdAt: '2026-08-31T12:00:00', action: 'visit_closed' }),
    ])
    expect(groups[0].items.every((item) => item.kind === 'event')).toBe(true)
  })

  it('does not bundle across two different actors', () => {
    const groups = groupByDay([
      row({ createdAt: '2026-08-31T13:00:00', action: 'visit_closed', actorId: 'a' }),
      row({ createdAt: '2026-08-31T12:00:00', action: 'visit_closed', actorId: 'b' }),
      row({ createdAt: '2026-08-31T11:00:00', action: 'visit_closed', actorId: 'a' }),
    ])
    expect(groups[0].items).toHaveLength(3)
  })
})

describe('sortRows', () => {
  const rows = [
    row({
      id: 'r1',
      createdAt: '2026-08-31T09:00:00',
      actorName: 'Zaid',
      action: 'visit_closed',
      targetType: 'visit',
    }),
    row({
      id: 'r2',
      createdAt: '2026-08-31T13:00:00',
      actorName: 'Ahmad',
      action: 'account_deleted',
      targetType: 'account',
    }),
    row({
      id: 'r3',
      createdAt: '2026-08-31T11:00:00',
      actorName: 'Mona',
      action: 'application_submitted',
      targetType: 'application',
    }),
  ]

  it('sorts by time, newest first by default direction', () => {
    expect(sortRows(rows, 'createdAt', 'desc').map((r) => r.id)).toEqual(['r2', 'r3', 'r1'])
  })

  it('reverses with asc', () => {
    expect(sortRows(rows, 'createdAt', 'asc').map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])
  })

  it('sorts by actor name alphabetically', () => {
    expect(sortRows(rows, 'actorName', 'asc').map((r) => r.id)).toEqual(['r2', 'r3', 'r1'])
  })

  it('sorts by action and by target type', () => {
    expect(sortRows(rows, 'action', 'asc').map((r) => r.id)).toEqual(['r2', 'r3', 'r1'])
    expect(sortRows(rows, 'targetType', 'asc').map((r) => r.id)).toEqual(['r2', 'r3', 'r1'])
  })

  it('does not mutate the input array', () => {
    const copy = [...rows]
    sortRows(rows, 'actorName', 'asc')
    expect(rows).toEqual(copy)
  })
})

describe('distinctActors', () => {
  it('de-duplicates and sorts', () => {
    expect(
      distinctActors([
        row({ actorName: 'Zaid', actorNameAr: 'زيد' }),
        row({ actorName: 'Ahmad', actorNameAr: 'أحمد' }),
        row({ actorName: 'Zaid', actorNameAr: 'زيد' }),
      ])
    ).toEqual([
      { name: 'Ahmad', nameAr: 'أحمد' },
      { name: 'Zaid', nameAr: 'زيد' },
    ])
  })

  it('carries a null Arabic name through as-is', () => {
    expect(distinctActors([row({ actorName: 'System', actorNameAr: null })])).toEqual([
      { name: 'System', nameAr: null },
    ])
  })
})

describe('splitTrailingDetail', () => {
  // الأحمر يقع على الذيل بس، فلازم نلقاه داخل نص عادي
  it('splits on the last separator so only the tail can be coloured', () => {
    expect(
      splitTrailingDetail('Sample Client chose Demo Counselor One — not in 15 working days')
    ).toEqual({
      head: 'Sample Client chose Demo Counselor One — ',
      tail: 'not in 15 working days',
    })
  })

  // اسم فيه شرطة طويلة ما يخرب التقسيم — نأخذ الأخيرة
  it('takes the last separator, not the first', () => {
    expect(splitTrailingDetail('A — B — not in 2 working days').tail).toBe('not in 2 working days')
  })

  // أسوأ حالة: سطر قديم أو مختلف — يتعرض كامل بدون تلوين، ما ينكسر
  it('returns the whole line untouched when there is no separator', () => {
    expect(splitTrailingDetail('Created follow-up visit for Sample Client')).toEqual({
      head: 'Created follow-up visit for Sample Client',
      tail: null,
    })
  })

  it('survives an empty or missing detail', () => {
    expect(splitTrailingDetail(null)).toEqual({ head: '', tail: null })
    expect(splitTrailingDetail('')).toEqual({ head: '', tail: null })
  })
})

// صفوف انكتبت قبل ما يصير لهالحالة إجراء خاص — السبب محشور بآخر سطر الإنشاء
const LEGACY_EN =
  'Created new-client visit for Sample Client — Australia & New Zealand — left unassigned: the counselor on shift has not signed in for 5 working days'
const LEGACY_AR =
  'تم إنشاء زيارة عميل جديد لـ عميل تجريبي — أستراليا ونيوزيلندا — تُركت بدون تعيين: المستشار في الشفت ما سجّل دخول من 5 أيام عمل'

describe('legacy rows that carry the reason as text', () => {
  it('recognises the English and Arabic wording', () => {
    expect(legacyUnassignedAt(LEGACY_EN)).toBeGreaterThan(0)
    expect(legacyUnassignedAt(LEGACY_AR)).toBeGreaterThan(0)
  })

  it('is not fooled by an ordinary visit line', () => {
    expect(legacyUnassignedAt('Created new-client visit for Sample Client — USA')).toBe(-1)
    expect(legacyUnassignedAt(null)).toBe(-1)
  })

  // الفخ: الصف فيه " — " مرتين. لو قسمنا عند آخر وحدة كان اللون وقع على
  // اسم الدولة بدل السبب
  it('splits at the reason, not at the country name before it', () => {
    expect(splitTrailingDetail(LEGACY_EN).tail).toBe(
      'left unassigned: the counselor on shift has not signed in for 5 working days'
    )
    expect(splitTrailingDetail(LEGACY_AR).tail).toBe(
      'تُركت بدون تعيين: المستشار في الشفت ما سجّل دخول من 5 أيام عمل'
    )
  })

  // الصفوف اللي كُتبت بالعتبة القديمة لازم تنلوّن كمان
  it('recognises the older two-day wording as well', () => {
    const twoDays =
      'Created new-client visit for Othman alhsban — Australia & New Zealand — left unassigned: the counselor on shift has not signed in for 2 working days'
    expect(splitTrailingDetail(twoDays).tail).toContain('2 working days')
  })
})
