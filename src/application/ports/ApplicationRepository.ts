import type {
  Application,
  ApplicationKind,
  ApplicationStatus,
  ServiceCode,
} from '../../domain/entities/application'

export interface CreateApplicationInput {
  kind: ApplicationKind
  serviceCode: ServiceCode
  name: string
  phone: string
  email: string | null
  fields: Record<string, string>
}

export interface ApplicationRepository {
  create(input: CreateApplicationInput): Promise<Application>
  findById(id: string): Promise<Application | null>
  findAllByKind(kind: ApplicationKind): Promise<Application[]>
  findByCounselor(counselorId: string): Promise<Application[]>
  findAllByKindMatchingName(kind: ApplicationKind, normalizedTerm: string): Promise<Application[]>
  findAllByPhones(phones: string[]): Promise<Application[]>
  findAllByKindInRange(kind: ApplicationKind, from: Date, to: Date): Promise<Application[]>
  countAll(): Promise<number>
  findAllInRange(from: Date, to: Date): Promise<Application[]>
  findAllByPhone(phone: string): Promise<Application[]>
  updateStatus(
    id: string,
    status: ApplicationStatus,
    statusNote: string | null,
    referenceNumber: string | null
  ): Promise<void>
  assignCounselor(id: string, counselorId: string | null): Promise<void>
  setPaymentUrl(id: string, paymentUrl: string): Promise<void>
  deleteApplication(id: string): Promise<void>
}
