import type { ApplicationKind } from '../entities/application'
import type { SpecializationScope } from '../entities/counselor'

// قاعدة صلاحية: أي نطاق يلزم لطلب من نوع معيّن. كانت مكتوبة عشر مرات بنفس
// الصيغة — kind === 'visa' ? 'visa_services' : 'exam_services' — بأربعة مسارات
// وستة use cases. الشرط الثلاثي بلا فرع "ولا واحد منهم": أي نوع ثالث يُضاف
// كان بياخذ exam_services بصمت، يعني صلاحية ما أحد قرّرها.
//
// satisfies يخلي المترجم يرفض إضافة نوع جديد لـ ApplicationKind لين ينكتب
// نطاقه هنا — الرفض يصير وقت البناء، مو وقت ما يدخل أحد على بيانات ما تخصه
const SCOPE_FOR_KIND = {
  visa: 'visa_services',
  exam: 'exam_services',
} as const satisfies Record<ApplicationKind, SpecializationScope>

// النوع يجي أحيانًا من الرابط أو من القاعدة، فنعامله كقيمة مجهولة. hasOwnProperty
// مو "kind in": 'constructor' و'toString' موجودين بسلسلة النموذج ويرجعون دوال
export function scopeForApplicationKind(kind: unknown): SpecializationScope | null {
  if (typeof kind !== 'string') return null
  if (!Object.prototype.hasOwnProperty.call(SCOPE_FOR_KIND, kind)) return null
  return SCOPE_FOR_KIND[kind as ApplicationKind]
}

// السؤال اللي تسأله كل use case: هل يملك هذا الموظف نطاق هذا النوع؟ نوع مجهول
// جوابه لا — نرفض بدل ما نفترض
export function holdsScopeForApplicationKind(
  actorScopes: readonly SpecializationScope[],
  kind: unknown
): boolean {
  const scope = scopeForApplicationKind(kind)
  return scope !== null && actorScopes.includes(scope)
}
