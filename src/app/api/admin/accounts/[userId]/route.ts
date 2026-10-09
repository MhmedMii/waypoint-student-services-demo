import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../infrastructure/auth/authOptions'
import { requireRole } from '../../../../../infrastructure/auth/requireRole'
import { deactivateAccount } from '../../../../../application/useCases/deactivateAccount'
import { reactivateAccount } from '../../../../../application/useCases/reactivateAccount'
import { resetPassword } from '../../../../../application/useCases/resetPassword'
import { deleteAccount } from '../../../../../application/useCases/deleteAccount'
import { promoteToSuperAdmin } from '../../../../../application/useCases/promoteToSuperAdmin'
import { downgradeSuperAdmin } from '../../../../../application/useCases/downgradeSuperAdmin'
import { pool } from '../../../../../infrastructure/db/pool'
import { createPostgresUserRepository } from '../../../../../adapters/repositories/postgresUserRepository'
import { createPostgresSpecializationRepository } from '../../../../../adapters/repositories/postgresSpecializationRepository'
import { validateSpecializationScopes } from '../../../../../domain/validation/validateSpecializationScopes'
import { validateShiftInfo } from '../../../../../domain/validation/validateShiftInfo'
import { validateNote } from '../../../../../domain/validation/validateNote'
import { validateNameAr } from '../../../../../domain/validation/validateNameAr'
import { logActivity } from '../../../../../infrastructure/activity/logActivity'
import { translations } from '../../../../../i18n/translations'

export async function GET(_request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const specializationRepository = createPostgresSpecializationRepository(pool)
  const scopes = await specializationRepository.findScopesForCounselor(params.userId)
  return NextResponse.json({ scopes })
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await request.json()
  const role = session!.user!.role
  const userRepository = createPostgresUserRepository(pool)
  const target = await userRepository.findById(params.userId)

  if (body.action === 'updateScopes') {
    const validation = validateSpecializationScopes(body.scopes)
    if (!validation.isValid)
      return NextResponse.json({ ok: false, reason: validation.reason }, { status: 400 })
    const specializationRepository = createPostgresSpecializationRepository(pool)
    await specializationRepository.setScopes(params.userId, body.scopes)
    const scopesDetails = target
      ? `Updated specialization scopes for ${target.name}: ${body.scopes.join(', ')}`
      : null
    const scopesDetailsAr = target
      ? `تم تحديث نطاقات التخصص لـ ${target.name}: ${body.scopes
          .map((s: 'visa_services' | 'exam_services') => translations.ar.scopes[s])
          .join('، ')}`
      : null
    await logActivity(
      pool,
      session!,
      'account_scopes_updated',
      'account',
      params.userId,
      scopesDetails,
      scopesDetailsAr
    )
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'updateShift') {
    const validation = validateShiftInfo(body.shift, body.floor)
    if (!validation.isValid)
      return NextResponse.json({ ok: false, reason: validation.reason }, { status: 400 })
    await userRepository.setShiftInfo(params.userId, body.shift, body.floor)
    const shiftDetails = target
      ? body.shift
        ? `Updated shift for ${target.name}: ${body.shift} · ${body.floor}`
        : `Cleared shift for ${target.name}`
      : null
    const shiftDetailsAr = target
      ? body.shift
        ? `تم تحديث الدوام لـ ${target.name}: ${body.shift} · ${body.floor}`
        : `تم حذف الدوام لـ ${target.name}`
      : null
    await logActivity(
      pool,
      session!,
      'account_shift_updated',
      'account',
      params.userId,
      shiftDetails,
      shiftDetailsAr
    )
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'updateNote') {
    const noteValidation = validateNote(body.note)
    if (!noteValidation.isValid)
      return NextResponse.json({ ok: false, reason: noteValidation.reason }, { status: 400 })
    const trimmedNote = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null
    await userRepository.setNote(params.userId, trimmedNote)
    const noteDetails = target
      ? trimmedNote
        ? `Updated internal note for ${target.name}`
        : `Cleared internal note for ${target.name}`
      : null
    const noteDetailsAr = target
      ? trimmedNote
        ? `تم تحديث الملاحظة الداخلية لـ ${target.name}`
        : `تم حذف الملاحظة الداخلية لـ ${target.name}`
      : null
    await logActivity(
      pool,
      session!,
      'account_note_updated',
      'account',
      params.userId,
      noteDetails,
      noteDetailsAr
    )
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'updateNameAr') {
    const nameArValidation = validateNameAr(body.nameAr)
    if (!nameArValidation.isValid)
      return NextResponse.json({ ok: false, reason: nameArValidation.reason }, { status: 400 })
    const trimmedNameAr =
      typeof body.nameAr === 'string' && body.nameAr.trim() ? body.nameAr.trim() : null
    await userRepository.setNameAr(params.userId, trimmedNameAr)
    const nameArDetails = target
      ? trimmedNameAr
        ? `Updated Arabic name for ${target.name}`
        : `Cleared Arabic name for ${target.name}`
      : null
    const nameArDetailsAr = target
      ? trimmedNameAr
        ? `تم تحديث الاسم العربي لـ ${target.name}`
        : `تم حذف الاسم العربي لـ ${target.name}`
      : null
    await logActivity(
      pool,
      session!,
      'account_name_ar_updated',
      'account',
      params.userId,
      nameArDetails,
      nameArDetailsAr
    )
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'promote') {
    const result = await promoteToSuperAdmin(role, params.userId, { userRepository })
    if (result.ok && target)
      await logActivity(
        pool,
        session!,
        'account_promoted',
        'account',
        params.userId,
        `Promoted ${target.name} (${target.email}) from admin to super_admin`,
        `تمت ترقية ${target.name} (${target.email}) من ${translations.ar.nav.admin} إلى ${translations.ar.nav.super_admin}`
      )
    return NextResponse.json(result, { status: result.ok ? 200 : 403 })
  }

  if (body.action === 'downgrade') {
    const actorId = session!.user!.id
    const result = await downgradeSuperAdmin(role, actorId, params.userId, { userRepository })
    if (result.ok && target)
      await logActivity(
        pool,
        session!,
        'account_downgraded',
        'account',
        params.userId,
        `Downgraded ${target.name} (${target.email}) from super_admin to admin`,
        `تم تنزيل رتبة ${target.name} (${target.email}) من ${translations.ar.nav.super_admin} إلى ${translations.ar.nav.admin}`
      )
    return NextResponse.json(result, { status: result.ok ? 200 : 403 })
  }

  const action =
    body.action === 'deactivate'
      ? 'account_deactivated'
      : body.action === 'reactivate'
        ? 'account_reactivated'
        : 'account_password_reset'

  const result =
    body.action === 'deactivate'
      ? await deactivateAccount(role, session!.user!.id, params.userId, { userRepository })
      : body.action === 'reactivate'
        ? await reactivateAccount(role, params.userId, { userRepository })
        : await resetPassword(role, session!.user!.id, params.userId, body.newPassword, {
            userRepository,
          })

  const actionDetails = target
    ? body.action === 'deactivate'
      ? `Deactivated ${target.name} (${target.email})`
      : body.action === 'reactivate'
        ? `Reactivated ${target.name} (${target.email})`
        : `Reset password for ${target.name} (${target.email})`
    : null

  const actionDetailsAr = target
    ? body.action === 'deactivate'
      ? `تم تعطيل حساب ${target.name} (${target.email})`
      : body.action === 'reactivate'
        ? `تم إعادة تفعيل حساب ${target.name} (${target.email})`
        : `تمت إعادة تعيين كلمة المرور لـ ${target.name} (${target.email})`
    : null

  if (result.ok)
    await logActivity(
      pool,
      session!,
      action,
      'account',
      params.userId,
      actionDetails,
      actionDetailsAr
    )
  return NextResponse.json(result, { status: result.ok ? 200 : 403 })
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = requireRole(session, ['super_admin'])
  if (!access.ok) return NextResponse.json({ ok: false }, { status: 401 })

  const role = session!.user!.role
  const userRepository = createPostgresUserRepository(pool)
  const target = await userRepository.findById(params.userId)

  try {
    const result = await deleteAccount(role, session!.user!.id, params.userId, { userRepository })
    if (result.ok) {
      await logActivity(
        pool,
        session!,
        'account_deleted',
        'account',
        params.userId,
        target ? `Deleted ${target.role} account: ${target.name} (${target.email})` : null,
        target
          ? `تم حذف حساب ${translations.ar.nav[target.role]}: ${target.name} (${target.email})`
          : null
      )
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 403 })
  } catch (error: any) {
    // انتهاك مفتاح أجنبي (23503) معناه الحساب مرتبط بزيارات/سجلات موجودة —
    // نرفض الحذف بدل ما نكسر تاريخ البيانات
    if (error?.code === '23503') {
      return NextResponse.json({ ok: false, reason: 'accountLinkedToVisits' }, { status: 409 })
    }
    throw error
  }
}
