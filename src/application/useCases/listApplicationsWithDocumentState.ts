import type { UserRole } from '../../domain/entities/user'
import type { SpecializationScope } from '../../domain/entities/counselor'
import type { Application, ApplicationKind } from '../../domain/entities/application'
import { SERVICE_FORM_SCHEMAS } from '../../domain/entities/serviceFormSchemas'
import {
  missingRequiredDocuments,
  visibleDocumentSlots,
} from '../../domain/entities/requiredDocuments'
import type { ApplicationRepository } from '../ports/ApplicationRepository'
import type { ApplicationDocumentRepository } from '../ports/ApplicationDocumentRepository'
import { isPhoneSearch, normalizeSearchText } from '../../domain/text/normalizeSearchText'
import { listApplicationsForScope } from './listApplicationsForScope'

export interface ApplicationListFilter {
  search?: string
  from?: Date
  to?: Date
}

export interface ApplicationWithDocumentState extends Application {
  missingDocuments: string[]
  requiredDocumentCount: number
  uploadedRequiredCount: number
}

export interface ListApplicationsWithDocumentStateDeps {
  applicationRepository: ApplicationRepository
  applicationDocumentRepository: ApplicationDocumentRepository
}

export type ListApplicationsWithDocumentStateResult =
  { ok: true; applications: ApplicationWithDocumentState[] } | { ok: false; reason: string }

// رفع ملف ممكن يفشل بصمت بعد ما ينحفظ الطلب، فالموظف لازم يشوف من القائمة
// نفسها مين ناقصه مستندات بدل ما يفتح كل طلب يتأكد
// البحث يتجاهل التواريخ (كل الأرشيف)، والنطاق يُستخدم بصفحة الزيارات فقط
async function applyFilter(
  applications: Application[],
  kind: ApplicationKind,
  deps: ListApplicationsWithDocumentStateDeps,
  filter: ApplicationListFilter
): Promise<Application[]> {
  if (filter.search) {
    const normalized = normalizeSearchText(filter.search)
    if (isPhoneSearch(filter.search)) {
      const byPhone = await deps.applicationRepository.findAllByPhone(normalized)
      return byPhone.filter((application) => application.kind === kind)
    }
    return deps.applicationRepository.findAllByKindMatchingName(kind, normalized)
  }
  if (filter.from && filter.to) {
    return deps.applicationRepository.findAllByKindInRange(kind, filter.from, filter.to)
  }
  return applications
}

export async function listApplicationsWithDocumentState(
  actorRole: UserRole,
  actorScopes: SpecializationScope[],
  kind: ApplicationKind,
  deps: ListApplicationsWithDocumentStateDeps,
  filter: ApplicationListFilter = {}
): Promise<ListApplicationsWithDocumentStateResult> {
  const result = await listApplicationsForScope(actorRole, actorScopes, kind, deps)
  if (!result.ok) return result
  result.applications = await applyFilter(result.applications, kind, deps, filter)

  const labelsByApplication = await deps.applicationDocumentRepository.findLabelsByApplicationIds(
    result.applications.map((application) => application.id)
  )

  return {
    ok: true,
    applications: result.applications.map((application) => {
      const schema = SERVICE_FORM_SCHEMAS[application.serviceCode]
      // خدمة انشالت أو انتسمّت غير — ما نقدر نحكم على مستنداتها، فنعتبرها بلا نواقص
      if (!schema) {
        return {
          ...application,
          missingDocuments: [],
          requiredDocumentCount: 0,
          uploadedRequiredCount: 0,
        }
      }
      const uploaded = labelsByApplication[application.id] ?? []
      const missing = missingRequiredDocuments(schema, application.fields, uploaded)
      const requiredDocumentCount = visibleDocumentSlots(schema, application.fields).filter(
        (slot) => slot.required
      ).length
      return {
        ...application,
        missingDocuments: missing.map((slot) => slot.label),
        requiredDocumentCount,
        uploadedRequiredCount: requiredDocumentCount - missing.length,
      }
    }),
  }
}
