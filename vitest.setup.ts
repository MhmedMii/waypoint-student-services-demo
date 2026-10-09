import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// نضمن إن كل test ينظف الـ DOM بعده صراحة — الـ auto-cleanup بمكتبة RTL ما يثبت يشتغل مع كل ملف
// لما يكون poolOptions.threads.singleThread مفعّل (node_modules تتكاش بين الملفات)
afterEach(() => {
  cleanup()
  // الكوكيز تعيش بالـdocument نفسه، فتتسرب من تست لتست. اللغة صارت بكوكي،
  // فتست يضبط ar يخلي اللي بعده يشوف العربي بلا ما يطلبه
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=; path=/; max-age=0`
  }
})

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
