import { describe, it, expect, vi } from 'vitest'
import { useRef, useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useDialog } from './useDialog'

function Harness({ withInitialFocus = false }: { withInitialFocus?: boolean }) {
  const [open, setOpen] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const { dialogProps, titleId } = useDialog({
    open,
    onClose: () => setOpen(false),
    initialFocusRef: withInitialFocus ? cancelRef : undefined,
  })
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button">Behind the dialog</button>
      {open && (
        <div {...dialogProps}>
          <p id={titleId}>Sample dialog</p>
          <button type="button">First</button>
          <button type="button" ref={cancelRef}>
            Middle
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Last
          </button>
        </div>
      )}
    </>
  )
}

function openDialog(props: { withInitialFocus?: boolean } = {}) {
  render(<Harness {...props} />)
  const opener = screen.getByRole('button', { name: 'Open' })
  opener.focus()
  fireEvent.click(opener)
  return { opener, dialog: screen.getByRole('dialog', { name: 'Sample dialog' }) }
}

describe('useDialog', () => {
  it('is announced as a modal dialog named by its title', () => {
    const { dialog } = openDialog()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('moves focus into the dialog when it opens', () => {
    const { dialog } = openDialog()
    expect(dialog).toHaveFocus()
  })

  it('can put focus on a chosen control instead', () => {
    openDialog({ withInitialFocus: true })
    expect(screen.getByRole('button', { name: 'Middle' })).toHaveFocus()
  })

  it('wraps Tab from the last control back to the first', () => {
    openDialog()
    screen.getByRole('button', { name: 'Last' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  // النص اللي عادةً ينسى: Shift+Tab من أول عنصر لازم يلف لآخر عنصر، مو يطيح للصفحة
  it('wraps Shift+Tab from the first control to the last', () => {
    openDialog()
    screen.getByRole('button', { name: 'First' }).focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('wraps Shift+Tab from the dialog itself to the last control', () => {
    const { dialog } = openDialog()
    expect(dialog).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('pulls focus back in if it has somehow landed behind the dialog', () => {
    openDialog()
    screen.getByRole('button', { name: 'Behind the dialog' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('leaves Tab alone in the middle, so the browser moves normally', () => {
    openDialog()
    screen.getByRole('button', { name: 'First' }).focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('closes on Escape and returns focus to the button that opened it', () => {
    const { opener } = openDialog()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('returns focus to the opener however it closes', () => {
    const { opener } = openDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Last' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('stops listening once closed', () => {
    const onClose = vi.fn()
    function Closed() {
      const { dialogProps } = useDialog({ open: false, onClose })
      return <div {...dialogProps} />
    }
    render(<Closed />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
