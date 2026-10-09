import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  encryptSensitiveText,
  decryptSensitiveText,
  createSearchableFingerprint,
} from './fieldEncryption'

describe('fieldEncryption', () => {
  const originalKey = process.env.FIELD_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = 'test-key-do-not-use-in-production'
  })

  afterEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = originalKey
  })

  test('decrypts back to the original plaintext', () => {
    const plaintext = '99990001'
    const ciphertext = encryptSensitiveText(plaintext)
    expect(decryptSensitiveText(ciphertext)).toBe(plaintext)
  })

  test('produces different ciphertext for the same plaintext each call (random IV)', () => {
    const plaintext = '99990001'
    expect(encryptSensitiveText(plaintext)).not.toBe(encryptSensitiveText(plaintext))
  })

  test('createSearchableFingerprint produces the same hash for the same plaintext every time', () => {
    expect(createSearchableFingerprint('99990001')).toBe(createSearchableFingerprint('99990001'))
  })

  test('createSearchableFingerprint produces different hashes for different plaintext', () => {
    expect(createSearchableFingerprint('99990001')).not.toBe(
      createSearchableFingerprint('99990002')
    )
  })

  test('throws when FIELD_ENCRYPTION_KEY is not configured', () => {
    delete process.env.FIELD_ENCRYPTION_KEY
    expect(() => encryptSensitiveText('99990001')).toThrow('FIELD_ENCRYPTION_KEY')
  })

  test('round-trips a JSON-stringified object (applications.fields use case)', () => {
    const fields = { 'civil-id': '123456789', dob: '1990-01-01', address: 'Kuwait City' }
    const ciphertext = encryptSensitiveText(JSON.stringify(fields))
    expect(JSON.parse(decryptSensitiveText(ciphertext))).toEqual(fields)
  })
})
