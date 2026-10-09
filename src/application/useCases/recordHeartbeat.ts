import type { UserRepository } from '../ports/UserRepository'
import type { OnlineSessionRepository } from '../ports/OnlineSessionRepository'
import type { Clock } from '../ports/Clock'
import { shouldStartNewSession } from '../../domain/time/shouldStartNewSession'
import { HEARTBEAT_INTERVAL_SECONDS, ONLINE_THRESHOLD_MS } from '../../domain/time/presenceTiming'

export interface RecordHeartbeatDeps {
  userRepository: UserRepository
  onlineSessionRepository: OnlineSessionRepository
  clock: Clock
}

export async function recordHeartbeat(userId: string, deps: RecordHeartbeatDeps): Promise<void> {
  const now = deps.clock.now()
  await deps.userRepository.recordPresenceHeartbeat(userId, now, HEARTBEAT_INTERVAL_SECONDS)

  const mostRecent = await deps.onlineSessionRepository.findMostRecent(userId)
  if (shouldStartNewSession(mostRecent?.endedAt ?? null, now, ONLINE_THRESHOLD_MS)) {
    await deps.onlineSessionRepository.create(userId, now, now)
  } else {
    await deps.onlineSessionRepository.extendEnd(mostRecent!.id, now)
  }
}
