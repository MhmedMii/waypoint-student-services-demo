import type {
  ActivityLog,
  ActivityAction,
  ActivityActorRole,
} from '../../domain/entities/activityLog'

export interface CreateActivityLogInput {
  actorId: string | null
  actorName: string
  actorRole: ActivityActorRole
  action: ActivityAction
  targetType: 'account' | 'visit' | 'application'
  targetId: string
  details: string | null
  detailsAr: string | null
}

export interface ActivityLogRepository {
  create(input: CreateActivityLogInput): Promise<ActivityLog>
  // فلتر التاريخ لازم يسأل قاعدة البيانات: قبل، كان يفلتر داخل آخر ٢٠٠ حدث
  // بس، فـ"آخر ٣٠ يوم" ما كانت توصل لأبعد من آخر ٢٠٠ مهما كان
  findInRange(fromInclusive: Date | null, limit: number): Promise<ActivityLog[]>
  // للتصدير: كل الفترة بدون حد. الملف هو السجل الكامل — نسخة مقصوصة بصمت
  // شكلها كامل، وهذا بالضبط العيب اللي كان فيه (آخر ٢٠٠ بغض النظر عن الفترة)
  findAllInRange(fromInclusive: Date | null): Promise<ActivityLog[]>
  countInRange(fromInclusive: Date | null): Promise<number>
  countAll(): Promise<number>
}
