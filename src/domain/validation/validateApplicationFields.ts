import { validateVisitorName } from './validateVisitorName'
import { validatePhoneNumber } from './validatePhoneNumber'
import {
  VISA_SERVICES,
  EXAM_SERVICES,
  type ApplicationKind,
  type ServiceCode,
} from '../entities/application'

export type ApplicationFieldsValidationResult =
  { isValid: true } | { isValid: false; reason: string }

const MAX_FIELD_COUNT = 40
const MAX_FIELD_VALUE_LENGTH = 2000

export interface ApplicationSubmissionInput {
  kind: ApplicationKind
  serviceCode: string
  name: string
  phone: string
  fields: Record<string, unknown>
}

function isServiceCodeValidForKind(
  kind: ApplicationKind,
  serviceCode: string
): serviceCode is ServiceCode {
  const catalog: readonly string[] = kind === 'visa' ? VISA_SERVICES : EXAM_SERVICES
  return catalog.includes(serviceCode)
}

// نتحقق من بيانات طلب الفيزا/الاختبار قبل التخزين — نقطة عامة بدون تسجيل دخول، فلازم تحقق صارم
export function validateApplicationFields(
  input: ApplicationSubmissionInput
): ApplicationFieldsValidationResult {
  const nameResult = validateVisitorName(input.name)
  if (!nameResult.isValid) return { isValid: false, reason: nameResult.reason }

  const phoneResult = validatePhoneNumber(input.phone)
  if (!phoneResult.isValid) return { isValid: false, reason: phoneResult.reason }

  if (!isServiceCodeValidForKind(input.kind, input.serviceCode)) {
    return { isValid: false, reason: 'invalidServiceForKind' }
  }

  const fieldEntries = Object.entries(input.fields)
  if (fieldEntries.length > MAX_FIELD_COUNT) {
    return { isValid: false, reason: 'tooManyFields' }
  }

  const hasInvalidValue = fieldEntries.some(
    ([, value]) => typeof value !== 'string' || value.length > MAX_FIELD_VALUE_LENGTH
  )
  if (hasInvalidValue) {
    return { isValid: false, reason: 'fieldValueTooLong' }
  }

  return { isValid: true }
}
