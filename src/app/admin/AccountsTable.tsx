// src/app/admin/AccountsTable.tsx
import type { AccountWithScopes } from '../../application/useCases/listAccounts'
import type { SafeUser } from '../../domain/entities/user'
import { activeFirst, lastSeenDisplay, scopeLabel, scopeSummary } from './accountsDisplay'
import { useLanguage } from '../../i18n/LanguageContext'
import { localizedName } from '../../i18n/localizedName'

interface AccountsTableProps {
  title: string
  users: AccountWithScopes[]
  actorId: string
  showShiftColumn: boolean
  onDeactivateToggle: (user: SafeUser) => void
  onOpenActions: (user: SafeUser) => void
}

export function AccountsTable({
  title,
  users,
  actorId,
  showShiftColumn,
  onDeactivateToggle,
  onOpenActions,
}: AccountsTableProps) {
  const { t, language } = useLanguage()
  const now = new Date()
  const orderedUsers = activeFirst(users)

  return (
    <div className="accounts-panel">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table className="accounts-table">
          <colgroup>
            <col style={{ width: showShiftColumn ? '20%' : '24%' }} />
            <col style={{ width: showShiftColumn ? '26%' : '32%' }} />
            <col style={{ width: showShiftColumn ? '12%' : '14%' }} />
            {showShiftColumn && <col style={{ width: '10%' }} />}
            {showShiftColumn && <col style={{ width: '13%' }} />}
            {showShiftColumn && <col style={{ width: '12%' }} />}
            <col style={{ width: showShiftColumn ? '20%' : '30%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>{t('accounts', 'name')}</th>
              <th>{t('accounts', 'email')}</th>
              <th>{t('accounts', 'status')}</th>
              {showShiftColumn && <th>{t('accounts', 'scopes')}</th>}
              {showShiftColumn && <th>{t('accounts', 'shiftLocation')}</th>}
              {showShiftColumn && <th>{t('accounts', 'lastSeen')}</th>}
              <th className="actions-col">{t('accounts', 'actions')}</th>
            </tr>
          </thead>
          <tbody>
            {orderedUsers.map((user) => {
              const isSelf = user.id === actorId
              const scopes = scopeSummary(user.scopes, t)
              const seen = lastSeenDisplay(user.lastSeenAt, now, t)
              return (
                <tr key={user.id} className={user.active ? undefined : 'account-inactive'}>
                  <td data-label={t('accounts', 'name')}>
                    {localizedName(user.name, user.nameAr, language)}{' '}
                    <span className="role-badge">{t('nav', user.role)}</span>
                  </td>
                  <td data-label={t('accounts', 'email')}>{user.email}</td>
                  <td data-label={t('accounts', 'status')}>
                    <span className={`pill ${user.active ? 'active' : 'inactive'}`}>
                      {user.active
                        ? t('accounts', 'statusActive')
                        : t('accounts', 'statusInactive')}
                    </span>
                  </td>
                  {showShiftColumn && (
                    <td data-label={t('accounts', 'scopes')}>
                      <span
                        className={`scope-count${scopes.isNone ? ' none' : ''}`}
                        title={
                          scopes.isNone
                            ? t('accounts', 'noScopesHint')
                            : (user.scopes ?? []).map((scope) => scopeLabel(scope, t)).join(', ')
                        }
                      >
                        {scopes.text}
                      </span>
                    </td>
                  )}
                  {showShiftColumn && (
                    <td data-label={t('accounts', 'shiftLocation')}>
                      {user.shift && user.floor ? (
                        <span className="shift-pill">
                          <span className={`dot ${user.shift}`} />
                          {t('accounts', user.shift === 'day' ? 'shiftDay' : 'shiftNight')} ·{' '}
                          {user.floor}
                        </span>
                      ) : (
                        <span className="shift-pill unset">{t('accounts', 'shiftNotSet')}</span>
                      )}
                    </td>
                  )}
                  {showShiftColumn && (
                    <td data-label={t('accounts', 'lastSeen')}>
                      <span className={seen.isStale ? 'last-seen stale' : 'last-seen'}>
                        {seen.text}
                      </span>
                    </td>
                  )}
                  <td className="cell-actions">
                    {!isSelf && (
                      <button
                        type="button"
                        className={user.active ? 'action-warning' : 'action-success'}
                        onClick={() => onDeactivateToggle(user)}
                      >
                        {user.active ? t('accounts', 'deactivate') : t('accounts', 'reactivate')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="kebab-btn"
                      onClick={() => onOpenActions(user)}
                      aria-label={t('accounts', 'moreActions')}
                    >
                      ⋯
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
