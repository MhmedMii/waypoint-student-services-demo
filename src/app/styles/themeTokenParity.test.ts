import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const themeCss = readFileSync(join(process.cwd(), 'src/app/styles/theme-colors.css'), 'utf8')

// الوضع الغامق معرّف بمكانين: اختيار صريح من المستخدم، وتفضيل النظام. أي توكن
// ينزل بواحد وينسى بالثاني — أو ينزل بالفاتح وحده — ياخذ قيمة الفاتح بالغامق
// بصمت. هكذا صارت النقطة الليلية كحلي على كحلي، وهكذا صار رابط القائمة النشط
// يُقرأ بـ3.03. التست ما يعرف أسماء بعينها: يقرأ كل المعلن ويقارن
const BLOCKS = {
  light: /:root\s*\{([\s\S]*?)\n\}/,
  'dark, chosen': /:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/,
  'dark, from the system': /:root:not\(\[data-theme='light'\]\)\s*\{([\s\S]*?)\n  \}/,
} as const

// استثناءات مكتوبة بسبب، مثل قائمة المسارات العامة: لو توكن ينقص عمدًا، لازم
// أحد يكتب ليش — بدل ما يمر كسهو
const LIGHT_ONLY_ON_PURPOSE: Record<string, string> = {
  navy: 'the printed QR poster keeps one navy in both themes; a screen theme must not repaint paper',
  'navy-deep': 'the same poster gradient, nothing else uses it',
  'shift-day-dot':
    'one dot colour ties the accounts page and the visits row together in both themes',
  'shift-night-dot': 'the same, for the night dot',
}

function declaredIn(pattern: RegExp): Set<string> {
  const match = themeCss.match(pattern)
  expect(match, `no theme block matched ${pattern}`).not.toBeNull()
  return new Set([...match![1].matchAll(/^\s*--([a-z0-9-]+):/gm)].map((m) => m[1]))
}

const light = declaredIn(BLOCKS.light)
const darkBlocks = {
  'dark, chosen': declaredIn(BLOCKS['dark, chosen']),
  'dark, from the system': declaredIn(BLOCKS['dark, from the system']),
}

describe('theme token parity', () => {
  it('declares at least the palette we expect, so a broken regex cannot pass silently', () => {
    expect(light.size).toBeGreaterThan(15)
    for (const name of Object.keys(darkBlocks)) {
      expect(darkBlocks[name as keyof typeof darkBlocks].size).toBeGreaterThan(10)
    }
  })

  it.each(Object.keys(darkBlocks))('gives %s a value for every light token', (blockName) => {
    const dark = darkBlocks[blockName as keyof typeof darkBlocks]
    const missing = [...light].filter(
      (token) => !dark.has(token) && !(token in LIGHT_ONLY_ON_PURPOSE)
    )
    expect(
      missing,
      `these keep their light value in dark mode: ${missing.join(', ')}. ` +
        'Give each one a dark value, or add it to LIGHT_ONLY_ON_PURPOSE with the reason.'
    ).toEqual([])
  })

  // العكس كمان: توكن بالغامق وما له أصل بالفاتح يعني الفاتح ياخذ قيمة ورثها من
  // مكان ثاني أو ما ياخذ شي
  it.each(Object.keys(darkBlocks))(
    'declares nothing in %s that light never declared',
    (blockName) => {
      const dark = darkBlocks[blockName as keyof typeof darkBlocks]
      const orphans = [...dark].filter((token) => !light.has(token))
      expect(orphans).toEqual([])
    }
  )

  it('keeps the two dark blocks identical to each other', () => {
    expect([...darkBlocks['dark, chosen']].sort()).toEqual(
      [...darkBlocks['dark, from the system']].sort()
    )
  })

  // الاستثناء لازم يكون عن توكن موجود فعلاً — وإلا صارت القائمة تخفي أخطاء
  it('lists no exception for a token that does not exist', () => {
    for (const token of Object.keys(LIGHT_ONLY_ON_PURPOSE)) {
      expect(light.has(token), `--${token} is excused but never declared`).toBe(true)
    }
  })

  it('gives every exception a reason worth reading', () => {
    for (const [token, reason] of Object.entries(LIGHT_ONLY_ON_PURPOSE)) {
      expect(reason.length, `--${token} needs a real reason`).toBeGreaterThan(20)
    }
  })
})
