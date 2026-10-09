import type { OnlineSession } from '../../domain/entities/onlineSession'
import type { OnlineSessionRepository } from '../ports/OnlineSessionRepository'

export interface GetOnlineSessionsForDateDeps {
  onlineSessionRepository: OnlineSessionRepository
}

export interface OnlineSessionsForDateView {
  sessions: OnlineSession[]
  totalSeconds: number
}

// dayStart لازم يكون منتصف ليل ذاك اليوم (UTC) — الكولر مسؤول يبني هالتاريخ
export async function getOnlineSessionsForDate(
  userId: string,
  dayStart: Date,
  deps: GetOnlineSessionsForDateDeps
): Promise<OnlineSessionsForDateView> {
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const sessions = await deps.onlineSessionRepository.findForUserInRange(userId, dayStart, dayEnd)
  const totalSeconds = sessions.reduce(
    (sum, s) => sum + (s.endedAt.getTime() - s.startedAt.getTime()) / 1000,
    0
  )
  return { sessions, totalSeconds }
}
