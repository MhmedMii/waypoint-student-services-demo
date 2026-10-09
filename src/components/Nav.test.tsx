import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: { user: { id: 'a1', name: 'Local Admin', role: 'admin', scopes: [] } },
  }),
  signOut: vi.fn(),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/admin' }))
// الشعار يرسم على canvas، وjsdom ما عنده canvas — مو موضوع هالتست
vi.mock('./LogoTile', () => ({ LogoTile: () => null }))

import { Nav } from './Nav'

function renderNav() {
  return render(
    <LanguageProvider>
      <Nav />
    </LanguageProvider>
  )
}

// بالموبايل ☰ يفتح ويسكّر قائمة جانبية. قارئ الشاشة لازم يعرف حالتها،
// وEscape لازم يسكّرها ويرجّع التركيز لـ ☰ بدل ما يضيع بقائمة صارت مخفية
describe('Nav on a phone', () => {
  it('says whether the menu is open, and which element it controls', () => {
    renderNav()
    const toggle = screen.getByRole('button', { name: 'Menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'app-sidebar')
    expect(document.getElementById('app-sidebar')).not.toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes on Escape and puts focus back on the menu button', () => {
    renderNav()
    const toggle = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(toggle)
    document.body.focus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('app-sidebar')).not.toHaveClass('open')
    expect(toggle).toHaveFocus()
  })

  it('ignores Escape while the menu is closed', () => {
    renderNav()
    const toggle = screen.getByRole('button', { name: 'Menu' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle).not.toHaveFocus()
  })
})
