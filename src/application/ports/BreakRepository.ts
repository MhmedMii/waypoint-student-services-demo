export interface BreakRecord {
  id: string
  counselorId: string
  startedAt: Date
  endedAt: Date | null
}

export interface BreakRepository {
  startBreak(counselorId: string, startedAt: Date): Promise<BreakRecord>
  endBreak(counselorId: string, endedAt: Date): Promise<void>
  findOpenBreak(counselorId: string): Promise<BreakRecord | null>
  sumFinishedBreakMsToday(counselorId: string, now: Date): Promise<number>
}
