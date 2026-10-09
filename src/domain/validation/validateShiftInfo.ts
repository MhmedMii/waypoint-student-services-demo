import type { Shift, Floor } from '../entities/user'

export type ShiftInfoValidationResult = { isValid: true } | { isValid: false; reason: string }

const VALID_SHIFTS: Shift[] = ['day', 'night']
const VALID_FLOORS: Floor[] = ['M1', 'M3']

// الثنتين لازم تكونوا null سوا (ما تحدد بعد) أو محددتين سوا — ما فيه حالة نص ونص
export function validateShiftInfo(shift: unknown, floor: unknown): ShiftInfoValidationResult {
  const allNull = shift === null && floor === null
  if (allNull) return { isValid: true }

  if (!VALID_SHIFTS.includes(shift as Shift)) {
    return { isValid: false, reason: 'shiftInvalid' }
  }
  if (!VALID_FLOORS.includes(floor as Floor)) {
    return { isValid: false, reason: 'floorInvalid' }
  }
  return { isValid: true }
}
