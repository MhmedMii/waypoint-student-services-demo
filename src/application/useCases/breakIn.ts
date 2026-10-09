import type { BreakRepository } from '../ports/BreakRepository'
import type { Clock } from '../ports/Clock'

export interface BreakInDeps {
  breakRepository: BreakRepository
  clock: Clock
}

export type BreakInResult = { ok: true } | { ok: false; reason: string }

export async function breakIn(counselorId: string, deps: BreakInDeps): Promise<BreakInResult> {
  const open = await deps.breakRepository.findOpenBreak(counselorId)
  if (!open) return { ok: false, reason: 'noBreakOpen' }

  await deps.breakRepository.endBreak(counselorId, deps.clock.now())
  return { ok: true }
}
