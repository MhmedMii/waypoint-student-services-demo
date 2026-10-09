import { describe, it, expect } from 'vitest'
import { assignedToAbsentLog, leftUnassignedLog, routingNote } from './routingNote'

const assigned = { counselorName: 'Fictional Student K', counselorNameAr: 'طالب تجريبي ثان' }

describe('routingNote', () => {
  // قبل كذا السجل ما يقول مين استلم العميل إلا لما يكون فيه مشكلة، فاليوم
  // العادي ما يترك أثر تقدر ترجع له
  it('names the counselor even when nothing was wrong', () => {
    const note = routingNote({
      assignedNotSignedInToday: false,
      ...assigned,
    })
    expect(note.en).toBe(' — assigned to Fictional Student K')
    expect(note.ar).toBe(' — أُسندت إلى طالب تجريبي ثان')
  })

  it('says nothing when there is no counselor to name', () => {
    expect(
      routingNote({
        assignedNotSignedInToday: false,
        counselorName: null,
        counselorNameAr: null,
      })
    ).toEqual({ en: '', ar: '' })
  })

  // تُركت بدون تعيين صار لها صف مستقل — ما نكررها كذيل على سطر الإنشاء كمان

  it('names the counselor who was given a client without signing in today', () => {
    const note = routingNote({
      assignedNotSignedInToday: true,
      ...assigned,
    })
    expect(note.en).toBe(' — assigned to Fictional Student K, who has not signed in today')
    expect(note.ar).toContain('طالب تجريبي ثان')
  })

  it('falls back to the English name when there is no Arabic one', () => {
    const note = routingNote({
      assignedNotSignedInToday: true,
      counselorName: 'Fictional Student K',
      counselorNameAr: null,
    })
    expect(note.ar).toContain('Fictional Student K')
  })

  // "أُسندت إلى null" أسوأ من لا شيء
  it('stays silent rather than naming nobody', () => {
    expect(
      routingNote({
        assignedNotSignedInToday: true,
        counselorName: null,
        counselorNameAr: null,
      })
    ).toEqual({ en: '', ar: '' })
  })

  // ما ينكتب سطرين عن نفس الزيارة: الصف المستقل يكفي
})

describe('leftUnassignedLog', () => {
  // ما عاد الغياب سبب ممكن للترك بلا تعيين — التوزيع يعطي الغايب بدل لا أحد
  it('does not blame absence, because absence can no longer cause this', () => {
    const note = leftUnassignedLog('Othman alhsban', null)
    expect(note.en).toBe('Othman alhsban — no counselor on shift covers this service')
    expect(note.en).not.toContain('working days')
  })

  // اللوحة تقسم على آخر " — " عشان تلوّن الذيل بس
  it('carries the separator the log panel colours on', () => {
    expect(leftUnassignedLog('Othman alhsban', null).en.split(' — ')).toHaveLength(2)
    expect(leftUnassignedLog('Othman alhsban', null).ar.split(' — ')).toHaveLength(2)
  })
})

describe('leftUnassignedLog naming who was skipped', () => {
  // بدون الاسم يظل السؤال "مين المفروض ياخذه ولماذا لم يأخذه؟" محتاج
  // استعلام على قاعدة البيانات كل مرة
  it('names the counselor and the real gap, not just the threshold', () => {
    const note = leftUnassignedLog('Othman alhsban', {
      name: 'Demo Counselor Seven',
      nameAr: 'مستشار تجريبي سابع',
      quietWorkingDays: 7,
    })
    expect(note.en).toBe(
      'Othman alhsban — Demo Counselor Seven was skipped — has not been in for 7 working days'
    )
    expect(note.ar).toContain('تم تخطّي مستشار تجريبي سابع')
    expect(note.ar).toContain('ما حضر من 7 يوم عمل')
  })

  it('says never rather than counting from a sign-in that never happened', () => {
    const note = leftUnassignedLog('Othman alhsban', {
      name: 'New Account',
      nameAr: null,
      quietWorkingDays: null,
    })
    expect(note.en).toContain('has never signed in')
    expect(note.ar).toContain('ما سجّل دخول أبداً')
  })

  it('falls back to the English name when there is no Arabic one', () => {
    const note = leftUnassignedLog('Othman alhsban', {
      name: 'Demo Counselor Seven',
      nameAr: null,
      quietWorkingDays: 7,
    })
    expect(note.ar).toContain('Demo Counselor Seven')
  })

  // ما فيه أحد بالشفت يغطي هالوجهة أصلاً — ما فيه اسم نقوله
  it('falls back to a truthful generic line when no reason is given', () => {
    expect(leftUnassignedLog('Othman alhsban', null).en).toContain('covers this service')
  })

  // ثلاثة أسباب، ثلاث خطوات مختلفة تمامًا
  // بعد ما صار الاحتياط يوصل اللي خارج الشفت، بقي سببان فقط للترك بلا تعيين
  it('separates the two remaining reasons a client can end up with nobody', () => {
    const base = { scopeLabel: 'Australia & New Zealand', offShiftCount: 1 }
    expect(leftUnassignedLog('X', null, { ...base, kind: 'noneCoverScope' }).en).toContain(
      'no counselor covers Australia & New Zealand'
    )
    expect(leftUnassignedLog('X', null, { ...base, kind: 'onlyDeactivated' }).en).toBe(
      'X — the only counselor covering Australia & New Zealand has a deactivated account'
    )
  })

  it('uses the plural when several deactivated accounts cover it', () => {
    expect(
      leftUnassignedLog('X', null, {
        kind: 'onlyDeactivated',
        scopeLabel: 'Egypt',
        offShiftCount: 2,
      }).en
    ).toContain('the 2 counselors covering Egypt have deactivated accounts')
  })

  it('still carries the separator the log panel colours on', () => {
    const note = leftUnassignedLog('Othman alhsban', {
      name: 'Demo Counselor Seven',
      nameAr: null,
      quietWorkingDays: 7,
    })
    expect(note.en.indexOf(' — ')).toBe('Othman alhsban'.length)
  })
})

describe('assignedToAbsentLog', () => {
  const demoCounselorSeven = {
    name: 'Demo Counselor Seven',
    nameAr: 'مستشار تجريبي سابع',
    quietWorkingDays: 7,
  }

  it('says absent when that is the reason', () => {
    expect(assignedToAbsentLog('Othman alhsban', demoCounselorSeven).en).toBe(
      'Othman alhsban went to Demo Counselor Seven — has not been in for 7 working days'
    )
  })

  // مسائي حاضر اليوم: مو غايب، بس ما يوصله العميل قبل الساعة ٣
  it('says off shift when the counselor is present but not due in yet', () => {
    const note = assignedToAbsentLog(
      'Othman alhsban',
      { name: 'Sara Night', nameAr: null, quietWorkingDays: 0 },
      true
    )
    expect(note.en).toBe('Othman alhsban went to Sara Night — is off shift right now')
    expect(note.en).not.toContain('working days')
  })

  it('says both when both are true', () => {
    const note = assignedToAbsentLog('Othman alhsban', demoCounselorSeven, true)
    expect(note.en).toBe(
      'Othman alhsban went to Demo Counselor Seven — is off shift right now, and has not been in for 7 working days'
    )
  })
})

describe('the shift on the visit_created line', () => {
  const nour = { counselorName: 'Demo Counselor Eight', counselorNameAr: 'مستشار تجريبي ثامن' }

  // مسائي وصله عميل الصبح كاحتياط — المشرف لازم يعرف إنه بيستلمه الساعة ٣
  it('says which shift when the assignment reached someone off shift', () => {
    const note = routingNote({
      assignedNotSignedInToday: false,
      assignedShift: 'night',
      ...nour,
    })
    expect(note.en).toBe(' — assigned to Demo Counselor Eight, who is on the night shift')
    expect(note.ar).toContain('الدوام المسائي')
  })

  it('says the day shift too', () => {
    expect(
      routingNote({ assignedNotSignedInToday: false, assignedShift: 'day', ...nour }).en
    ).toContain('who is on the day shift')
  })

  // التعيين العادي ما يذكر الشفت — ما فيه شي غير معتاد
  it('says nothing about the shift on an ordinary assignment', () => {
    const note = routingNote({ assignedNotSignedInToday: false, assignedShift: null, ...nour })
    expect(note.en).toBe(' — assigned to Demo Counselor Eight')
  })
})
