import { describe, test, expect } from 'vitest'
import { canTransitionApplicationStatus } from './applicationStatusTransitions'

describe('canTransitionApplicationStatus', () => {
  test('allows every legal edge in the pipeline', () => {
    expect(canTransitionApplicationStatus('pending', 'under_review')).toBe(true)
    expect(canTransitionApplicationStatus('under_review', 'documents_requested')).toBe(true)
    expect(canTransitionApplicationStatus('under_review', 'submitted_to_source')).toBe(true)
    expect(canTransitionApplicationStatus('documents_requested', 'under_review')).toBe(true)
    expect(canTransitionApplicationStatus('documents_requested', 'submitted_to_source')).toBe(true)
    expect(canTransitionApplicationStatus('submitted_to_source', 'documents_requested')).toBe(true)
    expect(canTransitionApplicationStatus('submitted_to_source', 'approved')).toBe(true)
    expect(canTransitionApplicationStatus('submitted_to_source', 'rejected')).toBe(true)
  })

  test('rejects illegal jumps that skip review steps', () => {
    expect(canTransitionApplicationStatus('pending', 'approved')).toBe(false)
    expect(canTransitionApplicationStatus('pending', 'submitted_to_source')).toBe(false)
    expect(canTransitionApplicationStatus('under_review', 'approved')).toBe(false)
    expect(canTransitionApplicationStatus('under_review', 'rejected')).toBe(false)
  })

  test('rejects moving backward to pending from any later state', () => {
    expect(canTransitionApplicationStatus('under_review', 'pending')).toBe(false)
    expect(canTransitionApplicationStatus('documents_requested', 'pending')).toBe(false)
    expect(canTransitionApplicationStatus('submitted_to_source', 'pending')).toBe(false)
  })

  test('terminal states have no legal outgoing transitions', () => {
    expect(canTransitionApplicationStatus('approved', 'under_review')).toBe(false)
    expect(canTransitionApplicationStatus('approved', 'rejected')).toBe(false)
    expect(canTransitionApplicationStatus('rejected', 'under_review')).toBe(false)
    expect(canTransitionApplicationStatus('rejected', 'approved')).toBe(false)
  })
})
