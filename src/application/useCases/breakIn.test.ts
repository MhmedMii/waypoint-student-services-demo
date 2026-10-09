import { describe, it, expect } from 'vitest'
import { breakOut } from './breakOut'
import { breakIn } from './breakIn'
import {
  createFakeVisitRepository,
  createFakeBreakRepository,
  createFixedClock,
} from '../testing/fakes'

describe('breakIn', () => {
  it('ends the currently open break', async () => {
    const visitRepository = createFakeVisitRepository()
    const breakRepository = createFakeBreakRepository()
    await breakOut('demoCounselorOne', {
      visitRepository,
      breakRepository,
      clock: createFixedClock(new Date('2026-08-12T11:00:00Z')),
    })

    const result = await breakIn('demoCounselorOne', {
      breakRepository,
      clock: createFixedClock(new Date('2026-08-12T11:15:00Z')),
    })
    expect(result.ok).toBe(true)

    const open = await breakRepository.findOpenBreak('demoCounselorOne')
    expect(open).toBeNull()
  })

  it('rejects ending a break when none is open', async () => {
    const breakRepository = createFakeBreakRepository()
    const result = await breakIn('demoCounselorOne', {
      breakRepository,
      clock: createFixedClock(new Date()),
    })
    expect(result.ok).toBe(false)
  })
})
