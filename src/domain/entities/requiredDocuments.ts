import type {
  ConditionalSectionDef,
  DocumentSlotDef,
  FieldDef,
  RepeatGroupDef,
  ServiceFormSchema,
} from './applicationFieldSchema'

type SchemaEntries = Array<FieldDef | RepeatGroupDef | ConditionalSectionDef>

export function collectFieldDefaults(entries: SchemaEntries): Record<string, string> {
  const defaults: Record<string, string> = {}
  for (const entry of entries) {
    if (entry.kind === 'field' && entry.defaultValue !== undefined)
      defaults[entry.id] = entry.defaultValue
    if (entry.kind === 'conditionalSection')
      Object.assign(defaults, collectFieldDefaults(entry.fields))
  }
  return defaults
}

export function isVisibleWhen(
  visibleWhen: { fieldId: string; equals: string },
  values: Record<string, string>,
  defaults: Record<string, string>
): boolean {
  return (values[visibleWhen.fieldId] ?? defaults[visibleWhen.fieldId]) === visibleWhen.equals
}

// خانة المستند الشرطية ما تُطلب إلا إذا كان جواب الحقل المرتبط فيها يطابق الشرط —
// مثلاً "نسخة جواز الأب" ما تظهر إلا لو المتقدّم قال إن عنده جواز أب
export function visibleDocumentSlots(
  schema: ServiceFormSchema,
  values: Record<string, string>
): DocumentSlotDef[] {
  const defaults = collectFieldDefaults(schema.fields)
  return schema.documents.filter(
    (slot) => !slot.visibleWhen || isVisibleWhen(slot.visibleWhen, values, defaults)
  )
}

// المستندات نربطها بالمسمّى (label) لأنه نفس القيمة المخزّنة بعمود document_label
// وقت الرفع — ما فيه معرّف خانة محفوظ مع الملف
export function missingRequiredDocuments(
  schema: ServiceFormSchema,
  values: Record<string, string>,
  uploadedLabels: readonly (string | null)[]
): DocumentSlotDef[] {
  const uploaded = new Set(uploadedLabels.filter((label): label is string => Boolean(label)))
  return visibleDocumentSlots(schema, values).filter(
    (slot) => slot.required && !uploaded.has(slot.label)
  )
}
