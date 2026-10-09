import { toSafeUser } from '../../domain/entities/user'
import type { SafeUser } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { UserRepository } from '../ports/UserRepository'
import type { SpecializationRepository } from '../ports/SpecializationRepository'

export interface ListAccountsDeps {
  userRepository: UserRepository
  specializationRepository: SpecializationRepository
}

// المستشار بلا نطاقات ما يوصله عميل أبدًا مهما كان متاح — فالصفحة لازم تبيّن
// النطاقات، مو تخليها مخفية داخل نافذة التعديل
export interface AccountWithScopes extends SafeUser {
  scopes: SpecializationScope[]
}

// نرجع كل الحسابات بدون الـ passwordHash، نفس منطق Fix 2
export async function listAccounts(deps: ListAccountsDeps): Promise<AccountWithScopes[]> {
  const users = await deps.userRepository.findAll()
  const counselorIds = users.filter((user) => user.role === 'counselor').map((user) => user.id)
  const scopesByCounselor =
    await deps.specializationRepository.findScopesForCounselors(counselorIds)

  return users.map((user) => ({
    ...toSafeUser(user),
    scopes: scopesByCounselor[user.id] ?? [],
  }))
}
