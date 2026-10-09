// src/app/admin/ShiftEditor.tsx
import type { Shift, Floor } from '../../domain/entities/user'
import { useLanguage } from '../../i18n/LanguageContext'
import { MAX_NOTE_LENGTH } from '../../domain/validation/validateNote'

interface ShiftEditorProps {
  shift: Shift | null
  floor: Floor | null
  note: string
  onChangeShift: (shift: Shift) => void
  onChangeFloor: (floor: Floor) => void
  onChangeNote: (note: string) => void
}

export function ShiftEditor({
  shift,
  floor,
  note,
  onChangeShift,
  onChangeFloor,
  onChangeNote,
}: ShiftEditorProps) {
  const { t } = useLanguage()
  return (
    <div className="shift-edit-content">
      <div className="field-group">
        <span className="field-label">{t('accounts', 'shift')}</span>
        <div className="toggle-row">
          <button
            type="button"
            className={shift === 'day' ? 'selected' : ''}
            onClick={() => onChangeShift('day')}
          >
            {t('accounts', 'shiftDay')}
          </button>
          <button
            type="button"
            className={shift === 'night' ? 'selected' : ''}
            onClick={() => onChangeShift('night')}
          >
            {t('accounts', 'shiftNight')}
          </button>
        </div>
      </div>
      <div className="field-group">
        <span className="field-label">{t('accounts', 'floor')}</span>
        <div className="toggle-row">
          <button
            type="button"
            className={floor === 'M1' ? 'selected' : ''}
            onClick={() => onChangeFloor('M1')}
          >
            M1
          </button>
          <button
            type="button"
            className={floor === 'M3' ? 'selected' : ''}
            onClick={() => onChangeFloor('M3')}
          >
            M3
          </button>
        </div>
      </div>
      <div className="field-group">
        <span className="field-label">{t('accounts', 'note')}</span>
        <textarea
          className="admin-note-field"
          rows={2}
          placeholder={t('accounts', 'notePlaceholder')}
          value={note}
          onChange={(e) => onChangeNote(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
        />
      </div>
    </div>
  )
}
