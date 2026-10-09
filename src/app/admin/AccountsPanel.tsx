// src/app/admin/AccountsPanel.tsx
'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { SafeUser, Shift, Floor } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { AccountWithScopes } from '../../application/useCases/listAccounts'
import { generateTempPassword } from './generateTempPassword'
import { useLanguage } from '../../i18n/LanguageContext'
import { translateErrorCode } from '../../i18n/translateErrorCode'
import { AccountForm, EMPTY_FORM, type NewAccountForm } from './AccountForm'
import { AccountsTable } from './AccountsTable'
import { ScopeList, toggleScope } from './ScopeList'
import { ShiftEditor } from './ShiftEditor'
import { MAX_SUPER_ADMINS } from '../../application/useCases/promoteToSuperAdmin'
import { useDialog } from '../../hooks/useDialog'

async function fetchAccounts(): Promise<AccountWithScopes[]> {
  const response = await fetch('/api/admin/accounts')
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

function buildAddAccountPayload(form: NewAccountForm, password: string) {
  return {
    name: form.name,
    email: form.email,
    role: form.role,
    password,
    ...(form.role === 'counselor' ? { scopes: form.scopes } : {}),
  }
}

export function AccountsPanel() {
  const { t, language } = useLanguage()
  const { data: session } = useSession()
  const [accounts, setAccounts] = useState<AccountWithScopes[]>([])
  const [form, setForm] = useState<NewAccountForm>(EMPTY_FORM)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionsFor, setActionsFor] = useState<SafeUser | null>(null)
  const [editingFor, setEditingFor] = useState<SafeUser | null>(null)
  const [editingScopes, setEditingScopes] = useState<SpecializationScope[]>([])
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [editingNameArFor, setEditingNameArFor] = useState<SafeUser | null>(null)
  const [editingNameArValue, setEditingNameArValue] = useState('')
  const [resetPasswordFor, setResetPasswordFor] = useState<{
    name: string
    password: string
  } | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setAccounts(await fetchAccounts())
  }

  async function handleAddAccount(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const password = generateTempPassword()

    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAddAccountPayload(form, password)),
      })
      const result = await response.json()
      if (!result.ok) {
        setError(
          translateErrorCode(language, result.reason) ?? t('accounts', 'couldNotCreateAccount')
        )
        return
      }

      setTempPassword(password)
      setForm(EMPTY_FORM)
      await refresh()
    } catch {
      setError(t('accounts', 'couldNotCreateAccount'))
    }
  }

  async function handleDeactivateToggle(user: SafeUser) {
    await fetch(`/api/admin/accounts/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: user.active ? 'deactivate' : 'reactivate' }),
    })
    await refresh()
  }

  function handleOpenActions(user: SafeUser) {
    setError(null)
    setActionsFor(user)
  }

  function handleCloseActions() {
    setActionsFor(null)
  }

  async function handleResetPassword(user: SafeUser) {
    setError(null)
    setActionsFor(null)
    const newPassword = generateTempPassword()
    try {
      const response = await fetch(`/api/admin/accounts/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', newPassword }),
      })
      const result = await response.json()
      if (result.ok) {
        setResetPasswordFor({ name: user.name, password: newPassword })
        return
      }
      setError(t('accounts', 'couldNotResetPassword'))
    } catch {
      setError(t('accounts', 'couldNotResetPassword'))
    }
  }

  async function handleStartEdit(user: SafeUser) {
    setError(null)
    setActionsFor(null)
    const response = await fetch(`/api/admin/accounts/${user.id}`)
    const data = await response.json()
    setEditingScopes(Array.isArray(data.scopes) ? data.scopes : [])
    setEditingShift(user.shift)
    setEditingFloor(user.floor)
    setEditingNote(user.note ?? '')
    setEditingFor(user)
  }

  function handleCancelEdit() {
    setEditingFor(null)
    setEditingScopes([])
    setEditingShift(null)
    setEditingFloor(null)
    setEditingNote('')
  }

  async function handleSaveEdit() {
    if (!editingFor) return
    setError(null)
    try {
      const shiftResponse = await fetch(`/api/admin/accounts/${editingFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateShift', shift: editingShift, floor: editingFloor }),
      })
      const shiftResult = await shiftResponse.json()
      if (!shiftResult.ok) {
        setError(
          translateErrorCode(language, shiftResult.reason) ?? t('accounts', 'couldNotUpdateShift')
        )
        return
      }

      const noteResponse = await fetch(`/api/admin/accounts/${editingFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateNote', note: editingNote }),
      })
      const noteResult = await noteResponse.json()
      if (!noteResult.ok) {
        setError(
          translateErrorCode(language, noteResult.reason) ?? t('accounts', 'couldNotUpdateNote')
        )
        return
      }

      const scopesResponse = await fetch(`/api/admin/accounts/${editingFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateScopes', scopes: editingScopes }),
      })
      const scopesResult = await scopesResponse.json()
      if (!scopesResult.ok) {
        setError(
          translateErrorCode(language, scopesResult.reason) ?? t('accounts', 'couldNotUpdateScopes')
        )
        return
      }

      handleCancelEdit()
      await refresh()
    } catch {
      setError(t('accounts', 'couldNotUpdateShift'))
    }
  }

  function handleStartEditNameAr(user: SafeUser) {
    setError(null)
    setActionsFor(null)
    setEditingNameArValue(user.nameAr ?? '')
    setEditingNameArFor(user)
  }

  function handleCancelEditNameAr() {
    setEditingNameArFor(null)
    setEditingNameArValue('')
  }

  async function handleSaveNameAr() {
    if (!editingNameArFor) return
    setError(null)
    try {
      const response = await fetch(`/api/admin/accounts/${editingNameArFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateNameAr', nameAr: editingNameArValue }),
      })
      const result = await response.json()
      if (!result.ok) {
        setError(
          translateErrorCode(language, result.reason) ?? t('accounts', 'couldNotUpdateNameAr')
        )
        return
      }
      handleCancelEditNameAr()
      await refresh()
    } catch {
      setError(t('accounts', 'couldNotUpdateNameAr'))
    }
  }

  async function handleDelete(user: SafeUser) {
    setError(null)
    setActionsFor(null)
    if (!window.confirm(t('accounts', 'confirmDelete'))) return
    try {
      const response = await fetch(`/api/admin/accounts/${user.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.ok) {
        setError(
          translateErrorCode(language, result.reason) ?? t('accounts', 'couldNotDeleteAccount')
        )
        return
      }
      await refresh()
    } catch {
      setError(t('accounts', 'couldNotDeleteAccount'))
    }
  }

  async function handlePromote(user: SafeUser) {
    setError(null)
    setActionsFor(null)
    try {
      const response = await fetch(`/api/admin/accounts/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote' }),
      })
      const result = await response.json()
      if (!result.ok) {
        setError(translateErrorCode(language, result.reason) ?? t('accounts', 'couldNotPromote'))
        return
      }
      await refresh()
    } catch {
      setError(t('accounts', 'couldNotPromote'))
    }
  }

  async function handleDowngrade(user: SafeUser) {
    setError(null)
    setActionsFor(null)
    try {
      const response = await fetch(`/api/admin/accounts/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'downgrade' }),
      })
      const result = await response.json()
      if (!result.ok) {
        setError(translateErrorCode(language, result.reason) ?? t('accounts', 'couldNotDowngrade'))
        return
      }
      await refresh()
    } catch {
      setError(t('accounts', 'couldNotDowngrade'))
    }
  }

  const superAdmins = accounts.filter((u) => u.role === 'super_admin')
  const admins = accounts.filter((u) => u.role === 'admin')
  const counselors = accounts.filter((u) => u.role === 'counselor')
  const superAdminCount = superAdmins.length
  const actorId = session?.user?.id ?? ''
  const isActionsForSelf = actionsFor?.id === actorId
  const actionsDialog = useDialog({ open: !!actionsFor, onClose: handleCloseActions })
  const editDialog = useDialog({ open: !!editingFor, onClose: handleCancelEdit })
  const nameArDialog = useDialog({ open: !!editingNameArFor, onClose: handleCancelEditNameAr })

  return (
    <>
      {tempPassword && (
        <div className="temp-password-banner" role="status">
          <span>
            {t('accounts', 'tempPasswordLabel')} <strong>{tempPassword}</strong>{' '}
            {t('accounts', 'tempPasswordWarning')}
          </span>
          <button type="button" onClick={() => setTempPassword(null)}>
            {t('accounts', 'dismiss')}
          </button>
        </div>
      )}
      {resetPasswordFor && (
        <div className="temp-password-banner" role="status">
          <span>
            {t('accounts', 'newPasswordLabel')} {resetPasswordFor.name}:{' '}
            <strong>{resetPasswordFor.password}</strong>
          </span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(resetPasswordFor.password)}
          >
            {t('accounts', 'copy')}
          </button>
          <button type="button" onClick={() => setResetPasswordFor(null)}>
            {t('accounts', 'dismiss')}
          </button>
        </div>
      )}
      {error && <p className="err">{error}</p>}

      <AccountForm form={form} error={error} onChange={setForm} onSubmit={handleAddAccount} />

      <AccountsTable
        title={t('accounts', 'superAdminsSection')}
        users={superAdmins}
        actorId={actorId}
        showShiftColumn={false}
        onDeactivateToggle={handleDeactivateToggle}
        onOpenActions={handleOpenActions}
      />

      <AccountsTable
        title={t('accounts', 'adminsSection')}
        users={admins}
        actorId={actorId}
        showShiftColumn={false}
        onDeactivateToggle={handleDeactivateToggle}
        onOpenActions={handleOpenActions}
      />

      <AccountsTable
        title={t('accounts', 'counselorsSection')}
        users={counselors}
        actorId={actorId}
        showShiftColumn={true}
        onDeactivateToggle={handleDeactivateToggle}
        onOpenActions={handleOpenActions}
      />

      {actionsFor && (
        <div className="profile-modal-backdrop" onClick={handleCloseActions}>
          <div
            className="profile-modal actions-modal"
            onClick={(e) => e.stopPropagation()}
            {...actionsDialog.dialogProps}
          >
            <div className="profile-modal-head">
              <div className="profile-modal-who" id={actionsDialog.titleId}>
                {t('accounts', 'actionsFor').replace('{name}', actionsFor.name)}
              </div>
              <button
                type="button"
                className="profile-modal-close"
                onClick={handleCloseActions}
                aria-label={t('students', 'close')}
              >
                ✕
              </button>
            </div>
            <div className="profile-modal-body">
              <div className="actions-list">
                {actionsFor.role === 'counselor' && (
                  <button
                    type="button"
                    className="actions-list-item"
                    onClick={() => handleStartEdit(actionsFor)}
                  >
                    {t('accounts', 'editShiftAndScopes')}
                  </button>
                )}
                {!isActionsForSelf && (
                  <button
                    type="button"
                    className="actions-list-item"
                    onClick={() => handleResetPassword(actionsFor)}
                  >
                    {t('accounts', 'resetPassword')}
                  </button>
                )}
                <button
                  type="button"
                  className="actions-list-item"
                  onClick={() => handleStartEditNameAr(actionsFor)}
                >
                  {t('accounts', 'editArabicName')}
                </button>
                {actionsFor.role === 'admin' && (
                  <button
                    type="button"
                    className="actions-list-item"
                    onClick={() => handlePromote(actionsFor)}
                    disabled={superAdminCount >= MAX_SUPER_ADMINS}
                    title={
                      superAdminCount >= MAX_SUPER_ADMINS
                        ? t('accounts', 'maxSuperAdminsReached')
                        : undefined
                    }
                  >
                    {t('accounts', 'promoteToSuperAdmin')}
                  </button>
                )}
                {actionsFor.role === 'super_admin' && !isActionsForSelf && (
                  <button
                    type="button"
                    className="actions-list-item"
                    onClick={() => handleDowngrade(actionsFor)}
                  >
                    {t('accounts', 'downgradeToAdmin')}
                  </button>
                )}
                {!isActionsForSelf && (
                  <button
                    type="button"
                    className="actions-list-item tone-danger"
                    onClick={() => handleDelete(actionsFor)}
                  >
                    {t('accounts', 'deleteAccount')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingFor && (
        <div className="profile-modal-backdrop" onClick={handleCancelEdit}>
          <div
            className="profile-modal"
            onClick={(e) => e.stopPropagation()}
            {...editDialog.dialogProps}
          >
            <div className="profile-modal-head">
              <div>
                <div className="profile-modal-who" id={editDialog.titleId}>
                  {editingFor.name}
                </div>
                <div className="profile-modal-meta">{t('accounts', 'editShiftAndScopes')}</div>
              </div>
              <button
                type="button"
                className="profile-modal-close"
                onClick={handleCancelEdit}
                aria-label={t('students', 'close')}
              >
                ✕
              </button>
            </div>
            <div className="profile-modal-body">
              <ShiftEditor
                shift={editingShift}
                floor={editingFloor}
                note={editingNote}
                onChangeShift={setEditingShift}
                onChangeFloor={setEditingFloor}
                onChangeNote={setEditingNote}
              />
              <fieldset className="scope-checkboxes">
                <legend>{t('accounts', 'specializationScopes')}</legend>
                <ScopeList
                  selected={editingScopes}
                  onToggle={(scope) => setEditingScopes(toggleScope(editingScopes, scope))}
                />
              </fieldset>
              <div className="profile-modal-actions">
                <button type="button" className="btn-orange" onClick={handleSaveEdit}>
                  {t('accounts', 'save')}
                </button>
                <button type="button" onClick={handleCancelEdit}>
                  {t('accounts', 'cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingNameArFor && (
        <div className="profile-modal-backdrop" onClick={handleCancelEditNameAr}>
          <div
            className="profile-modal"
            onClick={(e) => e.stopPropagation()}
            {...nameArDialog.dialogProps}
          >
            <div className="profile-modal-head">
              <div>
                <div className="profile-modal-who" id={nameArDialog.titleId}>
                  {editingNameArFor.name}
                </div>
                <div className="profile-modal-meta">{t('accounts', 'editArabicName')}</div>
              </div>
              <button
                type="button"
                className="profile-modal-close"
                onClick={handleCancelEditNameAr}
                aria-label={t('students', 'close')}
              >
                ✕
              </button>
            </div>
            <div className="profile-modal-body">
              <label className="field-label" htmlFor="name-ar-input">
                {t('accounts', 'arabicNameLabel')}
              </label>
              <input
                id="name-ar-input"
                type="text"
                dir="rtl"
                value={editingNameArValue}
                onChange={(e) => setEditingNameArValue(e.target.value)}
                placeholder={t('accounts', 'arabicNamePlaceholder')}
              />
              <div className="profile-modal-actions">
                <button type="button" className="btn-orange" onClick={handleSaveNameAr}>
                  {t('accounts', 'save')}
                </button>
                <button type="button" onClick={handleCancelEditNameAr}>
                  {t('accounts', 'cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
