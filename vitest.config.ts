import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: { reporter: ['text', 'html'], thresholds: { lines: 80, functions: 80 } },
    maxWorkers: 1,
    // نثبّت المنطقة الزمنية: بدونها حدود "اليوم" بالاختبارات تتبع جهاز المطوّر،
    // فتمر هنا وتطيح بالـCI (أو الأسوأ: تمر بالاثنين وتخفي خطأ حقيقي)
    env: { TZ: 'UTC' },
  },
})
