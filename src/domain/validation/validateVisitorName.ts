export type NameValidationResult = { isValid: true } | { isValid: false; reason: string }

const NAME_WORD_PATTERN = /^[\p{L}][\p{L}'-]*$/u

export function validateVisitorName(rawName: string): NameValidationResult {
  const words = rawName.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) {
    return { isValid: false, reason: 'nameNeedsTwoWords' }
  }
  const hasInvalidWord = words.some((word) => !NAME_WORD_PATTERN.test(word))
  if (hasInvalidWord) {
    return { isValid: false, reason: 'nameLettersOnly' }
  }
  return { isValid: true }
}
