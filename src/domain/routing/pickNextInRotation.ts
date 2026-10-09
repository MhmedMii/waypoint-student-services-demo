import type { CounselorCandidate } from '../entities/counselor'

// دور ثابت: ١ ثم ٢ ثم ٣ ثم نرجع لـ١. الترتيب بمعرّف المستشار — ثابت، ما يتحرك
// لو أحد سجّل دخول أو طلع ولا لو تغيّر اسمه. "المكان" بالدورة = آخر واحد استلم
// من هالنطاق، فالدورة تكمل بين الإرسالات بدل ما تبدأ من أول كل مرة.
//
// كان التوزيع "اللي له أطول مدة بدون عميل". وهذا يخلي الغايب من أسابيع — تاريخ
// آخر استلام عنده قديم — يتصدّر الطابور. هنا ما فيه تواريخ بالقرار أصلاً: الغايب
// ياخذ دوره مرة وحدة زي غيره، ومستشار جديد يدخل مكانه بالترتيب بدون ما يعيد الدورة
export function pickNextInRotation(
  candidates: CounselorCandidate[],
  lastAssignedCounselorId: string | null
): CounselorCandidate | null {
  if (candidates.length === 0) return null
  const ordered = [...candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  if (lastAssignedCounselorId === null) return ordered[0]
  // اللي بعده بالترتيب، حتى لو صاحب آخر دور ما عاد بالقائمة (خارج الشفت، معطّل،
  // تغيّر نطاقه) — نكمل من مكانه بالترتيب، ولو وصلنا للآخر نلف لأول واحد
  return ordered.find((candidate) => candidate.id > lastAssignedCounselorId) ?? ordered[0]
}
