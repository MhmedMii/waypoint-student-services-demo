import type { DefaultSession } from 'next-auth'
import type { UserRole } from '../domain/entities/user'
import type { SpecializationScope } from '../domain/entities/counselor'

// الجلسة كانت تُقرأ بـ (session!.user as any).role بستة وخمسين مكان. الـ any
// يلغي كل فحص: غلطة بالاسم تطلع undefined بصمت، وتغيير توقيع دالة تاخذ الدور
// يعدّي بلا ما يشتكي المترجم — صار فعلاً وقت تعديل getClientHistory، مرّ
// سترنق مكان كائن بمسارين ولا أحد نبّه. هذا الملف يرجّع الفحص لمكانه
declare module 'next-auth' {
  interface Session {
    // اختياري عمدًا: التوكن المنزوع (حساب معطّل) يخلي المستخدم غير موجود،
    // وهذا اللي يخلي requireRole يرفض بدل ما يبني كائناً نصّه فاضي
    user?: {
      id: string
      role: UserRole
      scopes: SpecializationScope[]
      nameAr?: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role: UserRole
    scopes: SpecializationScope[]
    nameAr?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: UserRole
    scopes?: SpecializationScope[]
    nameAr?: string | null
    // ختم آخر تحقق من القاعدة — يخلي التعطيل يوصل خلال دقيقة مو ثمان ساعات
    checkedAt?: number
  }
}
