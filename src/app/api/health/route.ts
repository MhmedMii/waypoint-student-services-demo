import { NextResponse } from 'next/server'

// فيرسل يحط VERCEL_GIT_COMMIT_SHA بنفسه مع كل نشر. سبعة أحرف تكفي عشان
// نعرف وش النسخة الشغالة فعلاً بالإنتاج — قبل كذا ما كان فيه طريقة نتأكد
// إن الدفعة وصلت إلا لو التغيير يبان بملفات المتصفح
const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7)

// الرد لازم يظل من السيرفر مباشرة: نسخة محفوظة بالكاش تقول إن النشر وصل
// وهو ما وصل، وهذا بالضبط السؤال اللي هالمسار موجود يجاوبه
export const dynamic = 'force-dynamic'

// يستخدمه HEALTHCHECK بالـ Dockerfile للتأكد إن السيرفر شغّال ويرد على الطلبات —
// بدون تسجيل دخول وبدون قاعدة بيانات، عشان يبقى بسيط وسريع
export async function GET() {
  // ما نرجّع الفرع ولا البيئة: المسار عام، والـ commit وحده يكفي للتأكد
  return NextResponse.json(COMMIT ? { ok: true, commit: COMMIT } : { ok: true })
}
