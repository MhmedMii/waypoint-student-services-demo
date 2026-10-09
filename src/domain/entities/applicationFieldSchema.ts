import type { ServiceCode } from './application'

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'select' | 'radio' | 'textarea' | 'file'

export interface FieldDef {
  kind: 'field'
  id: string
  type: FieldType
  label: string
  labelAr: string
  required: boolean
  hint?: string
  hintAr?: string
  options?: string[]
  optionsAr?: string[]
  defaultValue?: string
  optionsSource?: 'activeCounselors'
}

export interface RepeatGroupDef {
  kind: 'repeatGroup'
  id: string
  label: string
  labelAr: string
  count: number
  columns: Array<{ id: string; type: 'text' | 'date'; placeholder: string; placeholderAr: string }>
  required?: boolean
}

export interface ConditionalSectionDef {
  kind: 'conditionalSection'
  id: string
  label: string
  labelAr: string
  visibleWhen: { fieldId: string; equals: string }
  fields: Array<FieldDef | RepeatGroupDef>
}

export type SchemaEntry = FieldDef | RepeatGroupDef | ConditionalSectionDef

export interface DocumentSlotDef {
  id: string
  label: string
  labelAr: string
  required: boolean
  hint?: string
  hintAr?: string
  visibleWhen?: { fieldId: string; equals: string }
}

export interface ServiceFormSchema {
  serviceCode: ServiceCode
  documents: DocumentSlotDef[]
  fields: SchemaEntry[]
  serviceChargeKd?: number
}

export function field(def: Omit<FieldDef, 'kind'>): FieldDef {
  return { kind: 'field', ...def }
}

export function repeatGroup(def: Omit<RepeatGroupDef, 'kind'>): RepeatGroupDef {
  return { kind: 'repeatGroup', ...def }
}

export function conditionalSection(
  def: Omit<ConditionalSectionDef, 'kind'>
): ConditionalSectionDef {
  return { kind: 'conditionalSection', ...def }
}
