import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { pool } from '../db/pool'
import { createPostgresUserRepository } from '../../adapters/repositories/postgresUserRepository'
import { createPostgresSpecializationRepository } from '../../adapters/repositories/postgresSpecializationRepository'
import { isRateLimited, recordFailedAttempt, clearAttempts } from './loginRateLimiter'
import { isIpRateLimited, recordFailedIpAttempt, clearIpAttempts } from './ipLoginRateLimiter'
import type { User } from '../../domain/entities/user'
import type { UserRepository } from '../../application/ports/UserRepository'
import { revalidateSessionToken, type SessionToken } from './revalidateSessionToken'
import { clientIpFromForwardedFor } from '../rateLimit/getClientIp'

export async function verifyCredentials(
  credentials: { email: string; password: string },
  userRepository: UserRepository
): Promise<User | null> {
  const user = await userRepository.findByEmail(credentials.email)
  if (!user || !user.active) return null

  const passwordMatches = await bcrypt.compare(credentials.password, user.passwordHash)
  if (!passwordMatches) return null

  return user
}

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60 // 8 hours — one work shift
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  cookies: {
    sessionToken: {
      // بالإنتاج لازم اسم الكوكي يبدأ بـ __Secure- حسب اتفاقية next-auth نفسها، بما إن secure: true مفعّل هناك
      name: IS_PRODUCTION ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: IS_PRODUCTION,
        maxAge: SESSION_MAX_AGE_SECONDS,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        const now = Date.now()
        // الـ IP يحدد حظر الجهاز، مو بس الإيميل اللي يقدر يتبدّل. نفس الدالة
        // اللي تستخدمها المسارات العامة — قرار ثقة واحد، مكان واحد
        const ip = clientIpFromForwardedFor(req?.headers?.['x-forwarded-for'])
        // إذا ما قدرنا نحدد الـ IP الحقيقي، ما نطبّق حظر الـ IP إطلاقاً — عشان
        // ما ننشئ حظر مشترك واحد يأثر على كل المستخدمين سوا (bucket "unknown" وحدة للكل)
        const ipKnown = ip !== 'unknown'
        if (
          (await isRateLimited(credentials.email, now)) ||
          (ipKnown && (await isIpRateLimited(ip, now)))
        ) {
          throw new Error('RateLimited')
        }

        const userRepository = createPostgresUserRepository(pool)
        const user = await verifyCredentials(
          { email: credentials.email, password: credentials.password },
          userRepository
        )
        if (!user) {
          await recordFailedAttempt(credentials.email, now)
          if (ipKnown) await recordFailedIpAttempt(ip, now)
          return null
        }

        await clearAttempts(credentials.email)
        if (ipKnown) await clearIpAttempts(ip)

        // نطاقات التخصص نجيبها بس للمستشار — الوحيد اللي يحتاجها للتحقق الجديد (requireScope)
        const scopes =
          user.role === 'counselor'
            ? await createPostgresSpecializationRepository(pool).findScopesForCounselor(user.id)
            : []

        return {
          id: user.id,
          name: user.name,
          nameAr: user.nameAr,
          role: user.role,
          email: user.email,
          scopes,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.email = user.email
        token.scopes = user.scopes
        token.nameAr = user.nameAr
        token.checkedAt = Date.now()
        return token
      }
      // تحديث الاسم بدون إعادة تسجيل دخول — يصير وقت المستخدم يعدّل بروفايله
      if (trigger === 'update' && (session as any)?.name) {
        token.name = (session as any).name
      }
      // التعطيل أو تغيير الدور لازم يوصل قبل ما التوكن ينتهي، مو بعد ٨ ساعات
      return (await revalidateSessionToken(token as SessionToken, Date.now(), {
        userRepository: createPostgresUserRepository(pool),
        specializationRepository: createPostgresSpecializationRepository(pool),
      })) as typeof token
    },
    async session({ session, token }) {
      // توكن منزوع = الحساب معطّل أو محذوف. نشيل المستخدم كامل بدل ما نبني
      // كائن نصّه فاضي — الحارسان يرفضان، والصفحة تروح لتسجيل الدخول
      if (typeof token.id !== 'string') {
        session.user = undefined as any
        return session
      }
      if (session.user) {
        session.user = {
          id: token.id as string,
          name: token.name,
          nameAr: token.nameAr,
          role: token.role,
          email: token.email,
          scopes: token.scopes,
        } as any
      }
      return session
    },
  },
  pages: { signIn: '/login' },
}
