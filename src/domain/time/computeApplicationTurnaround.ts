import type { ApplicationStatus } from '../entities/application'

const TERMINAL_STATUSES = ['approved', 'rejected'] as const
const WITHIN_HOURS = 24

export type ApplicationTurnaround =
  | { status: 'within24h'; hours: number }
  | { status: 'over24h'; hours: number }
  | { status: 'in_progress'; hours: number }

interface TurnaroundInput {
  status: ApplicationStatus
  createdAt: Date
  updatedAt: Date
}

function isTerminal(status: ApplicationStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

export function computeApplicationTurnaround(
  application: TurnaroundInput,
  now: Date
): ApplicationTurnaround {
  if (isTerminal(application.status)) {
    const hours = (application.updatedAt.getTime() - application.createdAt.getTime()) / 3600000
    return { status: hours <= WITHIN_HOURS ? 'within24h' : 'over24h', hours }
  }
  const hours = (now.getTime() - application.createdAt.getTime()) / 3600000
  return { status: 'in_progress', hours }
}
