export type UserRole = 'super_admin' | 'admin' | 'counselor'

// الدوام الصباحي 8:30ص-5:30م، والمسائي 3:30م-10:00م — الفرعين بنفس المبنى، M1 وM3
export type Shift = 'day' | 'night'
export type Floor = 'M1' | 'M3'

export interface User {
  id: string
  name: string
  nameAr?: string | null
  role: UserRole
  email: string
  passwordHash: string
  active: boolean
  lastSeenAt: Date | null
  onlineSecondsToday: number
  onlineDay: string | null
  shift: Shift | null
  floor: Floor | null
  note?: string | null
}

export type SafeUser = Omit<User, 'passwordHash'>

// نرجع نسخة جديدة من المستخدم بدون الـ passwordHash، عشان ما نسربه بالـ API response
export function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user
  return safeUser
}
