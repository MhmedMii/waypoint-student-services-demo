import { computeHandlingStats } from '../../domain/time/computeHandlingStats'
import { startOfKuwaitDay } from '../../domain/time/kuwaitTime'
import { waitingBucket } from '../../domain/routing/waitingBucket'
import type { VisitRepository } from '../ports/VisitRepository'
import type { UserRepository } from '../ports/UserRepository'
import type { Clock } from '../ports/Clock'

export interface AdminNotifications {
  unassignedClients: number
  // مستشار تحت خط الغياب — لسا يستلم عملاء، بس ما فتح التطبيق اليوم
  clientsWaitingOnQuietCounselor: number
  // فوق الخط: التوزيع يتخطّاه، بس عنده عملاء قدامى عالقين معه
  absentCounselorsWithClientsWaiting: number
  clientsWaitingOnAbsentCounselor: number
  instantCloseCount: number
  leftOpenCount: number
}

export interface GetAdminNotificationsDeps {
  visitRepository: VisitRepository
  userRepository: UserRepository
  clock: Clock
}

// "أحمر" = فيه عميل قاعد ينتظر. البرتقالي عادات الفريق، تستاهل تتقال بس ما
// توقف أحد. الشريط النحيف بالداشبورد يبان بالأحمر فقط
export function redClientCount(view: AdminNotifications): number {
  return (
    view.unassignedClients +
    view.clientsWaitingOnQuietCounselor +
    view.clientsWaitingOnAbsentCounselor
  )
}

// عدد الأسطر الحمراء، مو عدد العملاء — هذا اللي يطلع على الجرس. العالقون
// لهم سطران: واحد بالعملاء وواحد بالمستشارين، عشان رقم الشريط النحيف يطلع
// من سطور تقدر تشوفها وتجمعها بنفسك
export function redItemCount(view: AdminNotifications): number {
  return [
    view.unassignedClients,
    view.clientsWaitingOnQuietCounselor,
    view.clientsWaitingOnAbsentCounselor,
    view.absentCounselorsWithClientsWaiting,
  ].filter((count) => count > 0).length
}

export async function getAdminNotifications(
  deps: GetAdminNotificationsDeps
): Promise<AdminNotifications> {
  const now = deps.clock.now()

  // student_status = 'waiting' يعني مفتوحة وما استُلمت بعد — بالضبط "عميل
  // قاعد ينتظر". وبدون أي نطاق تواريخ: عميل ينتظر من الأسبوع الماضي يهم أكثر
  const waiting = await deps.visitRepository.findAllByStudentStatus('waiting')
  const users = await deps.userRepository.findAll()
  const byId = new Map(users.map((user) => [user.id, user]))

  let unassignedClients = 0
  let clientsWaitingOnQuietCounselor = 0
  let clientsWaitingOnAbsentCounselor = 0
  const absentCounselorIds = new Set<string>()

  for (const visit of waiting) {
    const counselor = visit.counselorId === null ? null : byId.get(visit.counselorId)
    // سطل واحد لكل عميل، مو اثنين — هذا اللي يخلي الأرقام تجمع صح
    switch (waitingBucket(counselor, now)) {
      case 'unassigned':
        unassignedClients += 1
        break
      // حسابه انحذف، فما راح يسجّل دخول أبداً — عالق زي عالقي الغياب تمامًا،
      // وقبل كذا كان يسقط من كل العدّادات فما يشوفه أحد
      case 'unknownCounselor':
        clientsWaitingOnAbsentCounselor += 1
        break
      case 'absent':
        clientsWaitingOnAbsentCounselor += 1
        if (counselor) absentCounselorIds.add(visit.counselorId as string)
        break
      case 'quiet':
        clientsWaitingOnQuietCounselor += 1
        break
      case 'attended':
        break
    }
  }

  const startOfDay = startOfKuwaitDay(now)
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
  const closedToday = await deps.visitRepository.findClosedInRange(startOfDay, endOfDay)
  const { instantCloseCount, leftOpenCount } = computeHandlingStats(closedToday)

  return {
    unassignedClients,
    clientsWaitingOnQuietCounselor,
    absentCounselorsWithClientsWaiting: absentCounselorIds.size,
    clientsWaitingOnAbsentCounselor,
    instantCloseCount,
    leftOpenCount,
  }
}
