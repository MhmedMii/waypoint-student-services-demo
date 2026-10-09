import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../infrastructure/auth/authOptions'
import { requireScope } from '../../../../infrastructure/auth/requireScope'
import { exportApplicationsToExcel } from '../../../../application/useCases/exportApplicationsToExcel'
import { pool } from '../../../../infrastructure/db/pool'
import { createPostgresApplicationRepository } from '../../../../adapters/repositories/postgresApplicationRepository'
import type { ApplicationKind } from '../../../../domain/entities/application'
import type { SpecializationScope } from '../../../../domain/entities/counselor'
import { scopeForApplicationKind } from '../../../../domain/access/applicationScope'

export async function GET(request: NextRequest) {
  const rawKind = request.nextUrl.searchParams.get('kind')
  const scope = scopeForApplicationKind(rawKind)
  if (!scope) return NextResponse.json({ ok: false }, { status: 400 })
  const kind = rawKind as ApplicationKind

  const session = await getServerSession(authOptions)
  const access = requireScope(session, scope)
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const role = session!.user!.role
  const scopes = session!.user!.scopes ?? []
  const language = request.nextUrl.searchParams.get('lang') === 'ar' ? 'ar' : 'en'
  const applicationRepository = createPostgresApplicationRepository(pool)
  const applications = await applicationRepository.findAllByKind(kind)

  const result = await exportApplicationsToExcel(role, scopes, kind, applications, language)
  if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason }, { status: 403 })

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${kind}-applications.xlsx"`,
    },
  })
}
