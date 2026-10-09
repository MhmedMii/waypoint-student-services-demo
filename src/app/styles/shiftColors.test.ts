import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const STYLES = join(process.cwd(), 'src/app/styles')
const themeCss = readFileSync(join(STYLES, 'theme-colors.css'), 'utf8')
const listsCss = readFileSync(join(STYLES, 'admin-tables-and-lists.css'), 'utf8')

// الثيم الغامق معرّف بمكانين: اختيار صريح، وتفضيل النظام. أي توكن ينزل
// بواحد وينسى بالثاني يطلع بلون الثيم الفاتح على خلفية غامقة
const THEMES = {
  light: /:root\s*\{([^}]*)\}/,
  'dark, chosen': /:root\[data-theme='dark'\]\s*\{([^}]*)\}/,
  'dark, from the system': /:root:not\(\[data-theme='light'\]\)\s*\{([^}]*)\}/,
} as const

function blockOf(pattern: RegExp): string {
  const match = themeCss.match(pattern)
  expect(match, `no block matched ${pattern}`).not.toBeNull()
  return match![1]
}

function tokenIn(block: string, name: string): string | null {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  return match ? match[1].trim() : null
}

const SHIFT_TOKENS = [
  'shift-day-bg',
  'shift-day-border',
  'shift-day-fg',
  'shift-night-bg',
  'shift-night-border',
  'shift-night-fg',
]

describe('the shift pill colours', () => {
  // البق الأصلي: النقطة الليلية كانت var(--navy)، و--navy ما ينعرّف بالغامق،
  // فتطلع #1a3659 على سطح #16304d — نسبة تباين 1.10، يعني ما تُرى أصلاً
  it.each(Object.entries(THEMES))('defines every shift token for %s', (_label, pattern) => {
    const block = blockOf(pattern)
    for (const token of SHIFT_TOKENS) {
      expect(tokenIn(block, token), `--${token} is missing`).not.toBeNull()
    }
  })

  it.each(Object.entries(THEMES))('keeps the night pill off the surface colour in %s', (_l, p) => {
    const block = blockOf(p)
    const surface = tokenIn(block, 'surface')
    expect(surface).not.toBeNull()
    expect(tokenIn(block, 'shift-night-bg')).not.toBe(surface)
    expect(tokenIn(block, 'shift-day-bg')).not.toBe(surface)
  })

  it.each(Object.entries(THEMES))('keeps day and night apart in %s', (_label, pattern) => {
    const block = blockOf(pattern)
    expect(tokenIn(block, 'shift-day-bg')).not.toBe(tokenIn(block, 'shift-night-bg'))
    expect(tokenIn(block, 'shift-day-fg')).not.toBe(tokenIn(block, 'shift-night-fg'))
  })

  // النقطة وحدها ما تتغير بين الثيمين — هي اللي تربط الصفحتين بصرياً
  it('shares one dot colour per shift across both pages', () => {
    const light = blockOf(THEMES.light)
    expect(tokenIn(light, 'shift-day-dot')).toBe('#e3b95b')
    expect(tokenIn(light, 'shift-night-dot')).toBe('#4a6fa5')

    // صفحة الحسابات وصف الزيارة يقروا من نفس التوكن، مو من رقم مكتوب بمكانين
    expect(listsCss).toMatch(/\.shift-pill \.dot\.day \{\s*background: var\(--shift-day-dot\)/)
    expect(listsCss).toMatch(/\.counselor-shift\.day \.dot \{\s*background: var\(--shift-day-dot\)/)
  })

  // التدوير الكامل هو شكل الحبة بصفحة الحسابات، والاتفاق إنه يبقى نفسه
  it('keeps the pill fully rounded, as on the accounts page', () => {
    const tag = listsCss.match(/\.counselor-shift \{([^}]*)\}/)
    expect(tag).not.toBeNull()
    expect(tag![1]).toMatch(/border-radius:\s*999px/)
  })

  // الغياب سؤال ثاني: يبقى أحمر، وما يلمسه لون الشفت
  it('leaves the absence line its own colour', () => {
    expect(listsCss).toMatch(/\.counselor-away\.absent \{\s*color: var\(--danger\);/)
  })
})
