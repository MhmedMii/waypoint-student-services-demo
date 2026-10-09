import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TopScrollWrap } from './TopScrollWrap'

function setLayout(el: HTMLElement, layout: { scrollWidth: number; clientWidth: number }) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: layout.scrollWidth })
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: layout.clientWidth })
}

function renderWrap() {
  const view = render(
    <TopScrollWrap>
      <table>
        <tbody>
          <tr>
            <td>wide</td>
          </tr>
        </tbody>
      </table>
    </TopScrollWrap>
  )
  const top = view.container.querySelector('.top-scroll') as HTMLDivElement
  const body = view.container.querySelector('.table-wrap') as HTMLDivElement
  return { ...view, top, body }
}

describe('TopScrollWrap', () => {
  it('renders the children inside the scrolling table wrapper', () => {
    const { body } = renderWrap()
    expect(body).toContainHTML('<td>wide</td>')
  })

  it('hides the top scrollbar when the table fits on screen (jsdom has no layout)', () => {
    const { top } = renderWrap()
    expect(top).toHaveAttribute('hidden')
  })

  it('keeps the two scrollbars in step in both directions without looping', () => {
    const { top, body } = renderWrap()

    body.scrollLeft = 120
    fireEvent.scroll(body)
    expect(top.scrollLeft).toBe(120)

    top.scrollLeft = 40
    fireEvent.scroll(top)
    expect(body.scrollLeft).toBe(40)
  })

  it('does nothing when the other scrollbar is already at the same position', () => {
    const { top, body } = renderWrap()
    body.scrollLeft = 0
    top.scrollLeft = 0
    fireEvent.scroll(body)
    expect(top.scrollLeft).toBe(0)
  })
})
