import { describe, it, expect } from 'vitest'
import { pickCounselorForVisaServices } from './pickCounselorForVisaServices'
import type { CounselorCandidate } from '../entities/counselor'

const omar: CounselorCandidate = { id: 'omar', scopes: ['visa_services'], lastAssignedAt: null }
const other: CounselorCandidate = { id: 'other', scopes: ['visa_services'], lastAssignedAt: null }
const demoCounselorOne: CounselorCandidate = {
  id: 'demoCounselorOne',
  scopes: ['USA', 'UK & Ireland'],
  lastAssignedAt: null,
}
const demoCounselorSeven: CounselorCandidate = {
  id: 'demoCounselorSeven',
  scopes: [
    'Medicine',
    'USA',
    'UK & Ireland',
    'Australia & New Zealand',
    'Europe & Other Countries',
    'GCC',
    'Egypt',
  ],
  lastAssignedAt: null,
}

describe('pickCounselorForVisaServices', () => {
  it('routes to the visa_services-scoped counselor', () => {
    expect(pickCounselorForVisaServices([omar, demoCounselorOne], null)?.id).toBe('omar')
  })

  it('a counselor scoped for every country is not eligible for visa services', () => {
    expect(pickCounselorForVisaServices([demoCounselorSeven], null)).toBeNull()
  })

  it('ignores a country-scoped counselor when picking among visa candidates', () => {
    expect(pickCounselorForVisaServices([omar, demoCounselorSeven], null)?.id).toBe('omar')
  })

  it('takes turns among visa counselors', () => {
    expect(pickCounselorForVisaServices([omar, other], 'omar')?.id).toBe('other')
    expect(pickCounselorForVisaServices([omar, other], 'other')?.id).toBe('omar')
  })

  it('returns null when no counselor has visa_services scope', () => {
    expect(pickCounselorForVisaServices([demoCounselorOne], null)).toBeNull()
  })
})
