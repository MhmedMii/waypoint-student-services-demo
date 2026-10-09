import type { OnlineSession } from '../../domain/entities/onlineSession'

export interface OnlineSessionRepository {
  findMostRecent(userId: string): Promise<OnlineSession | null>
  create(userId: string, startedAt: Date, endedAt: Date): Promise<OnlineSession>
  extendEnd(sessionId: string, endedAt: Date): Promise<void>
  findForUserInRange(
    userId: string,
    fromInclusive: Date,
    toExclusive: Date
  ): Promise<OnlineSession[]>
}
