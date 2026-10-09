import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresActivityLogRepository } from '../../../../../adapters/repositories/postgresActivityLogRepository'
import { exportActivityLogToExcel } from '../../../../../application/useCases/exportActivityLogToExcel'
import { kuwaitDayKey } from '../../../../../domain/time/kuwaitTime'
import { activityRangeStart, activityRangeFileLabel } from '../activityRange'

// بدون سقف، عن قصد. كان هنا "آخر ٢٠٠" بغض النظر عن الفترة، والملف ما يقول —
// سجل مقصوص شكله كامل. التصديرات الثانية (الزيارات، الطلبات، الطلاب) بدون سقف
// أصلاً. قسناه: ~37 بايت للحدث (٢٠٬٠٠٠ حدث = ~715KB)، والحد الحقيقي هو سقف
// Vercel للرد ٤٫٥MB، يعني تقريبًا ١٠٠٬٠٠٠ حدث. لو قربنا منه، الحل تصدير
// من/إلى مثل الزيارات — مو سقف صامت يرجع
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['admin', 'super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const language = request.nextUrl.searchParams.get('lang') === 'ar' ? 'ar' : 'en'
  const daysParam = request.nextUrl.searchParams.get('days')
  const now = new Date()
  const logs = await createPostgresActivityLogRepository(pool).findAllInRange(
    activityRangeStart(daysParam, now)
  )
  const buffer = await exportActivityLogToExcel(logs, language)
  const filename = `activity-log-${activityRangeFileLabel(daysParam)}-${kuwaitDayKey(now)}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
