import type { User, UserRole, Shift, Floor } from '../../domain/entities/user'

export interface CreateUserInput {
  name: string
  role: UserRole
  email: string
  passwordHash: string
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  findActiveCounselors(): Promise<User[]>
  findAll(): Promise<User[]>
  create(input: CreateUserInput): Promise<User>
  setActive(userId: string, active: boolean): Promise<void>
  setPasswordHash(userId: string, passwordHash: string): Promise<void>
  setName(userId: string, name: string): Promise<void>
  setNameAr(userId: string, nameAr: string | null): Promise<void>
  countByRole(role: UserRole): Promise<number>
  deleteUser(userId: string): Promise<void>
  recordPresenceHeartbeat(userId: string, seenAt: Date, incrementSeconds: number): Promise<void>
  setShiftInfo(userId: string, shift: Shift | null, floor: Floor | null): Promise<void>
  setNote(userId: string, note: string | null): Promise<void>
  setRole(userId: string, role: UserRole): Promise<void>
}
