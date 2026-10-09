import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { getCounselorAssignedVisits } from '../../../../../application/useCases/getCounselorAssignedVisits'
import { getCounselorAssignedApplications } from '../../../../../application/useCases/getCounselorAssignedApplications'
import { exportMyStudentsToExcel } from '../../../../../application/useCases/exportMyStudentsToExcel'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresVisitRepository } from '../../../../../adapters/repositories/postgresVisitRepository'
import { createPostgresApplicationRepository } from '../../../../../adapters/repositories/postgresApplicationRepository'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['counselor'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const language = request.nextUrl.searchParams.get('lang') === 'ar' ? 'ar' : 'en'
  const counselorId = session!.user!.id
  const [visits, applications] = await Promise.all([
    getCounselorAssignedVisits(counselorId, {
      visitRepository: createPostgresVisitRepository(pool),
    }),
    getCounselorAssignedApplications(counselorId, {
      applicationRepository: createPostgresApplicationRepository(pool),
    }),
  ])

  const buffer = await exportMyStudentsToExcel(visits, applications, language)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="my-students.xlsx"',
    },
  })
}
