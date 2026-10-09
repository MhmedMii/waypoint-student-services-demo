// src/app/admin/generateTempPassword.ts
const PASSWORD_LENGTH = 12
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'

// كلمة مرور مؤقتة تتولد بالمتصفح (Web Crypto)، تنعرض مرة وحدة للسوبر أدمن وما تتخزن بعدها
export function generateTempPassword(): string {
  const randomValues = new Uint32Array(PASSWORD_LENGTH)
  crypto.getRandomValues(randomValues)
  return Array.from(randomValues, (value) => CHARSET[value % CHARSET.length]).join('')
}
