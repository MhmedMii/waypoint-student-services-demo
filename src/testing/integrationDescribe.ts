import { describe } from 'vitest'

// تستات التكامل تتخطى نفسها بدون DATABASE_URL، وهذا مناسب بجهاز المطوّر.
// لكن بالـCI التخطي الصامت هو أسوأ حالة: الخطوة تطلع خضراء وهي ما فحصت ولا
// شي، ولو طاحت متغيرة البيئة يوم من الأيام ما راح ينتبه أحد. فالخطوة اللي
// المفروض تشغّلها تضبط REQUIRE_DATABASE_TESTS=1، وعندها غياب القاعدة يطيح
// بصوت عالٍ بدل ما يمر بصمت
export const integrationDescribe = (() => {
  if (process.env.DATABASE_URL) return describe
  if (process.env.REQUIRE_DATABASE_TESTS === '1') {
    throw new Error(
      'REQUIRE_DATABASE_TESTS=1 but DATABASE_URL is not set — the integration tests would have ' +
        'skipped silently and this step would have passed without testing anything.'
    )
  }
  return describe.skip
})()
