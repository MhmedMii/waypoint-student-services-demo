'use client'
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type {
  ServiceFormSchema,
  FieldDef,
  RepeatGroupDef,
  ConditionalSectionDef,
} from '../domain/entities/applicationFieldSchema'
import { collectFieldDefaults, isVisibleWhen } from '../domain/entities/requiredDocuments'

function schemaUsesActiveCounselors(
  entries: Array<FieldDef | RepeatGroupDef | ConditionalSectionDef>
): boolean {
  return entries.some((entry) => {
    if (entry.kind === 'field') return entry.optionsSource === 'activeCounselors'
    if (entry.kind === 'conditionalSection') return schemaUsesActiveCounselors(entry.fields)
    return false
  })
}

// null = ما قدرنا نحمّل. [] = حمّلنا وما فيه أحد — سببان مختلفان، ولكل واحد رسالته
async function fetchActiveCounselorNames(): Promise<string[] | null> {
  try {
    const data = await (await fetch('/api/counselors/active')).json()
    return Array.isArray(data) ? data.map((c: { name: string }) => c.name) : null
  } catch {
    return null
  }
}

export interface DynamicFieldsProps {
  schema: ServiceFormSchema
  values: Record<string, string>
  onChange: (fieldId: string, value: string) => void
  repeatValues: Record<string, string[][]>
  onRepeatChange: (
    groupId: string,
    rowIndex: number,
    colId: string,
    value: string,
    columns: RepeatGroupDef['columns']
  ) => void
  documentFiles: Record<string, File | null>
  onDocumentChange: (slotId: string, file: File | null) => void
}

function FieldInput({
  def,
  value,
  onChange,
  activeCounselorNames,
  language,
  yesLabel,
  noLabel,
  selectPlaceholder,
}: {
  def: FieldDef
  value: string
  onChange: (v: string) => void
  activeCounselorNames: string[]
  language: 'en' | 'ar'
  yesLabel: string
  noLabel: string
  selectPlaceholder: string
}) {
  const inputId = `apply-field-${def.id}`
  if (def.type === 'radio') {
    return (
      <div className="apply-radio-row">
        <label>
          <input
            type="radio"
            name={def.id}
            checked={value === 'Yes'}
            onChange={() => onChange('Yes')}
          />{' '}
          {yesLabel}
        </label>
        <label>
          <input
            type="radio"
            name={def.id}
            checked={value !== 'Yes'}
            onChange={() => onChange('No')}
          />{' '}
          {noLabel}
        </label>
      </div>
    )
  }
  if (def.type === 'select') {
    const options =
      def.optionsSource === 'activeCounselors'
        ? ['Select...', ...activeCounselorNames]
        : (def.options ?? [])
    const optionLabels =
      def.optionsSource === 'activeCounselors'
        ? ['Select...', ...activeCounselorNames]
        : language === 'ar' && def.optionsAr
          ? def.optionsAr
          : options
    return (
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={def.required}
      >
        {options.map((option, index) => {
          const optionValue = option === 'Select...' ? '' : option
          const optionLabel = option === 'Select...' ? selectPlaceholder : optionLabels[index]
          return (
            <option key={option} value={optionValue}>
              {optionLabel}
            </option>
          )
        })}
      </select>
    )
  }
  if (def.type === 'textarea') {
    return (
      <textarea
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={def.required}
      />
    )
  }
  return (
    <input
      id={inputId}
      type={def.type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={def.required}
    />
  )
}

function renderField(
  def: FieldDef,
  values: Record<string, string>,
  onChange: (fieldId: string, value: string) => void,
  activeCounselorNames: string[],
  language: 'en' | 'ar',
  yesLabel: string,
  noLabel: string,
  selectPlaceholder: string,
  counselorListNote: string | null
) {
  const isAr = language === 'ar'
  return (
    <div key={def.id} className="apply-dynamic-field">
      <label htmlFor={`apply-field-${def.id}`}>
        {isAr ? def.labelAr : def.label}
        {def.required && <span className="req">*</span>}
      </label>
      {def.hint && (
        <div className="apply-field-hint">{isAr && def.hintAr ? def.hintAr : def.hint}</div>
      )}
      <FieldInput
        def={def}
        value={values[def.id] ?? def.defaultValue ?? ''}
        onChange={(v) => onChange(def.id, v)}
        activeCounselorNames={activeCounselorNames}
        language={language}
        yesLabel={yesLabel}
        noLabel={noLabel}
        selectPlaceholder={selectPlaceholder}
      />
      {def.optionsSource === 'activeCounselors' && counselorListNote && (
        <ul className="err" role="alert">
          <li>{counselorListNote}</li>
        </ul>
      )}
    </div>
  )
}

interface DocumentSlotProps {
  slot: ServiceFormSchema['documents'][number]
  documentFiles: Record<string, File | null>
  onDocumentChange: (slotId: string, file: File | null) => void
  language: 'en' | 'ar'
}

function renderDocumentSlot({
  slot,
  documentFiles,
  onDocumentChange,
  language,
}: DocumentSlotProps) {
  const isAr = language === 'ar'
  return (
    <div key={slot.id} className="apply-dynamic-field">
      <label htmlFor={`apply-doc-${slot.id}`}>
        {isAr ? slot.labelAr : slot.label}
        {slot.required && <span className="req">*</span>}
      </label>
      {slot.hint && (
        <div className="apply-field-hint">{isAr && slot.hintAr ? slot.hintAr : slot.hint}</div>
      )}
      <input
        id={`apply-doc-${slot.id}`}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        required={slot.required}
        onChange={(e) => onDocumentChange(slot.id, e.target.files?.[0] ?? null)}
      />
      {documentFiles[slot.id] && (
        <span className="apply-file-chosen">{documentFiles[slot.id]!.name}</span>
      )}
    </div>
  )
}

function renderRepeatGroup(
  def: RepeatGroupDef,
  repeatValues: Record<string, string[][]>,
  onRepeatChange: DynamicFieldsProps['onRepeatChange'],
  language: 'en' | 'ar'
) {
  const isAr = language === 'ar'
  const rows =
    repeatValues[def.id] ?? Array.from({ length: def.count }, () => def.columns.map(() => ''))
  return (
    <div key={def.id} className="apply-dynamic-field">
      <label>{isAr ? def.labelAr : def.label}</label>
      {rows.map((row, rowIndex) => (
        <div
          className="apply-repeat-row"
          key={rowIndex}
          style={{ gridTemplateColumns: `repeat(${def.columns.length}, 1fr)` }}
        >
          {def.columns.map((col, colIndex) => (
            <input
              key={col.id}
              type={col.type}
              placeholder={isAr ? col.placeholderAr : col.placeholder}
              value={row[colIndex] ?? ''}
              required={def.required}
              onChange={(e) =>
                onRepeatChange(def.id, rowIndex, col.id, e.target.value, def.columns)
              }
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function DynamicServiceFields({
  schema,
  values,
  onChange,
  repeatValues,
  onRepeatChange,
  documentFiles,
  onDocumentChange,
}: DynamicFieldsProps) {
  const { t, language } = useLanguage()
  const isAr = language === 'ar'
  const [activeCounselorNames, setActiveCounselorNames] = useState<string[]>([])
  const [counselorsLoad, setCounselorsLoad] = useState<'pending' | 'ok' | 'failed'>('pending')

  useEffect(() => {
    if (!schemaUsesActiveCounselors(schema.fields)) return
    fetchActiveCounselorNames().then((names) => {
      // القائمة القديمة تبقى لو فشل تحميل لاحق
      if (names) setActiveCounselorNames(names)
      setCounselorsLoad(names ? 'ok' : 'failed')
    })
  }, [schema])

  // الخانة اختيارية: ما نوقف أحد، بس نقول ليش فاضية وإن الفراغ ما يمنع الإرسال
  const counselorListNote =
    activeCounselorNames.length > 0 || counselorsLoad === 'pending'
      ? null
      : t('apply', counselorsLoad === 'failed' ? 'counselorsLoadFailed' : 'noCounselorsAvailable')

  const yesLabel = t('apply', 'yesOption')
  const noLabel = t('apply', 'noOption')
  const selectPlaceholder = t('apply', 'selectPlaceholder')

  const fieldDefaults = collectFieldDefaults(schema.fields)
  const topLevelDocuments = schema.documents.filter((slot) => !slot.visibleWhen)
  const conditionalDocumentsByFieldId = new Map<string, typeof schema.documents>()
  for (const slot of schema.documents) {
    if (!slot.visibleWhen) continue
    const existing = conditionalDocumentsByFieldId.get(slot.visibleWhen.fieldId) ?? []
    conditionalDocumentsByFieldId.set(slot.visibleWhen.fieldId, [...existing, slot])
  }

  function renderEntries(entries: Array<FieldDef | RepeatGroupDef | ConditionalSectionDef>) {
    return entries.map((entry) => {
      if (entry.kind === 'field') {
        const linkedDocuments = (conditionalDocumentsByFieldId.get(entry.id) ?? []).filter(
          (slot) => slot.visibleWhen && isVisibleWhen(slot.visibleWhen, values, fieldDefaults)
        )
        return (
          <div key={entry.id} className="apply-dynamic-field-group">
            {renderField(
              entry,
              values,
              onChange,
              activeCounselorNames,
              language,
              yesLabel,
              noLabel,
              selectPlaceholder,
              counselorListNote
            )}
            {linkedDocuments.map((slot) =>
              renderDocumentSlot({ slot, documentFiles, onDocumentChange, language })
            )}
          </div>
        )
      }
      if (entry.kind === 'repeatGroup')
        return renderRepeatGroup(entry, repeatValues, onRepeatChange, language)
      if (!isVisibleWhen(entry.visibleWhen, values, fieldDefaults)) return null
      return (
        <fieldset key={entry.id} className="apply-conditional-section">
          <legend>{isAr ? entry.labelAr : entry.label}</legend>
          {renderEntries(entry.fields)}
        </fieldset>
      )
    })
  }

  return (
    <>
      {renderEntries(schema.fields)}
      {topLevelDocuments.length > 0 && (
        <>
          <div className="apply-section-label">{t('apply', 'documentsSection')}</div>
          {topLevelDocuments.map((slot) =>
            renderDocumentSlot({ slot, documentFiles, onDocumentChange, language })
          )}
        </>
      )}
      {schema.serviceChargeKd !== undefined && (
        <div className="apply-charge-note">
          {t('apply', 'serviceChargeLabel')}{' '}
          <b>
            {schema.serviceChargeKd} {t('apply', 'kdAbbreviation')}
          </b>
        </div>
      )}
    </>
  )
}
