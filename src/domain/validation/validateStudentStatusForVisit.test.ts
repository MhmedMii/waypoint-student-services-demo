import { describe, it, expect } from 'vitest'
import type { VisitStudentStatus } from '../entities/visit'
import {
  editableStudentStatusesFor,
  validateStudentStatusForVisit,
} from './validateStudentStatusForVisit'

const ALL: VisitStudentStatus[] = ['waiting', 'in_session', 'follow_up_needed', 'closed']

describe('validateStudentStatusForVisit', () => {
  it('lets a closed visit be Closed or Follow-up needed', () => {
    expect(validateStudentStatusForVisit('closed', 'closed')).toEqual({ isValid: true })
    expect(validateStudentStatusForVisit('closed', 'follow_up_needed')).toEqual({ isValid: true })
  })

  it.each(['waiting', 'in_session'] as const)(
    'refuses %s on a closed visit (the contradiction that hit two real clients)',
    (studentStatus) => {
      expect(validateStudentStatusForVisit('closed', studentStatus)).toEqual({
        isValid: false,
        reason: 'studentStatusNotAllowedForVisit',
      })
    }
  )

  it.each(ALL)('does not allow a manual %s edit on an open visit', (studentStatus) => {
    expect(validateStudentStatusForVisit('next', studentStatus)).toEqual({
      isValid: false,
      reason: 'studentStatusNotAllowedForVisit',
    })
  })
})

describe('editableStudentStatusesFor', () => {
  it('offers Closed and Follow-up needed for a closed visit, nothing for an open one', () => {
    expect(editableStudentStatusesFor('closed')).toEqual(['closed', 'follow_up_needed'])
    expect(editableStudentStatusesFor('next')).toEqual([])
  })
})
