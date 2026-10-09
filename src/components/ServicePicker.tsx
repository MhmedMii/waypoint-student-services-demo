'use client'
import { useEffect, useId, useRef, useState } from 'react'

export interface ServicePickerOption {
  value: string
  icon: string
  name: string
  detail: string
}

interface ServicePickerProps {
  options: readonly ServicePickerOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  searchPlaceholder: string
  noMatchText: string
  moreBelowText: string
}

// "UK — Student visa" → اسم الدولة + نوع التأشيرة. الترجمات عندنا كلها بنفس
// الصيغة (إنجليزي وعربي)، فنقسم على أول " — " بدل ما نضاعف مفاتيح الترجمة
export function splitServiceLabel(label: string): { name: string; detail: string } {
  const separatorIndex = label.indexOf(' — ')
  if (separatorIndex === -1) return { name: label, detail: '' }
  return { name: label.slice(0, separatorIndex), detail: label.slice(separatorIndex + 3) }
}

function matchesQuery(option: ServicePickerOption, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return `${option.name} ${option.detail}`.toLowerCase().includes(needle)
}

// القائمة تنفتح تحت الزر بعرض النموذج، فيها بحث وسكرول — بأي جهاز (جوال/تابلت/
// كمبيوتر) العميل يقدر يتصفح القائمة كلها أو يكتب اسم الدولة
export function ServicePicker({
  options,
  value,
  onChange,
  ariaLabel,
  searchPlaceholder,
  noMatchText,
  moreBelowText,
}: ServicePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const selected = options.find((option) => option.value === value) ?? options[0]
  const visibleOptions = options.filter((option) => matchesQuery(option, query))

  function optionId(index: number): string {
    return `${listId}-option-${index}`
  }

  function open() {
    const selectedIndex = options.findIndex((option) => option.value === value)
    setQuery('')
    setActiveIndex(Math.max(0, selectedIndex))
    setIsOpen(true)
  }

  function close(returnFocus: boolean) {
    setIsOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  function choose(option: ServicePickerOption) {
    onChange(option.value)
    close(true)
  }

  function updateMoreBelow() {
    const list = listRef.current
    if (!list) return
    setHasMoreBelow(list.scrollHeight - list.scrollTop - list.clientHeight > 4)
  }

  useEffect(() => {
    if (isOpen) searchRef.current?.focus()
  }, [isOpen])

  // نقر برا القائمة يسكّرها — pointerdown يغطي اللمس والماوس معًا
  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  // الخيار النشط دايم يبقى ظاهر وقت التنقل بالأسهم
  useEffect(() => {
    if (!isOpen) return
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isOpen])

  useEffect(() => {
    if (isOpen) updateMoreBelow()
  }, [isOpen, query])

  function handleSearchKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, visibleOptions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = visibleOptions[activeIndex]
      if (option) choose(option)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
    } else if (event.key === 'Tab') {
      setIsOpen(false)
    }
  }

  return (
    <div className="service-picker" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`service-picker-trigger${isOpen ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${ariaLabel}: ${selected.name}`}
        onClick={() => (isOpen ? close(false) : open())}
      >
        <span className="service-picker-flag" aria-hidden="true">
          {selected.icon}
        </span>
        <span className="service-picker-text">
          <span className="service-picker-name">{selected.name}</span>
          {selected.detail && <span className="service-picker-detail">{selected.detail}</span>}
        </span>
        <span className="service-picker-caret dir-arrow" aria-hidden="true">
          {isOpen ? '▴' : '▾'}
        </span>
      </button>

      {isOpen && (
        <div className="service-picker-popup">
          <div className="service-picker-search">
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label={searchPlaceholder}
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={visibleOptions.length > 0 ? optionId(activeIndex) : undefined}
              placeholder={searchPlaceholder}
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleSearchKeyDown}
            />
            {query && (
              <button
                type="button"
                className="service-picker-clear"
                aria-label="Clear"
                onClick={() => {
                  setQuery('')
                  setActiveIndex(0)
                  searchRef.current?.focus()
                }}
              >
                ✕
              </button>
            )}
          </div>

          {visibleOptions.length === 0 ? (
            <div className="service-picker-empty" role="status">
              {noMatchText.replace('{query}', query.trim())}
            </div>
          ) : (
            <div className="service-picker-scroll">
              <ul
                id={listId}
                role="listbox"
                aria-label={ariaLabel}
                className="service-picker-list"
                ref={listRef}
                onScroll={updateMoreBelow}
              >
                {visibleOptions.map((option, index) => (
                  <li
                    key={option.value}
                    id={optionId(index)}
                    role="option"
                    aria-selected={option.value === value}
                    className={`service-picker-option${option.value === value ? ' selected' : ''}${
                      index === activeIndex ? ' active' : ''
                    }`}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option)}
                  >
                    <span className="service-picker-flag" aria-hidden="true">
                      {option.icon}
                    </span>
                    <span className="service-picker-text">
                      <span className="service-picker-name">{option.name}</span>
                      {option.detail && (
                        <span className="service-picker-detail">{option.detail}</span>
                      )}
                    </span>
                    {option.value === value && (
                      <span className="service-picker-check" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {hasMoreBelow && (
                <div className="service-picker-more" aria-hidden="true">
                  {moreBelowText}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
