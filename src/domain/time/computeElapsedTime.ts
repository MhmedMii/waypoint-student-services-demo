export type ElapsedTime =
  | { status: 'not_started' }
  | { status: 'running'; elapsedMs: number }
  | { status: 'finished'; elapsedMs: number }

export function computeElapsedTime(
  startedAt: Date | null,
  endedAt: Date | null,
  now: Date
): ElapsedTime {
  if (startedAt === null) return { status: 'not_started' }
  if (endedAt === null) return { status: 'running', elapsedMs: now.getTime() - startedAt.getTime() }
  return { status: 'finished', elapsedMs: endedAt.getTime() - startedAt.getTime() }
}
