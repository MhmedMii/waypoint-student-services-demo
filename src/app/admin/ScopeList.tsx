// src/app/admin/ScopeList.tsx
import { COUNTRY_SCOPES, type SpecializationScope } from '../../domain/entities/counselor'
import { COUNTRY_LABEL_KEYS } from '../../i18n/countryLabels'
import { useLanguage } from '../../i18n/LanguageContext'
import type { Dictionary } from '../../i18n/translations'

export const SCOPE_OPTIONS: SpecializationScope[] = [
  ...COUNTRY_SCOPES,
  'visa_services',
  'exam_services',
]

// كل نطاقات الدول تشترك بنفس نصوص قاموس countries — نطاق "خدمات التأشيرة" بس له مفتاحه الخاص بقاموس scopes

export function toggleScope(
  scopes: SpecializationScope[],
  scope: SpecializationScope
): SpecializationScope[] {
  return scopes.includes(scope) ? scopes.filter((s) => s !== scope) : [...scopes, scope]
}

interface ScopeListProps {
  selected: SpecializationScope[]
  onToggle: (scope: SpecializationScope) => void
}

export function ScopeList({ selected, onToggle }: ScopeListProps) {
  const { t } = useLanguage()
  return (
    <div className="scope-list" role="listbox" aria-multiselectable="true">
      {SCOPE_OPTIONS.map((scope) => {
        const isSelected = selected.includes(scope)
        return (
          <button
            key={scope}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`scope-list-item${isSelected ? ' selected' : ''}`}
            onClick={() => onToggle(scope)}
          >
            <span className="scope-check">{isSelected ? '✓' : ''}</span>
            <span>
              {scope === 'visa_services' || scope === 'exam_services'
                ? t('scopes', scope)
                : t('countries', COUNTRY_LABEL_KEYS[scope])}
            </span>
          </button>
        )
      })}
    </div>
  )
}
