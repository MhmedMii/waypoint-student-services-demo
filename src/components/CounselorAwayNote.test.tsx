import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { CounselorAwayNote } from './CounselorAwayNote'
import { CounselorShiftNote } from './CounselorShiftNote'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function show(signedInToday: boolean | null, quietWorkingDays: number | null, isOpen = true) {
  render(
    <LanguageProvider>
      <CounselorAwayNote
        isOpen={isOpen}
        signedInToday={signedInToday}
        quietWorkingDays={quietWorkingDays}
      />
    </LanguageProvider>
  )
}

describe('CounselorAwayNote', () => {
  // زيارة انتهت ما تسأل "فيه أحد جاي؟" — ونصف صفوف الصفحة مقفلة، فبدونه
  // يصير نصف السطور ضجيج تحت أسماء ما لها علاقة
  it('says nothing on a visit that is already finished', () => {
    show(false, 6, false)
    expect(document.querySelector('.counselor-away')).toBeNull()
  })

  // "غايب/Away" تعني بصفحة الإشراف: مسجّل دخول وطلع لحظة. كلمة وحدة
  // لحالتين مختلفتين تمامًا تخلي المشرف يقرأ الاثنين نفس الشي
  it('does not borrow the word Supervision uses for stepping out', () => {
    show(false, 6)
    expect(screen.getByText('Not in for 6 working days')).toBeInTheDocument()
    expect(screen.queryByText(/Away/)).not.toBeInTheDocument()
  })
  it('says nothing about someone who signed in today', () => {
    show(true, 0)
    expect(document.querySelector('.counselor-away')).toBeNull()
  })

  // غير معيّن مو نفس "معيّن وما دخل"
  it('says nothing when no counselor is assigned', () => {
    show(null, null)
    expect(document.querySelector('.counselor-away')).toBeNull()
  })

  it('counts one working day in the singular', () => {
    show(false, 1)
    expect(screen.getByText('Not in for 1 working day')).toBeInTheDocument()
  })

  it('counts more than one working day in the plural', () => {
    show(false, 2)
    expect(screen.getByText('Not in for 2 working days')).toBeInTheDocument()
    cleanup()
    show(false, 15)
    expect(screen.getByText('Not in for 15 working days')).toBeInTheDocument()
  })

  // آخر دخول أمس والحين جمعة: ما دخل اليوم، بس ولا يوم دوام مرّ بعد
  it('falls back to plain wording when no working day has passed yet', () => {
    show(false, 0)
    expect(screen.getByText('Not in today')).toBeInTheDocument()
  })

  it('says never, rather than counting from a sign-in that never happened', () => {
    show(false, null)
    expect(screen.getByText('Never signed in')).toBeInTheDocument()
  })

  // الأحمر يعني شي محدد: التوزيع وقف يعطيه عملاء — مو مجرد "غاب أكثر"
  it('stays grey under the five-working-day line', () => {
    show(false, 4)
    expect(screen.getByText('Not in for 4 working days')).not.toHaveClass('absent')
  })

  it('turns red at the line routing stops assigning', () => {
    show(false, 5)
    expect(screen.getByText('Not in for 5 working days')).toHaveClass('absent')
    cleanup()
    show(false, 15)
    expect(screen.getByText('Not in for 15 working days')).toHaveClass('absent')
  })

  it('treats never signed in as red, since they can never receive a client', () => {
    show(false, null)
    expect(screen.getByText('Never signed in')).toHaveClass('absent')
  })
})

describe('CounselorShiftNote', () => {
  function showShift(shift: 'day' | 'night' | null) {
    render(
      <LanguageProvider>
        <CounselorShiftNote shift={shift} />
      </LanguageProvider>
    )
  }

  it('names the night shift beside the counselor', () => {
    showShift('night')
    expect(screen.getByText('Night')).toBeInTheDocument()
  })

  it('names the day shift too', () => {
    showShift('day')
    expect(screen.getByText('Day')).toBeInTheDocument()
  })

  // أغلب المستشارين بلا شفت محدد — ما نزحم الصف بشي ما ينطبق
  it('shows nothing when no shift is set', () => {
    showShift(null)
    expect(document.querySelector('.counselor-shift')).toBeNull()
  })

  // معلومة جدول، مو إنذار — الأحمر محجوز للغياب
  it('is grey, not red', () => {
    showShift('night')
    expect(document.querySelector('.counselor-shift')).not.toHaveClass('absent')
  })
})
