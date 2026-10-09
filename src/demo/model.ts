import { canTransitionApplicationStatus } from '../domain/workflow/applicationStatusTransitions'
import { PEOPLE } from './fixtures'
import type { DemoData, DemoVisit, ApplicationState } from './types'

export type DemoAction =
  | { type: 'start'; counselorId: string; now: number }
  | {
      type: 'finish'
      counselorId: string
      state: 'closed' | 'follow_up_needed'
      note: string
      dueAt: string
      now: number
    }
  | { type: 'break'; counselorId: string; now: number }
  | {
      type: 'register'
      personId: string
      kind: DemoVisit['kind']
      country: string
      counselorId: string | null
      now: number
    }
  | { type: 'assign'; visitId: string; counselorId: string; now: number }
  | {
      type: 'application'
      personId: string
      kind: 'visa' | 'exam'
      service: string
      documents: string[]
      now: number
    }
  | { type: 'application-status'; id: string; status: ApplicationState; now: number }
  | { type: 'payment'; id: string; now: number }
  | { type: 'account'; id: string; now: number }
  | { type: 'add-account'; now: number }

function log(
  data: DemoData,
  now: number,
  action: string,
  actionAr: string,
  subject: string
): DemoData {
  return {
    ...data,
    events: [
      { id: `event-${now}-${data.events.length}`, at: now, action, actionAr, subject },
      ...data.events,
    ].slice(0, 200),
  }
}
export function chooseCounselor(
  data: DemoData,
  country: string,
  kind: DemoVisit['kind']
): string | null {
  const candidates = data.team.filter(
    (member) =>
      member.active &&
      member.role === 'counselor' &&
      member.scopes.includes(kind === 'visa' ? 'visa' : country)
  )
  return (
    [...candidates].sort((a, b) => {
      const recent = (id: string) =>
        Math.max(
          0,
          ...data.visits.filter((visit) => visit.counselorId === id).map((visit) => visit.createdAt)
        )
      return recent(a.id) - recent(b.id)
    })[0]?.id ?? null
  )
}
function start(data: DemoData, action: Extract<DemoAction, { type: 'start' }>): DemoData {
  const member = data.team.find((item) => item.id === action.counselorId)
  if (
    !member?.active ||
    member.onBreak ||
    data.visits.some((v) => v.counselorId === member.id && v.state === 'in_session')
  )
    return data
  const next = data.visits
    .filter((v) => v.counselorId === member.id && v.state === 'waiting')
    .sort((a, b) => a.createdAt - b.createdAt)[0]
  if (!next) return data
  return log(
    {
      ...data,
      visits: data.visits.map((v) =>
        v.id === next.id ? { ...v, state: 'in_session', startedAt: action.now } : v
      ),
    },
    action.now,
    'Session started',
    'بدء جلسة',
    next.personId
  )
}
function finish(data: DemoData, action: Extract<DemoAction, { type: 'finish' }>): DemoData {
  const current = data.visits.find(
    (v) => v.counselorId === action.counselorId && v.state === 'in_session'
  )
  if (!current || (action.state === 'follow_up_needed' && !action.dueAt)) return data
  return log(
    {
      ...data,
      visits: data.visits.map((v) =>
        v.id === current.id
          ? {
              ...v,
              state: action.state,
              finishedAt: action.now,
              note: action.note,
              dueAt: action.state === 'follow_up_needed' ? action.dueAt : '',
            }
          : v
      ),
    },
    action.now,
    'Session finished',
    'إنهاء جلسة',
    current.personId
  )
}
function toggleBreak(data: DemoData, action: Extract<DemoAction, { type: 'break' }>): DemoData {
  if (data.visits.some((v) => v.counselorId === action.counselorId && v.state === 'in_session'))
    return data
  const member = data.team.find((m) => m.id === action.counselorId)
  if (!member?.active) return data
  const team = data.team.map((m) =>
    m.id !== member.id
      ? m
      : {
          ...m,
          onBreak: !m.onBreak,
          breakStartedAt: m.onBreak ? null : action.now,
          breakMs: m.breakMs + (m.onBreak && m.breakStartedAt ? action.now - m.breakStartedAt : 0),
        }
  )
  return log(
    { ...data, team },
    action.now,
    member.onBreak ? 'Break ended' : 'Break started',
    member.onBreak ? 'انتهاء استراحة' : 'بدء استراحة',
    member.id
  )
}
function register(data: DemoData, action: Extract<DemoAction, { type: 'register' }>): DemoData {
  if (!PEOPLE.some((person) => person.id === action.personId)) return data
  const counselorId =
    action.kind === 'follow_up'
      ? action.counselorId
      : chooseCounselor(data, action.country, action.kind)
  if (
    action.kind === 'follow_up' &&
    !data.team.some((m) => m.id === counselorId && m.active && m.role === 'counselor')
  )
    return data
  const visit: DemoVisit = {
    id: `visit-demo-${action.now}-${data.visits.length}`,
    personId: action.personId,
    kind: action.kind,
    country: action.country,
    counselorId,
    state: 'waiting',
    createdAt: action.now,
    startedAt: null,
    finishedAt: null,
    note: '',
    dueAt: '',
  }
  return log(
    { ...data, visits: [visit, ...data.visits] },
    action.now,
    'Visit registered',
    'تسجيل زيارة',
    action.personId
  )
}
export function reduceDemo(data: DemoData, action: DemoAction): DemoData {
  if (action.type === 'start') return start(data, action)
  if (action.type === 'finish') return finish(data, action)
  if (action.type === 'break') return toggleBreak(data, action)
  if (action.type === 'register') return register(data, action)
  return reduceManagement(data, action)
}
function reduceManagement(
  data: DemoData,
  action: Exclude<DemoAction, { type: 'start' | 'finish' | 'break' | 'register' }>
): DemoData {
  if (action.type === 'assign') {
    const visit = data.visits.find((v) => v.id === action.visitId)
    if (
      !visit ||
      visit.state === 'in_session' ||
      !data.team.some((m) => m.id === action.counselorId && m.active && m.role === 'counselor')
    )
      return data
    return log(
      {
        ...data,
        visits: data.visits.map((v) =>
          v.id === visit.id ? { ...v, counselorId: action.counselorId } : v
        ),
      },
      action.now,
      'Counselor reassigned',
      'تغيير المستشار',
      visit.personId
    )
  }
  if (action.type === 'application') {
    if (!PEOPLE.some((p) => p.id === action.personId)) return data
    const id = `WP-${2401 + data.applications.length}`
    return log(
      {
        ...data,
        applications: [
          {
            id,
            personId: action.personId,
            kind: action.kind,
            service: action.service,
            documents: action.documents,
            status: 'pending',
            counselorId:
              data.team.find((m) => m.active && m.scopes.includes(action.kind))?.id ?? '',
            createdAt: action.now,
            paid: false,
            note: '',
          },
          ...data.applications,
        ],
      },
      action.now,
      'Application submitted',
      'تقديم طلب',
      action.personId
    )
  }
  if (action.type === 'application-status') {
    const current = data.applications.find((a) => a.id === action.id)
    if (!current || !canTransitionApplicationStatus(current.status, action.status)) return data
    return log(
      {
        ...data,
        applications: data.applications.map((a) =>
          a.id === action.id ? { ...a, status: action.status } : a
        ),
      },
      action.now,
      'Application status updated',
      'تحديث حالة الطلب',
      current.personId
    )
  }
  if (action.type === 'payment')
    return log(
      {
        ...data,
        applications: data.applications.map((a) => (a.id === action.id ? { ...a, paid: true } : a)),
      },
      action.now,
      'Demo payment simulated',
      'محاكاة دفع تجريبي',
      action.id
    )
  if (action.type === 'account') {
    const member = data.team.find((m) => m.id === action.id)
    if (
      !member ||
      member.role === 'super_admin' ||
      data.visits.some((v) => v.counselorId === member.id && v.state === 'in_session')
    )
      return data
    return log(
      {
        ...data,
        team: data.team.map((m) => (m.id === member.id ? { ...m, active: !m.active } : m)),
      },
      action.now,
      'Demo account updated',
      'تحديث حساب تجريبي',
      member.id
    )
  }
  const count = data.team.length + 1
  return log(
    {
      ...data,
      team: [
        ...data.team,
        {
          id: `team-${String(count).padStart(2, '0')}`,
          name: `Demo Counselor ${count}`,
          nameAr: `مستشار تجريبي ${count}`,
          email: `counselor${count}@example.com`,
          role: 'counselor',
          active: true,
          scopes: ['United Kingdom', 'Ireland'],
          onBreak: false,
          breakStartedAt: null,
          breakMs: 0,
        },
      ],
    },
    action.now,
    'Demo account created',
    'إنشاء حساب تجريبي',
    `team-${String(count).padStart(2, '0')}`
  )
}
