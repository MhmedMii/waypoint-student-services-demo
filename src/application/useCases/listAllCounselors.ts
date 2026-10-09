import type { UserRepository } from '../ports/UserRepository'

export interface CounselorNameView {
  id: string
  name: string
  nameAr: string | null
}

export interface ListAllCounselorsDeps {
  userRepository: UserRepository
}

// للـ عرض التاريخي فقط (مين استشار زيارة قديمة) — يشمل المستشارين غير الفعّالين
// بعكس listActiveCounselors اللي يخفي الغير فعّال لأنه مخصص لدروب داون التعيين
export async function listAllCounselors(deps: ListAllCounselorsDeps): Promise<CounselorNameView[]> {
  const users = await deps.userRepository.findAll()
  return users
    .filter((u) => u.role === 'counselor')
    .map((u) => ({ id: u.id, name: u.name, nameAr: u.nameAr ?? null }))
}
