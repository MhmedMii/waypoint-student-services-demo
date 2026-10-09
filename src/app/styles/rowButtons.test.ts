import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const listsCss = readFileSync(
  join(process.cwd(), 'src/app/styles/admin-tables-and-lists.css'),
  'utf8'
)

// الأسماء والملاحظة صارت أزرار حقيقية عشان الكيبورد يوصلها — بس لازم تظل بشكل
// النص اللي كانت عليه. ".accounts-table button" (كلاس + عنصر) يغلب أي كلاس لحاله
// ويرسم إطار وخلفية وحشوة، وهذا اللي صار بالمتصفح أول مرة. jsdom ما يطبّق
// الستايل، فهنا نتأكد إن كل قاعدة إعادة ضبط تكتب المحدد الأقوى
function ruleFor(selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // المحدد، وبعده إما { مباشرة أو فاصلة ومحددات ثانية لين {
  const match = listsCss.match(new RegExp(`(^|[,}\\s])${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'm'))
  return match ? match[2] : null
}

describe('buttons that must look like the text they replaced', () => {
  it.each(['.accounts-table button.row-open-button', '.accounts-table button.row-note'])(
    '%s outranks the table button style and clears its box',
    (selector) => {
      const rule = ruleFor(selector)
      expect(rule, `no rule for ${selector}`).not.toBeNull()
      expect(rule).toMatch(/border:\s*none/)
      expect(rule).toMatch(/background:\s*none/)
      expect(rule).toMatch(/padding:\s*0/)
      expect(rule).toMatch(/margin:\s*0/)
    }
  )

  // المحدد الأقوى للملاحظة يغلب ".row-note.expanded" أيضًا — بدون هذا، الملاحظة
  // "تنفتح" وaria-expanded يقول true وهي باقية مقصوصة على الشاشة
  it('lets an expanded note actually unfold inside the table', () => {
    const rule = ruleFor('.accounts-table button.row-note.expanded')
    expect(rule, 'no expanded rule at the table specificity').not.toBeNull()
    expect(rule).toMatch(/white-space:\s*normal/)
    expect(rule).toMatch(/overflow:\s*visible/)
  })
})
