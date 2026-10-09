import type { Visit } from '../../domain/entities/visit'
import type { SpecializationScope } from '../../domain/entities/counselor'
import { normalizeSearchText } from '../../domain/text/normalizeSearchText'
import { startOfKuwaitDay, kuwaitDayKey } from '../../domain/time/kuwaitTime'
import type { User } from '../../domain/entities/user'
import type { CounselorCandidate } from '../../domain/entities/counselor'
import type { OnlineSession } from '../../domain/entities/onlineSession'
import type { Application } from '../../domain/entities/application'
import type { ApplicationDocument } from '../../domain/entities/applicationDocument'
import type { VisitRepository, CreateVisitInput } from '../ports/VisitRepository'
import type { UserRepository, CreateUserInput } from '../ports/UserRepository'
import type { SpecializationRepository } from '../ports/SpecializationRepository'
import type { BreakRepository, BreakRecord } from '../ports/BreakRepository'
import type { OnlineSessionRepository } from '../ports/OnlineSessionRepository'
import type { Clock } from '../ports/Clock'
import type {
  PasswordResetTokenRepository,
  PasswordResetTokenRecord,
} from '../ports/PasswordResetTokenRepository'
import type { EmailSender } from '../ports/EmailSender'
import type { ApplicationRepository, CreateApplicationInput } from '../ports/ApplicationRepository'
import type {
  ApplicationDocumentRepository,
  CreateApplicationDocumentInput,
} from '../ports/ApplicationDocumentRepository'

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

// الـSQL الحقيقي يرتّب الأحدث أولاً؛ بدون هذا التستات تتحقق من ترتيب الإدخال
function byNewestFirst<T extends { createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function createFakeVisitRepository(seed: Visit[] = []): VisitRepository {
  const visits = [...seed]
  return {
    async create(input: CreateVisitInput) {
      const now = new Date()
      const visit: Visit = {
        id: nextId('visit'),
        status: 'next',
        studentStatus: 'waiting',
        pickedUpAt: null,
        closedAt: null,
        note: null,
        followUpDueAt: null,
        createdAt: now,
        updatedAt: now,
        ...input,
        assignedAt: input.counselorId ? now : null,
      }
      visits.push(visit)
      return visit
    },
    async findById(id) {
      return visits.find((v) => v.id === id) ?? null
    },
    async findMostRecentByPhone(phone) {
      const matches = visits
        .filter((v) => v.phone === phone)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      return matches[0] ?? null
    },
    async findMostRecentNewVisitByPhone(phone) {
      const matches = visits
        .filter((v) => v.phone === phone && v.type === 'new')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      return matches[0] ?? null
    },
    async findAssignedQueueForCounselor(counselorId) {
      // ORDER BY created_at ASC — نفس ترتيب الـSQL: الأقدم أول بالطابور
      return visits
        .filter((v) => v.counselorId === counselorId && v.pickedUpAt === null)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    },
    async findInProgressForCounselor(counselorId) {
      return (
        visits.find(
          (v) => v.counselorId === counselorId && v.pickedUpAt !== null && v.closedAt === null
        ) ?? null
      )
    },
    async findAllForCounselor(counselorId) {
      return byNewestFirst(visits.filter((v) => v.counselorId === counselorId))
    },
    async updateCounselor(visitId, counselorId) {
      const visit = visits.find((v) => v.id === visitId)
      if (visit) {
        visit.counselorId = counselorId
        visit.assignedAt = counselorId ? new Date() : null
      }
    },
    async markPickedUp(visitId, pickedUpAt) {
      const visit = visits.find((v) => v.id === visitId)
      if (visit) {
        visit.pickedUpAt = pickedUpAt
        visit.studentStatus = 'in_session'
      }
    },
    async markClosed(visitId, closedAt, status, studentStatus, note, followUpDueAt) {
      const visit = visits.find((v) => v.id === visitId)
      if (visit) {
        visit.closedAt = closedAt
        visit.status = status
        visit.studentStatus = studentStatus
        visit.note = note ?? null
        visit.followUpDueAt = followUpDueAt ?? null
      }
    },
    async setStudentStatus(visitId, studentStatus, followUpDueAt) {
      const visit = visits.find((v) => v.id === visitId)
      if (visit && visit.status === 'closed') {
        visit.studentStatus = studentStatus
        visit.followUpDueAt = followUpDueAt
      }
    },
    async findAllByPhones(phones) {
      const wanted = new Set(phones)
      return byNewestFirst(visits.filter((v) => wanted.has(v.phone)))
    },
    async findAllMatchingName(normalizedTerm) {
      return byNewestFirst(
        visits.filter((v) => normalizeSearchText(v.name).includes(normalizedTerm))
      )
    },
    async countAll() {
      return visits.length
    },
    async findClosedInRange(fromInclusive, toExclusive) {
      return byNewestFirst(
        visits.filter(
          (v) => v.closedAt !== null && v.closedAt >= fromInclusive && v.closedAt < toExclusive
        )
      )
    },
    async findAllInRange(fromInclusive, toExclusive) {
      return byNewestFirst(
        visits.filter((v) => v.createdAt >= fromInclusive && v.createdAt < toExclusive)
      )
    },
    async findAllByType(type) {
      return byNewestFirst(visits.filter((v) => v.type === type))
    },
    async findAllByPhone(phone) {
      return visits
        .filter((v) => v.phone === phone)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },
    async findAllByStudentStatus(studentStatus) {
      return visits
        .filter((v) => v.studentStatus === studentStatus)
        .sort((a, b) => {
          if (!a.followUpDueAt) return 1
          if (!b.followUpDueAt) return -1
          return a.followUpDueAt.getTime() - b.followUpDueAt.getTime()
        })
    },
    async findStrandedVisitIds(visitIds) {
      return visits
        .filter((v) => visitIds.includes(v.id) && v.status === 'next' && v.counselorId === null)
        .map((v) => v.id)
    },
    async deleteVisit(visitId) {
      const index = visits.findIndex((v) => v.id === visitId)
      if (index !== -1) visits.splice(index, 1)
    },
  }
}

export function createFakeUserRepository(seed: User[] = []): UserRepository {
  const users = [...seed]
  return {
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null
    },
    async findById(id) {
      return users.find((u) => u.id === id) ?? null
    },
    async findActiveCounselors() {
      return users.filter((u) => u.role === 'counselor' && u.active)
    },
    async findAll() {
      return [...users]
    },
    async create(input: CreateUserInput) {
      const user: User = {
        id: nextId('user'),
        active: true,
        lastSeenAt: null,
        onlineSecondsToday: 0,
        onlineDay: null,
        shift: null,
        floor: null,
        note: null,
        nameAr: null,
        ...input,
      }
      users.push(user)
      return user
    },
    async setActive(userId, active) {
      const user = users.find((u) => u.id === userId)
      if (user) user.active = active
    },
    async setPasswordHash(userId, passwordHash) {
      const user = users.find((u) => u.id === userId)
      if (user) user.passwordHash = passwordHash
    },
    async setName(userId, name) {
      const user = users.find((u) => u.id === userId)
      if (user) user.name = name
    },
    async setNameAr(userId, nameAr) {
      const user = users.find((u) => u.id === userId)
      if (user) user.nameAr = nameAr
    },
    async countByRole(role) {
      return users.filter((u) => u.role === role).length
    },
    async deleteUser(userId) {
      const index = users.findIndex((u) => u.id === userId)
      if (index !== -1) users.splice(index, 1)
    },
    async recordPresenceHeartbeat(userId, seenAt, incrementSeconds) {
      const user = users.find((u) => u.id === userId)
      if (!user) return
      const day = kuwaitDayKey(seenAt)
      user.lastSeenAt = seenAt
      user.onlineSecondsToday =
        user.onlineDay === day ? user.onlineSecondsToday + incrementSeconds : incrementSeconds
      user.onlineDay = day
    },
    async setShiftInfo(userId, shift, floor) {
      const user = users.find((u) => u.id === userId)
      if (!user) return
      user.shift = shift
      user.floor = floor
    },
    async setNote(userId, note) {
      const user = users.find((u) => u.id === userId)
      if (user) user.note = note
    },
    async setRole(userId, role) {
      const user = users.find((u) => u.id === userId)
      if (user) user.role = role
    },
  }
}

export function createFakeSpecializationRepository(
  seed: CounselorCandidate[] = [],
  // المعطّلون ما يظهرون بالمرشحين — نمررهم لحالهم عشان التستات تقدر تمثّل
  // "فيه من يغطيها بس حسابه مقفل"
  deactivatedScopeHolders: SpecializationScope[] = []
): SpecializationRepository {
  const candidates = [...seed]
  // مكان الدورة لكل نطاق، مثل ختم last_assigned_at على صف النطاق بالقاعدة
  const lastAssignedByScope = new Map<string, string>()
  return {
    async countDeactivatedScopeHolders(scope) {
      return deactivatedScopeHolders.filter((held) => held === scope).length
    },
    async findScopesForCounselor(counselorId) {
      return candidates.find((c) => c.id === counselorId)?.scopes ?? []
    },
    async findScopesForCounselors(counselorIds) {
      const byCounselor: Record<string, SpecializationScope[]> = {}
      for (const candidate of candidates) {
        if (counselorIds.includes(candidate.id)) byCounselor[candidate.id] = candidate.scopes
      }
      return byCounselor
    },
    async findCandidatesForActiveCounselors() {
      return candidates
    },
    async setScopes(counselorId, scopes) {
      const candidate = candidates.find((c) => c.id === counselorId)
      if (candidate) candidate.scopes = scopes
    },
    async findLastAssignedCounselorForScope(scope) {
      return lastAssignedByScope.get(scope) ?? null
    },
    async recordAssignment(counselorId, scope, assignedAt) {
      lastAssignedByScope.set(scope, counselorId)
      const candidate = candidates.find((c) => c.id === counselorId)
      if (candidate) candidate.lastAssignedAt = assignedAt
    },
  }
}

export function createFakeBreakRepository(): BreakRepository {
  const breaks: BreakRecord[] = []
  return {
    async startBreak(counselorId, startedAt) {
      const record: BreakRecord = { id: nextId('break'), counselorId, startedAt, endedAt: null }
      breaks.push(record)
      return record
    },
    async endBreak(counselorId, endedAt) {
      const open = breaks.find((b) => b.counselorId === counselorId && b.endedAt === null)
      if (open) open.endedAt = endedAt
    },
    async findOpenBreak(counselorId) {
      return breaks.find((b) => b.counselorId === counselorId && b.endedAt === null) ?? null
    },
    async sumFinishedBreakMsToday(counselorId, now) {
      const startOfDay = startOfKuwaitDay(now)
      return breaks
        .filter(
          (b) => b.counselorId === counselorId && b.endedAt !== null && b.startedAt >= startOfDay
        )
        .reduce((sum, b) => sum + (b.endedAt!.getTime() - b.startedAt.getTime()), 0)
    },
  }
}

export function createFakeOnlineSessionRepository(
  seed: OnlineSession[] = []
): OnlineSessionRepository {
  const sessions = [...seed]
  return {
    async findMostRecent(userId) {
      const forUser = sessions.filter((s) => s.userId === userId)
      if (forUser.length === 0) return null
      return forUser.reduce((latest, s) => (s.startedAt > latest.startedAt ? s : latest))
    },
    async create(userId, startedAt, endedAt) {
      const session: OnlineSession = { id: nextId('session'), userId, startedAt, endedAt }
      sessions.push(session)
      return session
    },
    async extendEnd(sessionId, endedAt) {
      const session = sessions.find((s) => s.id === sessionId)
      if (session) session.endedAt = endedAt
    },
    async findForUserInRange(userId, fromInclusive, toExclusive) {
      return sessions
        .filter(
          (s) => s.userId === userId && s.startedAt >= fromInclusive && s.startedAt < toExclusive
        )
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    },
  }
}

export function createFixedClock(date: Date): Clock {
  return { now: () => date }
}

export function createFakePasswordResetTokenRepository(): PasswordResetTokenRepository {
  const records: PasswordResetTokenRecord[] = []
  return {
    async create(userId, tokenHash, expiresAt) {
      const record: PasswordResetTokenRecord = {
        id: nextId('reset-token'),
        userId,
        tokenHash,
        expiresAt,
        usedAt: null,
      }
      records.push(record)
      return record
    },
    async findByTokenHash(tokenHash) {
      return records.find((r) => r.tokenHash === tokenHash) ?? null
    },
    async markUsed(id, usedAt) {
      const record = records.find((r) => r.id === id)
      if (record) record.usedAt = usedAt
    },
    async claimToken(tokenHash, usedAt) {
      const record = records.find((r) => r.tokenHash === tokenHash && r.usedAt === null)
      if (!record) return null
      record.usedAt = usedAt
      return record
    },
  }
}

export function createFakeEmailSender(): EmailSender & { sentTo: string[]; sentLinks: string[] } {
  const sentTo: string[] = []
  const sentLinks: string[] = []
  return {
    sentTo,
    sentLinks,
    async sendPasswordResetEmail(to, resetLink) {
      sentTo.push(to)
      sentLinks.push(resetLink)
    },
  }
}

export function createFakeApplicationRepository(seed: Application[] = []): ApplicationRepository {
  const applications = [...seed]
  const numberCounterByKind: Record<string, number> = { visa: 0, exam: 0 }
  return {
    async create(input: CreateApplicationInput) {
      const now = new Date()
      numberCounterByKind[input.kind] += 1
      const prefix = input.kind === 'visa' ? 'VISA' : 'EXAM'
      const application: Application = {
        id: nextId('application'),
        applicationNumber: `${prefix}-${String(numberCounterByKind[input.kind]).padStart(4, '0')}`,
        status: 'pending',
        statusNote: null,
        referenceNumber: null,
        counselorId: null,
        paymentUrl: null,
        acceptedAt: null,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
        ...input,
      }
      applications.push(application)
      return application
    },
    async findById(id) {
      return applications.find((a) => a.id === id) ?? null
    },
    async findAllByKind(kind) {
      return applications.filter((a) => a.kind === kind)
    },
    async findByCounselor(counselorId) {
      return applications.filter((a) => a.counselorId === counselorId)
    },
    async findAllByPhones(phones) {
      const wanted = new Set(phones)
      return applications.filter((a) => wanted.has(a.phone))
    },
    async findAllByKindMatchingName(kind, normalizedTerm) {
      return applications.filter(
        (a) => a.kind === kind && normalizeSearchText(a.name).includes(normalizedTerm)
      )
    },
    async findAllByKindInRange(kind, from, to) {
      return applications.filter((a) => a.kind === kind && a.createdAt >= from && a.createdAt < to)
    },
    async countAll() {
      return applications.length
    },
    async findAllInRange(from, to) {
      return applications.filter((a) => a.createdAt >= from && a.createdAt < to)
    },
    async findAllByPhone(phone) {
      return applications
        .filter((a) => a.phone === phone)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },
    async updateStatus(id, status, statusNote, referenceNumber) {
      const application = applications.find((a) => a.id === id)
      if (!application) return
      application.status = status
      application.statusNote = statusNote
      application.referenceNumber = referenceNumber
      application.updatedAt = new Date()
      if ((status === 'approved' || status === 'rejected') && !application.closedAt) {
        application.closedAt = new Date()
      }
    },
    async assignCounselor(id, counselorId) {
      const application = applications.find((a) => a.id === id)
      if (!application) return
      application.counselorId = counselorId
      if (counselorId && !application.acceptedAt) {
        application.acceptedAt = new Date()
      }
    },
    async setPaymentUrl(id, paymentUrl) {
      const application = applications.find((a) => a.id === id)
      if (application) application.paymentUrl = paymentUrl
    },
    async deleteApplication(id) {
      const index = applications.findIndex((a) => a.id === id)
      if (index !== -1) applications.splice(index, 1)
    },
  }
}

export function createFakeApplicationDocumentRepository(
  seed: ApplicationDocument[] = []
): ApplicationDocumentRepository {
  const documents = [...seed]
  return {
    async create(input: CreateApplicationDocumentInput) {
      const document: ApplicationDocument = {
        id: nextId('document'),
        uploadedAt: new Date(),
        ...input,
      }
      documents.push(document)
      return document
    },
    async findById(id) {
      return documents.find((d) => d.id === id) ?? null
    },
    async findByApplicationId(applicationId) {
      return documents.filter((d) => d.applicationId === applicationId)
    },
    async findLabelsByApplicationIds(applicationIds) {
      const byApplication: Record<string, string[]> = {}
      for (const document of documents) {
        if (!applicationIds.includes(document.applicationId) || !document.documentLabel) continue
        byApplication[document.applicationId] = [
          ...(byApplication[document.applicationId] ?? []),
          document.documentLabel,
        ]
      }
      return byApplication
    },
  }
}
