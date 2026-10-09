import type { DemoData, Person, TeamMember, VisitState, ApplicationState } from './types'

// These identities were invented for this demo, never copied from customer records.
export const PEOPLE: Person[] = [
  { id: 'student-01', name: 'Noura Reed', nameAr: 'نورا ريد', country: 'United Kingdom' },
  { id: 'student-02', name: 'Elias Rowan', nameAr: 'إلياس روان', country: 'United States' },
  { id: 'student-03', name: 'Mira Vale', nameAr: 'ميرا فيل', country: 'Australia' },
  { id: 'student-04', name: 'Rayan Finch', nameAr: 'ريان فينش', country: 'Ireland' },
  { id: 'student-05', name: 'Leena Wells', nameAr: 'لينا ويلز', country: 'Canada' },
  { id: 'student-06', name: 'Adam Grove', nameAr: 'آدم غروف', country: 'New Zealand' },
  { id: 'student-07', name: 'Sana Brook', nameAr: 'سنا بروك', country: 'United Kingdom' },
  { id: 'student-08', name: 'Yara Linden', nameAr: 'يارا ليندن', country: 'Egypt' },
  { id: 'student-09', name: 'Owen Cedar', nameAr: 'أوين سيدار', country: 'Australia' },
  { id: 'student-10', name: 'Dalia Fern', nameAr: 'داليا فيرن', country: 'United States' },
  { id: 'student-11', name: 'Zain Hollow', nameAr: 'زين هولو', country: 'Ireland' },
  { id: 'student-12', name: 'Luca Moss', nameAr: 'لوكا موس', country: 'Canada' },
]
export const COUNTRIES = [
  'United Kingdom',
  'United States',
  'Australia',
  'Ireland',
  'Canada',
  'New Zealand',
  'Egypt',
]
export const SERVICES = {
  visa: [
    'UK student visa',
    'US F-1 visa',
    'Australia student visa',
    'Ireland student visa',
    'New Zealand student visa',
    'Malta student visa',
  ],
  exam: ['IELTS Academic', 'IELTS General Training', 'TOEFL iBT'],
}
export const SERVICES_AR: Record<string, string> = {
  'UK student visa': 'تأشيرة طالب — بريطانيا',
  'US F-1 visa': 'تأشيرة طالب — أمريكا',
  'Australia student visa': 'تأشيرة طالب — أستراليا',
  'Ireland student visa': 'تأشيرة طالب — أيرلندا',
  'New Zealand student visa': 'تأشيرة طالب — نيوزيلندا',
  'Malta student visa': 'تأشيرة طالب — مالطا',
  'IELTS Academic': 'آيلتس أكاديمي',
  'IELTS General Training': 'آيلتس تدريب عام',
  'TOEFL iBT': 'توفل عبر الإنترنت',
}
export const COUNTRY_AR: Record<string, string> = {
  'United Kingdom': 'المملكة المتحدة',
  'United States': 'الولايات المتحدة',
  Australia: 'أستراليا',
  Ireland: 'أيرلندا',
  Canada: 'كندا',
  'New Zealand': 'نيوزيلندا',
  Egypt: 'مصر',
}
const TEAM: TeamMember[] = [
  {
    id: 'team-01',
    name: 'Amal Hart',
    nameAr: 'أمل هارت',
    email: 'amal.hart@example.com',
    role: 'counselor',
    active: true,
    scopes: ['United Kingdom', 'Ireland', 'Canada'],
    onBreak: false,
    breakStartedAt: null,
    breakMs: 0,
  },
  {
    id: 'team-02',
    name: 'Sami Alder',
    nameAr: 'سامي ألدر',
    email: 'sami.alder@example.com',
    role: 'counselor',
    active: true,
    scopes: ['United States', 'Canada'],
    onBreak: false,
    breakStartedAt: null,
    breakMs: 840000,
  },
  {
    id: 'team-03',
    name: 'Lina Ash',
    nameAr: 'لينا آش',
    email: 'lina.ash@example.com',
    role: 'counselor',
    active: true,
    scopes: ['Australia', 'New Zealand'],
    onBreak: false,
    breakStartedAt: null,
    breakMs: 660000,
  },
  {
    id: 'team-04',
    name: 'Karim Field',
    nameAr: 'كريم فيلد',
    email: 'karim.field@example.com',
    role: 'counselor',
    active: true,
    scopes: ['Egypt', 'visa', 'exam'],
    onBreak: false,
    breakStartedAt: null,
    breakMs: 1200000,
  },
  {
    id: 'team-05',
    name: 'Demo Administrator',
    nameAr: 'مدير تجريبي',
    email: 'admin@example.com',
    role: 'admin',
    active: true,
    scopes: [],
    onBreak: false,
    breakStartedAt: null,
    breakMs: 0,
  },
  {
    id: 'team-06',
    name: 'Demo Owner',
    nameAr: 'مالك تجريبي',
    email: 'owner@example.com',
    role: 'super_admin',
    active: true,
    scopes: [],
    onBreak: false,
    breakStartedAt: null,
    breakMs: 0,
  },
]
export function createDemoData(now = Date.now()): DemoData {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const visits = Array.from({ length: 64 }, (_, i) => {
    const person = PEOPLE[i % PEOPLE.length]
    const day = i < 12 ? 0 : 1 + (i % 6)
    const createdAt = Math.min(
      now - (i + 1) * 60000,
      today.getTime() - day * 86400000 + (8 * 60 + i * 7) * 60000
    )
    const state: VisitState = i < 6 ? 'waiting' : i < 9 ? 'follow_up_needed' : 'closed'
    return {
      id: `visit-${String(i + 1).padStart(3, '0')}`,
      personId: person.id,
      kind: (i % 5 === 0 ? 'visa' : i % 3 === 0 ? 'follow_up' : 'new') as
        'visa' | 'follow_up' | 'new',
      country: person.country,
      counselorId: TEAM[i % 4].id,
      state,
      createdAt,
      startedAt: state === 'closed' ? createdAt + 180000 : null,
      finishedAt: state === 'closed' ? createdAt + (12 + (i % 16)) * 60000 : null,
      note: '',
      dueAt:
        state === 'follow_up_needed' ? new Date(now + 86400000).toISOString().slice(0, 10) : '',
    }
  })
  const statuses: ApplicationState[] = [
    'under_review',
    'documents_requested',
    'pending',
    'submitted_to_source',
    'approved',
    'rejected',
  ]
  const applications = Array.from({ length: 16 }, (_, i) => {
    const kind = i % 3 === 0 ? 'exam' : 'visa'
    return {
      id: `WP-${String(2401 + i)}`,
      personId: PEOPLE[(i + 3) % PEOPLE.length].id,
      kind: kind as 'visa' | 'exam',
      service: SERVICES[kind][i % SERVICES[kind].length],
      status: statuses[i % statuses.length],
      counselorId: TEAM[i % 4].id,
      createdAt: now - (i + 1) * 43200000,
      documents: ['Demo study record.txt', 'Demo identity sample.txt'],
      paid: i % 3 !== 0,
      note: '',
    }
  })
  const events = visits.slice(0, 10).map((visit, i) => ({
    id: `event-${i}`,
    at: now - (i * 9 + 3) * 60000,
    action: i % 2 ? 'Application reviewed' : 'Visit registered',
    actionAr: i % 2 ? 'مراجعة طلب' : 'تسجيل زيارة',
    subject: visit.personId,
  }))
  return {
    version: 1,
    generatedAt: now,
    team: TEAM.map((member) => ({ ...member, scopes: [...member.scopes] })),
    visits,
    applications,
    events,
  }
}
