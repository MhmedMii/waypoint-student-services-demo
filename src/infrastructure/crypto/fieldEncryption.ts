import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12
const AUTH_TAG_LENGTH_BYTES = 16

function readEncryptionKeyFromEnvironment(): string {
  const key = process.env.FIELD_ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY is not configured — required for encrypting/decrypting PII fields'
    )
  }
  return key
}

// نستخدم مفتاح واحد بس بمتغير بيئة وحد، ونشتق منه مفتاحين مختلفين
// (تشفير و HMAC) عن طريق SHA-256 مع لاحقة مختلفة لكل غرض — عشان
// لا نحتاج نوفر ونحفظ سرين منفصلين
function deriveKey(purpose: 'enc' | 'hmac'): Buffer {
  return createHash('sha256').update(`${readEncryptionKeyFromEnvironment()}:${purpose}`).digest()
}

export function encryptSensitiveText(plaintext: string): string {
  const key = deriveKey('enc')
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptSensitiveText(stored: string): string {
  const key = deriveKey('enc')
  const raw = Buffer.from(stored, 'base64')
  const iv = raw.subarray(0, IV_LENGTH_BYTES)
  const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES)
  const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function createSearchableFingerprint(plaintext: string): string {
  return createHmac('sha256', deriveKey('hmac')).update(plaintext).digest('hex')
}
