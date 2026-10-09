import { ABSENT_AFTER_WORKING_DAYS } from '../../domain/routing/counselorAbsence'
import { DETAIL_TAIL_SEPARATOR } from './followUpCounselorLog'

export interface RoutingOutcome {
  assignedNotSignedInToday: boolean
  // مسائي والعميل وصل الصبح: مو مشكلة حضور، بس المشرف لازم يعرف إنه بيستلمه
  // الساعة ٣ مو الحين
  assignedShift?: 'day' | 'night' | null
  counselorName: string | null
  counselorNameAr: string | null
}

export interface RoutingNote {
  en: string
  ar: string
}

// سطر واحد بآخر سجل إنشاء الزيارة يشرح قرار التوزيع. بدونه يشوف المشرف زيارة
// بدون مستشار وما يدري ليش، أو زيارة معيّنة وما يدري إن صاحبها ما فتح التطبيق
export function routingNote(outcome: RoutingOutcome): RoutingNote {
  // بدون اسم ما فيه فايدة من السطر — نسكت بدل ما نقول "أُسندت إلى null"
  if (outcome.counselorName === null) return { en: '', ar: '' }

  const arabicName = outcome.counselorNameAr ?? outcome.counselorName
  // الاسم يتكتب دائمًا: قبل كذا السجل ما يقول مين استلم العميل إلا لما يكون
  // فيه مشكلة، فالحالة العادية ما تترك أثر تقدر ترجع له
  if (outcome.assignedShift) {
    const enShift = outcome.assignedShift === 'night' ? 'night shift' : 'day shift'
    const arShift = outcome.assignedShift === 'night' ? 'الدوام المسائي' : 'الدوام الصباحي'
    return {
      en: ` — assigned to ${outcome.counselorName}, who is on the ${enShift}`,
      ar: ` — أُسندت إلى ${arabicName}، وهو على ${arShift}`,
    }
  }
  if (outcome.assignedNotSignedInToday) {
    return {
      en: ` — assigned to ${outcome.counselorName}, who has not signed in today`,
      ar: ` — أُسندت إلى ${arabicName}، وهو ما سجّل الدخول اليوم`,
    }
  }
  return {
    en: ` — assigned to ${outcome.counselorName}`,
    ar: ` — أُسندت إلى ${arabicName}`,
  }
}

export interface SkippedCounselor {
  name: string
  nameAr: string | null
  quietWorkingDays: number | null
}

// صف مستقل لأخطر حالة بالسجل: عميل وصل وراح بدون مستشار. ونسمّي اللي كان
// بيستلمه وكم يوم غاب بالضبط — بدون الاسم يظل السؤال "مين المفروض ياخذه؟"
// محتاج استعلام على قاعدة البيانات كل مرة
export interface UnassignedReason {
  kind: 'noneCoverScope' | 'onlyDeactivated'
  scopeLabel: string
  offShiftCount: number
}

export function leftUnassignedLog(
  clientName: string,
  skipped: SkippedCounselor | null,
  reason?: UnassignedReason
): RoutingNote {
  // السبب الحقيقي: مو غياب. إمّا ما فيه أحد يغطي هالوجهة إطلاقًا، أو اللي
  // يغطيها كلهم خارج الشفت هالساعة. قول الصح عشان ما يدوّر المشرف بالمكان الغلط
  if (reason) {
    const many = reason.offShiftCount !== 1
    const enTail =
      reason.kind === 'noneCoverScope'
        ? `no counselor covers ${reason.scopeLabel}`
        : `the ${many ? `${reason.offShiftCount} counselors` : 'only counselor'} covering ${reason.scopeLabel} ${many ? 'have deactivated accounts' : 'has a deactivated account'}`
    const arTail =
      reason.kind === 'noneCoverScope'
        ? `ما فيه مستشار يغطي ${reason.scopeLabel}`
        : `اللي يغطي ${reason.scopeLabel} حسابه معطّل (${reason.offShiftCount})`
    return {
      en: `${clientName}${DETAIL_TAIL_SEPARATOR}${enTail}`,
      ar: `${clientName}${DETAIL_TAIL_SEPARATOR}${arTail}`,
    }
  }
  if (skipped === null) {
    return {
      en: `${clientName}${DETAIL_TAIL_SEPARATOR}no counselor on shift covers this service`,
      ar: `${clientName}${DETAIL_TAIL_SEPARATOR}ما فيه مستشار بالشفت يغطي هذي الخدمة`,
    }
  }
  const arabicName = skipped.nameAr ?? skipped.name
  const days = skipped.quietWorkingDays
  const enGap = days === null ? 'has never signed in' : `has not been in for ${days} working days`
  const arGap = days === null ? 'ما سجّل دخول أبداً' : `ما حضر من ${days} يوم عمل`
  return {
    en: `${clientName}${DETAIL_TAIL_SEPARATOR}${skipped.name} was skipped — ${enGap}`,
    ar: `${clientName}${DETAIL_TAIL_SEPARATOR}تم تخطّي ${arabicName} — ${arGap}`,
  }
}

// العميل انعطى لمستشار غايب لأن ما فيه بديل حاضر يغطي وجهته. أحسن من يبقى
// العميل انعطى لواحد برّا الدورة العادية — غايب، أو خارج شفته، أو الاثنين.
// أحسن من يبقى بلا صاحب، بس الصف لازم يبان أحمر ويقول أي الحالتين
export function assignedToAbsentLog(
  clientName: string,
  counselor: SkippedCounselor,
  offShift = false
): RoutingNote {
  const arabicName = counselor.nameAr ?? counselor.name
  const days = counselor.quietWorkingDays
  const absent = days === null || days >= ABSENT_AFTER_WORKING_DAYS
  const enParts: string[] = []
  const arParts: string[] = []
  if (offShift) {
    enParts.push('is off shift right now')
    arParts.push('خارج شفته الحين')
  }
  if (absent) {
    enParts.push(days === null ? 'has never signed in' : `has not been in for ${days} working days`)
    arParts.push(days === null ? 'ما سجّل دخول أبداً' : `ما حضر من ${days} يوم عمل`)
  }
  return {
    en: `${clientName} went to ${counselor.name}${DETAIL_TAIL_SEPARATOR}${enParts.join(', and ')}`,
    ar: `${clientName} أُسند إلى ${arabicName}${DETAIL_TAIL_SEPARATOR}${arParts.join('، و')}`,
  }
}
