import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ServicePicker, splitServiceLabel } from './ServicePicker'

const OPTIONS = [
  { value: 'uk', icon: '🇬🇧', name: 'United Kingdom', detail: 'Student visa' },
  { value: 'us', icon: '🇺🇸', name: 'USA', detail: 'F1 Student visa' },
  { value: 'au', icon: '🇦🇺', name: 'Australia', detail: 'Student visa' },
  { value: 'at', icon: '🇦🇹', name: 'Austria', detail: 'Student visa' },
]

function renderPicker(value = 'uk') {
  const onChange = vi.fn()
  render(
    <div>
      <ServicePicker
        options={OPTIONS}
        value={value}
        onChange={onChange}
        ariaLabel="Country"
        searchPlaceholder="Search 4 countries…"
        noMatchText="No country matches “{query}”."
        moreBelowText="More"
      />
      <button type="button">outside</button>
    </div>
  )
  return onChange
}

const trigger = () => screen.getByRole('button', { name: /^Country:/ })

describe('splitServiceLabel', () => {
  it('splits the country from the visa type on the em dash', () => {
    expect(splitServiceLabel('USA — F1 Student visa')).toEqual({
      name: 'USA',
      detail: 'F1 Student visa',
    })
    expect(splitServiceLabel('أمريكا — تأشيرة طالب F1')).toEqual({
      name: 'أمريكا',
      detail: 'تأشيرة طالب F1',
    })
  })

  it('keeps the whole label as the name when there is no separator', () => {
    expect(splitServiceLabel('IELTS')).toEqual({ name: 'IELTS', detail: '' })
  })
})

describe('ServicePicker', () => {
  it('starts closed and shows the selected country with its visa type', () => {
    renderPicker('us')
    expect(trigger()).toHaveTextContent('USA')
    expect(trigger()).toHaveTextContent('F1 Student visa')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens with every country listed, the chosen one ticked, and focus in the search box', () => {
    renderPicker()
    fireEvent.click(trigger())
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(screen.getByRole('option', { name: /United Kingdom/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('combobox')).toHaveFocus()
  })

  it('picks a country on click and closes', () => {
    const onChange = renderPicker()
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('option', { name: /USA/ }))
    expect(onChange).toHaveBeenCalledWith('us')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('filters as the client types and matches the visa type too', () => {
    renderPicker()
    fireEvent.click(trigger())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'au' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('Australia'),
      expect.stringContaining('Austria'),
    ])

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'f1' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option')).toHaveTextContent('USA')
  })

  it('shows a clear message when nothing matches, and the ✕ button restores the list', () => {
    renderPicker()
    fireEvent.click(trigger())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fra' } })
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No country matches “fra”.')

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  it('moves with the arrow keys and picks with Enter', () => {
    const onChange = renderPicker()
    fireEvent.click(trigger())
    const search = screen.getByRole('combobox')
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowUp' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('us')
  })

  it('does not run past the ends of the list with the arrow keys', () => {
    const onChange = renderPicker()
    fireEvent.click(trigger())
    const search = screen.getByRole('combobox')
    for (let i = 0; i < 10; i++) fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('at')
  })

  it('does nothing on Enter when the search has no matches', () => {
    const onChange = renderPicker()
    fireEvent.click(trigger())
    const search = screen.getByRole('combobox')
    fireEvent.change(search, { target: { value: 'zzz' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('closes on Escape without changing the selection and returns focus to the button', () => {
    const onChange = renderPicker()
    fireEvent.click(trigger())
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(trigger()).toHaveFocus()
  })

  it('closes when the client taps outside', () => {
    renderPicker()
    fireEvent.click(trigger())
    fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('toggles closed when the trigger is tapped again, and forgets the old search', () => {
    renderPicker()
    fireEvent.click(trigger())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'au' } })
    fireEvent.click(trigger())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.click(trigger())
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(screen.getByRole('combobox')).toHaveValue('')
  })
})
