import { describe, it, expect } from 'vitest'
import { pickCounselorForExamServices } from './pickCounselorForExamServices'
import type { CounselorCandidate } from '../entities/counselor'

const omar: CounselorCandidate = { id: 'omar', scopes: ['exam_services'], lastAssignedAt: null }
const other: CounselorCandidate = { id: 'other', scopes: ['exam_services'], lastAssignedAt: null }
const demoCounselorOne: CounselorCandidate = {
  id: 'demoCounselorOne',
  scopes: ['USA', 'UK & Ireland'],
  lastAssignedAt: null,
}

describe('pickCounselorForExamServices', () => {
  it('routes to the exam_services-scoped counselor', () => {
    expect(pickCounselorForExamServices([omar, demoCounselorOne], null)?.id).toBe('omar')
  })

  it('returns null when no counselor has exam_services scope', () => {
    expect(pickCounselorForExamServices([demoCounselorOne], null)).toBeNull()
  })

  it('takes turns among exam counselors', () => {
    expect(pickCounselorForExamServices([omar, other], 'omar')?.id).toBe('other')
    expect(pickCounselorForExamServices([omar, other], 'other')?.id).toBe('omar')
  })
})
