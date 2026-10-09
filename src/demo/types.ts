export type DemoRole = 'super_admin' | 'admin' | 'counselor'
export type VisitState = 'waiting' | 'in_session' | 'follow_up_needed' | 'closed'
export type VisitKind = 'new' | 'follow_up' | 'visa'
export interface Person {
  id: string
  name: string
  nameAr: string
  country: string
}
export interface TeamMember {
  id: string
  name: string
  nameAr: string
  email: string
  role: DemoRole
  active: boolean
  scopes: string[]
  onBreak: boolean
  breakStartedAt: number | null
  breakMs: number
}
export interface DemoVisit {
  id: string
  personId: string
  kind: VisitKind
  country: string
  counselorId: string | null
  state: VisitState
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  note: string
  dueAt: string
}
export type ApplicationState =
  | 'pending'
  | 'under_review'
  | 'documents_requested'
  | 'submitted_to_source'
  | 'approved'
  | 'rejected'
export interface DemoApplication {
  id: string
  personId: string
  kind: 'visa' | 'exam'
  service: string
  status: ApplicationState
  counselorId: string
  createdAt: number
  documents: string[]
  paid: boolean
  note: string
}
export interface DemoEvent {
  id: string
  at: number
  action: string
  actionAr: string
  subject: string
}
export interface DemoData {
  version: 1
  generatedAt: number
  team: TeamMember[]
  visits: DemoVisit[]
  applications: DemoApplication[]
  events: DemoEvent[]
}
