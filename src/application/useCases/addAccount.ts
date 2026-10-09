import bcrypt from 'bcryptjs'
import { validateEmailAddress } from '../../domain/validation/validateEmailAddress'
import { validateRole } from '../../domain/validation/validateRole'
import { validatePasswordStrength } from '../../domain/validation/validatePasswordStrength'
import { validateSpecializationScopes } from '../../domain/validation/validateSpecializationScopes'
import { MAX_SUPER_ADMINS } from './promoteToSuperAdmin'
import type { User, UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { UserRepository } from '../ports/UserRepository'
import type { SpecializationRepository } from '../ports/SpecializationRepository'

export interface AddAccountInput {
  name: string
  role: UserRole
  email: string
  password: string
  scopes?: SpecializationScope[]
}

export interface AddAccountDeps {
  userRepository: UserRepository
  specializationRepository?: SpecializationRepository
}

export type AddAccountResult =
  { ok: true; user: User } | { ok: false; reason: string; code: 'forbidden' | 'validation' }

export async function addAccount(
  actorRole: UserRole,
  input: AddAccountInput,
  deps: AddAccountDeps
): Promise<AddAccountResult> {
  if (actorRole !== 'super_admin') return { ok: false, reason: 'onlySuperAdmin', code: 'forbidden' }

  const roleResult = validateRole(input.role)
  if (!roleResult.isValid) return { ok: false, reason: roleResult.reason, code: 'validation' }

  if (input.role === 'super_admin') {
    const superAdminCount = await deps.userRepository.countByRole('super_admin')
    if (superAdminCount >= MAX_SUPER_ADMINS) {
      return { ok: false, reason: 'maxSuperAdminsReached', code: 'validation' }
    }
  }

  const emailResult = validateEmailAddress(input.email)
  if (!emailResult.isValid) return { ok: false, reason: emailResult.reason, code: 'validation' }

  const passwordResult = validatePasswordStrength(input.password)
  if (!passwordResult.isValid)
    return { ok: false, reason: passwordResult.reason, code: 'validation' }

  const hasScopes = input.role === 'counselor' && Array.isArray(input.scopes)
  if (hasScopes) {
    const scopesResult = validateSpecializationScopes(input.scopes as SpecializationScope[])
    if (!scopesResult.isValid) return { ok: false, reason: scopesResult.reason, code: 'validation' }
  }

  const passwordHash = await bcrypt.hash(input.password, 12)
  const user = await deps.userRepository.create({
    name: input.name,
    role: input.role,
    email: input.email,
    passwordHash,
  })

  if (hasScopes && deps.specializationRepository) {
    await deps.specializationRepository.setScopes(user.id, input.scopes as SpecializationScope[])
  }

  return { ok: true, user }
}
