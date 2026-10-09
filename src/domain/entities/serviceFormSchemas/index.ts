import type { ServiceCode } from '../application'
import type { ServiceFormSchema } from '../applicationFieldSchema'
import { ukStudentSchema } from './ukStudent'
import { usF1Schema } from './usF1'
import { maltaStudentSchema } from './maltaStudent'
import { irelandStudentSchema } from './irelandStudent'
import { australiaStudentSchema } from './australiaStudent'
import { newZealandStudentSchema } from './newZealandStudent'
import { ieltsSchema } from './ielts'
import { toeflSchema } from './toefl'

export const SERVICE_FORM_SCHEMAS: Record<ServiceCode, ServiceFormSchema> = {
  'uk-student': ukStudentSchema,
  'us-f1': usF1Schema,
  'malta-student': maltaStudentSchema,
  'ireland-student': irelandStudentSchema,
  'australia-student': australiaStudentSchema,
  'new-zealand-student': newZealandStudentSchema,
  ielts: ieltsSchema,
  toefl: toeflSchema,
}
