import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { validateDateQueryParam } from '../../../../domain/validation/validateDateQueryParam'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../adapters/repositories/postgresVisitRepository'
import { isPhoneSearch, normalizeSearchText } from '../../../../domain/text/normalizeSearchText'
import { takeSearchPage, SEARCH_TRUNCATED_HEADER } from '../../../../domain/text/searchPage'
import { createPostgresUserRepository } from '../../../../adapters/repositories/postgresUserRepository'
import { withCounselorNames } from '../../../../application/naming/withCounselorNames'
import { isWaitingBucket, waitingBucket } from '../../../../domain/routing/waitingBucket'
import { systemClock } from '../../../../infrastructure/db/systemClock'

const DEFAULT_RANGE_DAYS_MS = 7 * 86400000

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const visitRepository = createPostgresVisitRepository(pool)
  const userRepository = createPostgresUserRepository(pool)

  // ?waiting=<سطل> يجي من لوحة الإشعارات. بدون تواريخ عمدًا: الجرس يعدّ كل
  // اللي ينتظرون مهما كان تاريخهم، فلو فلترنا بآخر ٧ أيام يضغط المشرف على
  // "٧٨ عميل" ويلقى عشرة — نفس مشكلة الحد المخفي بمكان جديد
  const waitingParam = request.nextUrl.searchParams.get('waiting')
  if (waitingParam) {
    if (!isWaitingBucket(waitingParam)) {
      return NextResponse.json({ ok: false, reason: 'unknownWaitingFilter' }, { status: 400 })
    }
    const waiting = await visitRepository.findAllByStudentStatus('waiting')
    const users = await userRepository.findAll()
    const byId = new Map(users.map((user) => [user.id, user]))
    const matching = waiting.filter((visit) => {
      const counselor = visit.counselorId === null ? null : byId.get(visit.counselorId)
      return waitingBucket(counselor, systemClock.now()) === waitingParam
    })
    return NextResponse.json(await withCounselorNames(matching, userRepository, systemClock))
  }

  // البحث يتجاهل التواريخ عمدًا — هو الطريقة الوحيدة للوصول لزيارة قديمة
  const searchTerm = request.nextUrl.searchParams.get('q')?.trim()
  if (searchTerm) {
    const normalized = normalizeSearchText(searchTerm)
    const matches = isPhoneSearch(searchTerm)
      ? await visitRepository.findAllByPhone(normalized)
      : await visitRepository.findAllMatchingName(normalized)
    // القطع لازم يبان: بدون الهيدر تظن الموظفة إن اللي ما ظهر مو موجود
    const page = takeSearchPage(matches)
    return NextResponse.json(await withCounselorNames(page.rows, userRepository, systemClock), {
      headers: page.truncated ? { [SEARCH_TRUNCATED_HEADER]: 'true' } : undefined,
    })
  }

  const fromResult = validateDateQueryParam(
    request.nextUrl.searchParams.get('from'),
    new Date(Date.now() - DEFAULT_RANGE_DAYS_MS)
  )
  if (!fromResult.isValid)
    return NextResponse.json({ ok: false, reason: fromResult.reason }, { status: 400 })

  const toResult = validateDateQueryParam(request.nextUrl.searchParams.get('to'), new Date())
  if (!toResult.isValid)
    return NextResponse.json({ ok: false, reason: toResult.reason }, { status: 400 })

  const visits = await visitRepository.findAllInRange(fromResult.date, toResult.date)
  return NextResponse.json(await withCounselorNames(visits, userRepository, systemClock))
}
