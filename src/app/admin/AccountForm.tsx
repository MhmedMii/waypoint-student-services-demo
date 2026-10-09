// src/app/admin/AccountForm.tsx
import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import { useLanguage } from '../../i18n/LanguageContext'
import { ScopeList, toggleScope } from './ScopeList'

const ROLE_OPTIONS: UserRole[] = ['counselor', 'admin', 'super_admin']

export interface NewAccountForm {
  name: string
  email: string
  role: UserRole
  scopes: SpecializationScope[]
}

export const EMPTY_FORM: NewAccountForm = { name: '', email: '', role: 'counselor', scopes: [] }

interface AccountFormProps {
  form: NewAccountForm
  error: string | null
  onChange: (form: NewAccountForm) => void
  onSubmit: (event: React.FormEvent) => void
}

export function AccountForm({ form, error, onChange, onSubmit }: AccountFormProps) {
  const { t } = useLanguage()
  return (
    <div className="accounts-panel">
      <h3>{t('accounts', 'addNewAccount')}</h3>

      <form onSubmit={onSubmit} className="account-form">
        <div className="account-form-grid">
          <div className="form-field">
            <label htmlFor="account-name">{t('accounts', 'name')}</label>
            <input
              id="account-name"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="account-email">{t('accounts', 'email')}</label>
            <input
              id="account-email"
              type="email"
              placeholder={t('accounts', 'emailPlaceholder')}
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="account-role">{t('accounts', 'role')}</label>
            <select
              id="account-role"
              value={form.role}
              onChange={(e) => onChange({ ...form, role: e.target.value as UserRole, scopes: [] })}
            >
              {ROLE_OPTIONS.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {t('nav', roleOption)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.role === 'counselor' && (
          <fieldset className="scope-checkboxes">
            <legend>{t('accounts', 'specializationScopes')}</legend>
            <ScopeList
              selected={form.scopes}
              onToggle={(scope) => onChange({ ...form, scopes: toggleScope(form.scopes, scope) })}
            />
          </fieldset>
        )}

        {error && <p className="err">{error}</p>}
        <button type="submit" className="btn-orange">
          {t('accounts', 'addAccount')}
        </button>
      </form>
    </div>
  )
}
