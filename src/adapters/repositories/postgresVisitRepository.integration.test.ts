// src/adapters/repositories/postgresVisitRepository.integration.test.ts
import { it, expect, beforeAll, afterAll } from 'vitest'
import { integrationDescribe } from '../../testing/integrationDescribe'
import { Pool } from 'pg'
import { createPostgresVisitRepository } from './postgresVisitRepository'
import { NAME_SEARCH_LIMIT } from '../../domain/text/searchPage'
import { createPostgresUserRepository } from './postgresUserRepository'
import { normalizeSearchText } from '../../domain/text/normalizeSearchText'
import { startOfKuwaitDay } from '../../domain/time/kuwaitTime'
import { computeHandlingStats } from '../../domain/time/computeHandlingStats'

const runIntegration = integrationDescribe

runIntegration('postgresVisitRepository (integration)', () => {
  let pool: Pool

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  })

  afterAll(async () => {
    await pool.end()
  })

  it('creates and reads back a visit', async () => {
    const users = createPostgresUserRepository(pool)
    const staff = await users.create({
      name: 'Test Staff',
      role: 'counselor',
      email: `staff-${Date.now()}@example.com`,
      passwordHash: 'x',
    })

    const visits = createPostgresVisitRepository(pool)
    const created = await visits.create({
      type: 'new',
      name: 'Demo Student One',
      phone: '56012345',
      desiredCountry: 'US',
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: staff.id,
    })

    const found = await visits.findById(created.id)
    expect(found?.name).toBe('Demo Student One')
  })

  // هالاستعلام يشتغل كل 5 ثواني بشاشة المستشار، فنتأكد إنه يحسب صح بقاعدة بيانات حقيقية —
  // الـ fake بالتستات ما يثبت إن الـ SQL نفسه سليم
  it('counts only visits picked up and closed today, by one shared rule', async () => {
    const users = createPostgresUserRepository(pool)
    const counselor = await users.create({
      name: 'Stats Counselor',
      role: 'counselor',
      email: `stats-${Date.now()}@example.com`,
      passwordHash: 'x',
    })
    const visits = createPostgresVisitRepository(pool)

    async function seed(pickedUpAt: Date | null, closedAt: Date | null) {
      const visit = await visits.create({
        type: 'new',
        name: 'Seed',
        phone: `5601${Math.floor(Math.random() * 10000)}`,
        desiredCountry: null,
        counselorId: counselor.id,
        linkedVisitId: null,
        requestedCounselorId: null,
        createdBy: null,
      })
      // status لازم يمشي مع closed_at — القيد الجديد يمنع أي زوج غير متطابق
      await pool.query(
        'UPDATE visits SET picked_up_at = $2, closed_at = $3, status = $4, student_status = $5 WHERE id = $1',
        [
          visit.id,
          pickedUpAt,
          closedAt,
          closedAt ? 'closed' : 'next',
          closedAt ? 'closed' : 'waiting',
        ]
      )
    }

    const now = new Date()
    const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)

    await seed(minutesAgo(70), minutesAgo(60)) // 10 min
    await seed(minutesAgo(50), minutesAgo(30)) // 20 min
    await seed(minutesAgo(40), minutesAgo(10)) // 30 min  -> average of the three = 20 min
    // انقفلت اليوم بلا استلام: ما تُحسب "خُدمت" — ما جلس معها أحد. الاستعلام
    // القديم بشاشة المستشار كان يعدّها، وشاشة الإشراف لا؛ وحّدناها على الثانية
    await seed(null, minutesAgo(5))
    await seed(daysAgo(5), daysAgo(5)) // an earlier day: excluded entirely
    await seed(minutesAgo(2), null) // still open: excluded entirely

    const startOfDay = startOfKuwaitDay(now)
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
    const closedToday = (await visits.findClosedInRange(startOfDay, endOfDay)).filter(
      (v) => v.counselorId === counselor.id
    )
    const stats = computeHandlingStats(closedToday)

    expect(stats.closedCount).toBe(3)
    // المتوسط يستثني أقل من دقيقتين وأكثر من ٨ ساعات — نفس قاعدة شاشة الإشراف
    expect(stats.avgHandlingMs).toBe(20 * 60 * 1000)
  })

  it('reports zero and no average when nothing was closed today', async () => {
    const users = createPostgresUserRepository(pool)
    const counselor = await users.create({
      name: 'Idle Counselor',
      role: 'counselor',
      email: `idle-${Date.now()}@example.com`,
      passwordHash: 'x',
    })
    const visits = createPostgresVisitRepository(pool)

    const now = new Date()
    const startOfDay = startOfKuwaitDay(now)
    const closedToday = (
      await visits.findClosedInRange(startOfDay, new Date(startOfDay.getTime() + 86400000))
    ).filter((v) => v.counselorId === counselor.id)
    const stats = computeHandlingStats(closedToday)

    expect(stats.closedCount).toBe(0)
    expect(stats.avgHandlingMs).toBeNull()
  })

  it('stores and finds a follow-up due date through markClosed and findAllByStudentStatus', async () => {
    const visits = createPostgresVisitRepository(pool)
    const created = await visits.create({
      type: 'new',
      name: 'Fictional Student R',
      phone: `5602${Math.floor(Math.random() * 10000)}`,
      desiredCountry: 'US',
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })
    await pool.query('UPDATE visits SET picked_up_at = now() WHERE id = $1', [created.id])

    const dueAt = new Date('2026-09-20T00:00:00.000Z')
    await visits.markClosed(created.id, new Date(), 'closed', 'follow_up_needed', null, dueAt)

    const found = await visits.findById(created.id)
    expect(found?.followUpDueAt).toEqual(dueAt)

    const pending = await visits.findAllByStudentStatus('follow_up_needed')
    expect(pending.some((v) => v.id === created.id)).toBe(true)
  })

  async function newVisit(visits: ReturnType<typeof createPostgresVisitRepository>) {
    return visits.create({
      type: 'visa',
      name: 'Pair Test',
      phone: `5603${Math.floor(Math.random() * 10000)}`,
      desiredCountry: null,
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })
  }

  it('changes the student status of a closed visit and clears the old due date', async () => {
    const visits = createPostgresVisitRepository(pool)
    const created = await newVisit(visits)
    await pool.query('UPDATE visits SET picked_up_at = now() WHERE id = $1', [created.id])
    await visits.markClosed(created.id, new Date(), 'closed', 'follow_up_needed', null, new Date())

    await visits.setStudentStatus(created.id, 'closed', null)

    const found = await visits.findById(created.id)
    expect(found?.studentStatus).toBe('closed')
    expect(found?.followUpDueAt).toBeNull()
  })

  it('does not touch an open visit when asked to set its student status', async () => {
    const visits = createPostgresVisitRepository(pool)
    const created = await newVisit(visits)

    await visits.setStudentStatus(created.id, 'follow_up_needed', new Date())

    const found = await visits.findById(created.id)
    expect(found?.status).toBe('next')
    expect(found?.studentStatus).toBe('waiting')
    expect(found?.followUpDueAt).toBeNull()
  })

  it('refuses a contradictory status pair at the database level', async () => {
    const visits = createPostgresVisitRepository(pool)
    const created = await newVisit(visits)
    await pool.query('UPDATE visits SET picked_up_at = now() WHERE id = $1', [created.id])
    await visits.markClosed(created.id, new Date(), 'closed', 'closed', null, null)

    for (const badStatus of ['in_session', 'waiting']) {
      await expect(
        pool.query('UPDATE visits SET student_status = $2 WHERE id = $1', [created.id, badStatus])
      ).rejects.toThrow(/visits_status_pair_check/)
    }

    const open = await newVisit(visits)
    await expect(
      pool.query("UPDATE visits SET student_status = 'closed' WHERE id = $1", [open.id])
    ).rejects.toThrow(/visits_status_pair_check/)
  })

  it('accepts every real flow: create, pick up, finish as closed, finish as follow-up', async () => {
    const visits = createPostgresVisitRepository(pool)
    const created = await newVisit(visits)
    await visits.markPickedUp(created.id, new Date())
    expect((await visits.findById(created.id))?.studentStatus).toBe('in_session')

    await visits.markClosed(created.id, new Date(), 'closed', 'closed', null, null)
    const closed = await visits.findById(created.id)
    expect(closed?.status).toBe('closed')
    expect(closed?.closedAt).not.toBeNull()

    const other = await newVisit(visits)
    await visits.markPickedUp(other.id, new Date())
    await visits.markClosed(other.id, new Date(), 'closed', 'follow_up_needed', null, new Date())
    const followUp = await visits.findById(other.id)
    expect(followUp?.studentStatus).toBe('follow_up_needed')
    expect(followUp?.closedAt).not.toBeNull()
  })

  it('reassigning a closed visit changes only the counselor, not either status', async () => {
    const visits = createPostgresVisitRepository(pool)
    const users = createPostgresUserRepository(pool)
    const counselor = await users.create({
      name: 'Reassign Target',
      role: 'counselor',
      email: `reassign-${Date.now()}@example.com`,
      passwordHash: 'x',
    })
    const created = await newVisit(visits)
    await pool.query('UPDATE visits SET picked_up_at = now() WHERE id = $1', [created.id])
    await visits.markClosed(created.id, new Date(), 'closed', 'closed', null, null)

    await visits.updateCounselor(created.id, counselor.id)

    const found = await visits.findById(created.id)
    expect(found?.counselorId).toBe(counselor.id)
    expect(found?.status).toBe('closed')
    expect(found?.studentStatus).toBe('closed')
  })

  // توحيد الحروف مكتوب مرتين: بالـTypeScript للنص المكتوب، وبالـSQL للاسم
  // المخزّن. هالتستات تثبت إن الاثنين يعطون نفس النتيجة
  it('finds an Arabic name however each side was written', async () => {
    const visits = createPostgresVisitRepository(pool)
    const stamp = Date.now()
    const stored = [`أحمد ${stamp}`, `احمد ${stamp}`, `فاطمة ${stamp}`, `يحيى ${stamp}`]
    for (const name of stored) {
      await visits.create({
        type: 'new',
        name,
        phone: `5604${Math.floor(Math.random() * 10000)}`,
        desiredCountry: null,
        counselorId: null,
        linkedVisitId: null,
        requestedCounselorId: null,
        createdBy: null,
      })
    }

    const found = async (term: string) =>
      (await visits.findAllMatchingName(normalizeSearchText(term))).map((v) => v.name)

    // أ و ا يتطابقون بالاتجاهين
    expect(await found(`أحمد ${stamp}`)).toEqual(
      expect.arrayContaining([`أحمد ${stamp}`, `احمد ${stamp}`])
    )
    expect(await found(`احمد ${stamp}`)).toEqual(
      expect.arrayContaining([`أحمد ${stamp}`, `احمد ${stamp}`])
    )
    expect(await found(`فاطمه ${stamp}`)).toEqual([`فاطمة ${stamp}`])
    expect(await found(`يحيي ${stamp}`)).toEqual([`يحيى ${stamp}`])
    // التشكيل بالنص المكتوب ما يمنع المطابقة
    expect(await found(`أَحْمَد ${stamp}`)).toHaveLength(2)
  })

  it('matches part of a name, and does not match a different one', async () => {
    const visits = createPostgresVisitRepository(pool)
    const stamp = Date.now()
    await visits.create({
      type: 'new',
      name: `Sample Client ${stamp}`,
      phone: `5605${Math.floor(Math.random() * 10000)}`,
      desiredCountry: null,
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })

    expect(await visits.findAllMatchingName(normalizeSearchText('SAMPLE'))).not.toHaveLength(0)
    expect(await visits.findAllMatchingName(normalizeSearchText(`nobody ${stamp}`))).toHaveLength(0)
  })

  it('counts every visit for the all-time total', async () => {
    const visits = createPostgresVisitRepository(pool)
    const before = await visits.countAll()
    await newVisit(visits)
    expect(await visits.countAll()).toBe(before + 1)
  })

  it('refuses a visit that carries a closed timestamp while still open', async () => {
    const visits = createPostgresVisitRepository(pool)
    const created = await newVisit(visits)

    // هذا بالضبط اللي كان ينتج من الإنهاء بـ"بالانتظار"
    await expect(
      pool.query('UPDATE visits SET closed_at = now() WHERE id = $1', [created.id])
    ).rejects.toThrow(/visits_closed_at_matches_status_check/)

    // والعكس: مقفولة بلا وقت إغلاق
    await pool.query('UPDATE visits SET picked_up_at = now() WHERE id = $1', [created.id])
    await visits.markClosed(created.id, new Date(), 'closed', 'closed', null, null)
    await expect(
      pool.query('UPDATE visits SET closed_at = NULL WHERE id = $1', [created.id])
    ).rejects.toThrow(/visits_closed_at_matches_status_check/)
  })

  // البق: % بخانة البحث كانت تطابق كل صف بالجدول، وكل صف يفك تشفير رقم هاتف.
  // ما يحتاج مهاجم — موظف فضولي يكتب % ويطلّع أرقام كل العملاء برد واحد
  it('treats a percent sign as text, not as "every row"', async () => {
    const visits = createPostgresVisitRepository(pool)
    const stamp = Date.now()
    await visits.create({
      type: 'new',
      name: `Wildcard Probe ${stamp}`,
      phone: `5606${Math.floor(Math.random() * 10000)}`,
      desiredCountry: null,
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })

    const everything = await visits.countAll()
    expect(everything).toBeGreaterThan(0)

    // القاعدة: البحث عن % يرجّع الأسماء اللي فيها علامة نسبة حقيقية فقط —
    // مو كل الجدول. نتحقق بالمعنى لا بالعدد، لأن بيانات الاختبار تتراكم
    const percentMatches = await visits.findAllMatchingName(normalizeSearchText('%'))
    expect(percentMatches.length).toBeLessThan(everything)
    for (const visit of percentMatches) expect(visit.name).toContain('%')

    // ما فيه اسم فيه ثلاث علامات متتالية، فالنتيجة صفر
    expect(await visits.findAllMatchingName(normalizeSearchText('%%%'))).toHaveLength(0)
  })

  it('treats an underscore as text, not as "any character"', async () => {
    const visits = createPostgresVisitRepository(pool)
    const everything = await visits.countAll()

    // _ بـ LIKE تطابق أي حرف واحد، فبدون تهريب تطابق كل اسم فيه حرف واحد فأكثر
    const underscoreMatches = await visits.findAllMatchingName(normalizeSearchText('_'))
    expect(underscoreMatches.length).toBeLessThan(everything)
    for (const visit of underscoreMatches) expect(visit.name).toContain('_')
  })

  it('still finds a name that genuinely contains a percent sign', async () => {
    const visits = createPostgresVisitRepository(pool)
    const stamp = Date.now()
    await visits.create({
      type: 'new',
      name: `Discount 50% Client ${stamp}`,
      phone: `5607${Math.floor(Math.random() * 10000)}`,
      desiredCountry: null,
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })

    const found = await visits.findAllMatchingName(normalizeSearchText('50%'))
    expect(found.map((v) => v.name)).toContain(`Discount 50% Client ${stamp}`)
  })

  // سقف الصفوف: بحث واسع ما يسحب الجدول كامل ويفك تشفير كل رقم فيه
  it('never returns more rows than the search ceiling', async () => {
    const visits = createPostgresVisitRepository(pool)
    const found = await visits.findAllMatchingName(normalizeSearchText(''))
    expect(found.length).toBeLessThanOrEqual(NAME_SEARCH_LIMIT)
  })

  // الأرقام مشفّرة والمطابقة ببصمة، فـ ANY($1) لازم يتحقق على قاعدة حقيقية:
  // لو البصمات ما تولّدت صح، الاستعلام يرجّع صفر بصمت والتصدير يطلع فاضي
  it('finds several clients by phone in one query', async () => {
    const visits = createPostgresVisitRepository(pool)
    const stamp = Date.now()
    const phoneA = `5610${String(stamp).slice(-4)}`
    const phoneB = `5611${String(stamp).slice(-4)}`

    for (const [name, phone] of [
      [`Bulk A ${stamp}`, phoneA],
      [`Bulk B ${stamp}`, phoneB],
    ]) {
      await visits.create({
        type: 'new',
        name,
        phone,
        desiredCountry: null,
        counselorId: null,
        linkedVisitId: null,
        requestedCounselorId: null,
        createdBy: null,
      })
    }

    const found = await visits.findAllByPhones([phoneA, phoneB])
    const names = found.map((v) => v.name)
    expect(names).toContain(`Bulk A ${stamp}`)
    expect(names).toContain(`Bulk B ${stamp}`)
  })

  it('returns the same rows in bulk as one call per phone would', async () => {
    const visits = createPostgresVisitRepository(pool)
    const stamp = Date.now()
    const phone = `5612${String(stamp).slice(-4)}`
    await visits.create({
      type: 'new',
      name: `Bulk parity ${stamp}`,
      phone,
      desiredCountry: null,
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })

    const singly = await visits.findAllByPhone(phone)
    const bulk = await visits.findAllByPhones([phone])
    expect(bulk.map((v) => v.id)).toEqual(singly.map((v) => v.id))
  })

  it('asks for nothing when given no phones', async () => {
    const visits = createPostgresVisitRepository(pool)
    expect(await visits.findAllByPhones([])).toEqual([])
  })

  // وقت التعيين و"جاء إلى" — عمودان أُضيفا ٢٤ سبتمبر. الـSQL يقرر متى يتعبّون
  // ومتى يرجعون فاضيين، والمزيّف ما يثبت هذا
  it('stamps an assigned time when a visit arrives with a counselor, and none without', async () => {
    const users = createPostgresUserRepository(pool)
    const counselor = await users.create({
      name: 'Assign Stamp',
      role: 'counselor',
      email: `assign-stamp-${Date.now()}@example.com`,
      passwordHash: 'x',
    })
    const visits = createPostgresVisitRepository(pool)
    const before = Date.now() - 5000
    const assigned = await visits.create({
      type: 'new',
      name: 'Sample Client',
      phone: '50000011',
      desiredCountry: 'USA',
      counselorId: counselor.id,
      requestedCounselorId: null,
      linkedVisitId: null,
      createdBy: null,
    })
    const unassigned = await visits.create({
      type: 'new',
      name: 'Sample Client',
      phone: '50000012',
      desiredCountry: 'USA',
      counselorId: null,
      requestedCounselorId: null,
      linkedVisitId: null,
      createdBy: null,
    })
    expect(assigned.assignedAt).toBeInstanceOf(Date)
    expect(assigned.assignedAt!.getTime()).toBeGreaterThan(before)
    expect(unassigned.assignedAt).toBeNull()
  })

  it('moves the assigned time on reassign, and clears it on unassign (the ✕)', async () => {
    const users = createPostgresUserRepository(pool)
    const counselor = await users.create({
      name: 'Assign Move',
      role: 'counselor',
      email: `assign-move-${Date.now()}@example.com`,
      passwordHash: 'x',
    })
    const visits = createPostgresVisitRepository(pool)
    const visit = await visits.create({
      type: 'new',
      name: 'Sample Client',
      phone: '50000013',
      desiredCountry: 'USA',
      counselorId: null,
      requestedCounselorId: null,
      linkedVisitId: null,
      createdBy: null,
    })
    await pool.query(`UPDATE visits SET assigned_at = '2026-01-01T00:00:00Z' WHERE id = $1`, [
      visit.id,
    ])

    await visits.updateCounselor(visit.id, counselor.id)
    const reassigned = await visits.findById(visit.id)
    expect(reassigned!.assignedAt!.getTime()).toBeGreaterThan(new Date('2026-06-01').getTime())

    await visits.updateCounselor(visit.id, null)
    const cleared = await visits.findById(visit.id)
    expect(cleared!.counselorId).toBeNull()
    expect(cleared!.assignedAt).toBeNull()
  })

  it('keeps who a follow-up came to after a supervisor reassigns it', async () => {
    const users = createPostgresUserRepository(pool)
    const chosen = await users.create({
      name: 'Came To',
      role: 'counselor',
      email: `came-to-${Date.now()}@example.com`,
      passwordHash: 'x',
    })
    const other = await users.create({
      name: 'Moved To',
      role: 'counselor',
      email: `moved-to-${Date.now()}@example.com`,
      passwordHash: 'x',
    })
    const visits = createPostgresVisitRepository(pool)
    const visit = await visits.create({
      type: 'follow_up',
      name: 'Sample Client',
      phone: '50000014',
      desiredCountry: null,
      counselorId: chosen.id,
      requestedCounselorId: chosen.id,
      linkedVisitId: null,
      createdBy: null,
    })
    await visits.updateCounselor(visit.id, other.id)
    const after = await visits.findById(visit.id)
    expect(after!.counselorId).toBe(other.id)
    expect(after!.requestedCounselorId).toBe(chosen.id)
  })
})
