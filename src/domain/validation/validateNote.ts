export type NoteValidationResult = { isValid: true } | { isValid: false; reason: string }

// حد أقصى صغير عمداً — ملاحظة سريعة، مو تقرير مفصّل
export const MAX_NOTE_LENGTH = 50

export function validateNote(note: unknown): NoteValidationResult {
  if (note === null || note === undefined) return { isValid: true }
  if (typeof note !== 'string') {
    return { isValid: false, reason: 'noteMustBeText' }
  }
  if (note.trim().length > MAX_NOTE_LENGTH) {
    return { isValid: false, reason: 'noteTooLong' }
  }
  return { isValid: true }
}
