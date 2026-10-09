import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

test('fictional visits, counselor session rules, and reset', async ({ page }) => {
  await page.goto('/intake')
  await page.getByRole('button', { name: 'Register demo visit' }).click()
  await expect(page.getByRole('heading', { name: 'You’re on the list.' })).toBeVisible()
  await page.goto('/counselor')
  await page.getByRole('button', { name: 'Start next visit' }).click()
  await expect(page.getByRole('button', { name: 'Take a break' })).toBeDisabled()
  await expect(page.getByText('A conversation in progress')).toBeVisible()
  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page.getByRole('button', { name: 'Start next visit' })).toBeEnabled()
  await page.getByRole('button', { name: 'Take a break' }).click()
  await expect(page.getByRole('button', { name: 'Start next visit' })).toBeDisabled()
  await page.getByRole('button', { name: 'Return from break' }).click()
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Reset demo', exact: true })
    .click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Start next visit' })).toBeEnabled()
})

test('generated applications, local tracking, and simulated payment', async ({ page }) => {
  await page.goto('/apply')
  await expect(page.locator('input[type=file]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Attach demo documents' }).click()
  await page.getByRole('button', { name: 'Submit demo application' }).click()
  await page.getByRole('link', { name: 'Track demo application' }).click()
  await page.getByRole('button', { name: 'Simulate payment' }).click()
  await expect(page.getByText('Demo payment simulated', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Demo payment simulated', { exact: true })).toBeVisible()
})

test('production APIs stay disabled and demo traffic stays on its own origin', async ({
  page,
  request,
  baseURL,
}) => {
  const external: string[] = []
  const applicationOrigin = new URL(baseURL!).origin
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== applicationOrigin)
      external.push(url.origin)
  })
  await page.goto('/admin')
  await expect(
    page.getByRole('heading', { name: 'Every student. A clear next step.' })
  ).toBeVisible()
  expect(external).toEqual([])
  for (const path of [
    '/api/admin/accounts',
    '/api/auth/session',
    '/api/applications/upload',
    '/api/visits/new',
  ]) {
    expect((await request.get(path)).status()).toBe(410)
    expect((await request.post(path, { data: { demo: true } })).status()).toBe(410)
  }
  expect(await (await request.get('/api/health')).json()).toMatchObject({ externalServices: false })
})

test('fictional report export downloads a spreadsheet', async ({ page }) => {
  await page.goto('/admin')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export report' }).click()
  expect((await download).suggestedFilename()).toBe('waypoint-demo-report.xlsx')
})

test('Arabic, dark theme, and mobile navigation remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Switch to Arabic' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('button', { name: 'الوضع الداكن' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  await page.getByRole('button', { name: 'فتح القائمة' }).click()
  await page.getByRole('link', { name: /طلبات التأشيرات/ }).click()
  await expect(page.getByRole('heading', { name: 'مسار واضح نحو الوجهة التالية.' })).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})

test('design screenshots show only the generated demo', async ({ page }) => {
  await mkdir('docs/screenshots', { recursive: true })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/admin')
  await expect(
    page.getByRole('heading', { name: 'Every student. A clear next step.' })
  ).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/overview.png', fullPage: true })
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.screenshot({ path: 'docs/screenshots/overview-dark.png', fullPage: true })
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'docs/screenshots/overview-mobile.png', fullPage: true })
})
