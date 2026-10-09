import type { Language } from './translations'

// كانت اللغة بالـlocalStorage وحده، والسيرفر ما يقدر يقرأه — فالصفحة تُرسم
// بالإنجليزي LTR ثم يصلّحها useEffect بعد ما يشوفها المستخدم. الكوكي يقرأها
// الطرفان، فالـ<html> يطلع صحيحًا من أول بايت
export const LANGUAGE_COOKIE = 'app-language'

// سنة كاملة: التفضيل ما يتغيّر كل يوم، وSameSite=Lax تكفي — ما فيه شي حساس
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

export function isLanguage(value: string | undefined | null): value is Language {
  return value === 'en' || value === 'ar'
}

export function languageFromCookieValue(value: string | undefined | null): Language {
  return isLanguage(value) ? value : 'en'
}

export function directionFor(language: Language): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr'
}

// الكتابة من المتصفح. document.cookie ممكن يرمي بمتصفح مقفّل، نفس قصة
// التخزين المحلي — تفضيل ضايع أهون من صفحة طايحة
export function writeLanguageCookie(language: Language): void {
  try {
    document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
  } catch {
    // ما نقدر نتذكّر الاختيار — الصفحة تكمل عادي
  }
}

export function readLanguageCookie(): Language | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LANGUAGE_COOKIE}=([^;]*)`))
    return isLanguage(match?.[1]) ? (match![1] as Language) : null
  } catch {
    return null
  }
}
