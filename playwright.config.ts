// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: process.env.DEMO_BASE_URL
    ? undefined
    : {
        command:
          process.env.DEMO_E2E_PRODUCTION === '1'
            ? 'npm run start -- --hostname 127.0.0.1'
            : 'npm run dev -- --hostname 127.0.0.1',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
      },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // شغلنا بالمحلي ما يحتاج إعادة — لو فشل يبين الخطأ فورًا. بس CI عنده عداء
  // مشترك أبطأ، فتوقّف عرضي (مثلاً أول طلب لصفحة Next لسه يترجمها) يفشل
  // مرة وينعدّي بإعادة واحدة، بدل ما يوصل إيميل "فشل" على شي شغّال أصلاً
  retries: process.env.CI ? 1 : 0,
})
