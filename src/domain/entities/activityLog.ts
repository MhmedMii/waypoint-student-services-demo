import type { UserRole } from './user'

export type ActivityAction =
  | 'account_created'
  | 'account_deactivated'
  | 'account_reactivated'
  | 'account_password_reset'
  | 'account_deleted'
  | 'account_scopes_updated'
  | 'account_shift_updated'
  | 'account_note_updated'
  | 'account_name_ar_updated'
  | 'account_promoted'
  | 'account_downgraded'
  | 'client_data_exported'
  | 'visit_created'
  | 'visit_picked_up'
  | 'visit_duplicate_overridden'
  | 'visit_left_unassigned'
  | 'visit_assigned_to_absent'
  | 'follow_up_counselor_not_in'
  | 'follow_up_absent_counselor'
  | 'visit_closed'
  | 'visit_reassigned'
  | 'visit_status_changed'
  | 'visit_deleted'
  | 'application_submitted'
  | 'application_status_updated'
  | 'application_counselor_assigned'
  | 'application_payment_url_set'
  | 'application_deleted'

// خطورة الإجراء — نستخدمها بالهيدر وبالفلاتر وبالشريط الجانبي للصف.
// حذف = تدميري، وأي إجراء يغيّر صلاحية الدخول = صلاحيات، والباقي اعتيادي
export type ActivitySeverity = 'routine' | 'privilege' | 'destructive'

const SEVERITY_BY_ACTION: Record<ActivityAction, ActivitySeverity> = {
  account_deleted: 'destructive',
  visit_deleted: 'destructive',
  application_deleted: 'destructive',

  account_created: 'privilege',
  account_deactivated: 'privilege',
  account_reactivated: 'privilege',
  account_password_reset: 'privilege',
  account_scopes_updated: 'privilege',
  account_promoted: 'privilege',
  account_downgraded: 'privilege',
  // يصدّر أسماء وأرقام هواتف كل العملاء بملف واحد — نفس درجة خطورة الإجراءات
  // الحساسة الثانية اللي تلمس صلاحيات أو بيانات، لا اعتيادي زي إنشاء زيارة
  client_data_exported: 'privilege',

  account_shift_updated: 'routine',
  account_note_updated: 'routine',
  account_name_ar_updated: 'routine',
  visit_created: 'routine',
  visit_picked_up: 'routine',
  // تخطّي تحذير التكرار قرار موظف، مو خطوة عادية بالمسار — يستاهل صف خاص
  // يقدر المشرف يفلتر عليه، بدل ما يضيع كملاحظة داخل صف إنشاء الزيارة
  visit_duplicate_overridden: 'routine',
  // الأحمر هنا حالة مو درجة خطورة: ما انحذف شي وما تغيّرت صلاحية. الفرق بين
  // الاثنين هو نفس خط الخمسة أيام اللي يوقف التوزيع
  // عميل وصل وما حصل مستشار — أخطر شي بالسجل، وكان مدفون كنص رمادي بآخر
  // سطر "إنشاء زيارة" يشبه أي صف عادي
  visit_left_unassigned: 'routine',
  visit_assigned_to_absent: 'routine',
  follow_up_counselor_not_in: 'routine',
  follow_up_absent_counselor: 'routine',
  visit_closed: 'routine',
  visit_reassigned: 'routine',
  visit_status_changed: 'routine',
  application_submitted: 'routine',
  application_status_updated: 'routine',
  application_counselor_assigned: 'routine',
  application_payment_url_set: 'routine',
}

export function severityOf(action: ActivityAction): ActivitySeverity {
  return SEVERITY_BY_ACTION[action] ?? 'routine'
}

// 'system' = ما فيه مستخدم مسجّل دخول: الكشك أو فورم التقديم العام.
// نخزّن الدور عشان الواجهة تترجم الاسم بدل ما نخزّن نص إنجليزي بقاعدة البيانات.
export type ActivityActorRole = UserRole | 'system'

export const SYSTEM_ACTOR_NAME = 'Self-service'

export interface ActivityLog {
  id: string
  actorId: string | null
  actorName: string
  actorNameAr: string | null
  actorRole: ActivityActorRole
  action: ActivityAction
  targetType: 'account' | 'visit' | 'application'
  targetId: string
  details: string | null
  detailsAr: string | null
  createdAt: Date
}
