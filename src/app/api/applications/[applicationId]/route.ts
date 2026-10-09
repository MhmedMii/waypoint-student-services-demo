import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../infrastructure/auth/requireRole'
import { deleteApplication } from '../../../../application/useCases/deleteApplication'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../adapters/repositories/postgresApplicationRepository'
import { logActivity } from '../../../../infrastructure/activity/logActivity'
import { translations } from '../../../../i18n/translations'

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ applicationId: string }> }
) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const role = session!.user!.role
  const applicationRepository = createPostgresApplicationRepository(pool)
  const application = await applicationRepository.findById(params.applicationId)

  const result = await deleteApplication(role, params.applicationId, { applicationRepository })
  if (result.ok) {
    await logActivity(
      pool,
      session!,
      'application_deleted',
      'application',
      params.applicationId,
      application ? `Deleted ${application.kind} application for ${application.name}` : null,
      application
        ? `تم حذف طلب ${
            application.kind === 'visa'
              ? translations.ar.apply.visaTab
              : translations.ar.apply.examTab
          } لـ ${application.name}`
        : null
    )
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 403 })
}
