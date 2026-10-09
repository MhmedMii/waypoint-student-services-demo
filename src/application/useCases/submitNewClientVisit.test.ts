import { describe, it, expect } from 'vitest'
import { submitNewClientVisit } from './submitNewClientVisit'
import {
  createFakeVisitRepository,
  createFakeSpecializationRepository,
  createFixedClock,
} from '../testing/fakes'
import type { CounselorCandidate } from '../../domain/entities/counselor'

// تسجيل الدخول ما يأثر على التوزيع. نعطي المرشحين ظهورًا بس عشان أعلام
// "انعطى وهو غايب" (للسجل) تطلع false بالتستات اللي ما تخصها
const SEEN_TODAY = new Date('2026-08-12T08:00:00Z')

const candidates: CounselorCandidate[] = [
  {
    id: 'demoCounselorOne',
    scopes: ['USA', 'UK & Ireland'],
    lastAssignedAt: new Date('2026-08-12T08:00:00Z'),
    lastSeenAt: SEEN_TODAY,
  },
  {
    id: 'ali-mahmoud',
    scopes: ['GCC'],
    lastAssignedAt: new Date('2026-08-12T08:00:00Z'),
    lastSeenAt: SEEN_TODAY,
  },
]

function makeDeps() {
  return {
    visitRepository: createFakeVisitRepository(),
    specializationRepository: createFakeSpecializationRepository(candidates),
    clock: createFixedClock(new Date('2026-08-12T12:00:00Z')),
  }
}

describe('submitNewClientVisit', () => {
  it('creates a visit and auto-assigns a matching counselor', async () => {
    const result = await submitNewClientVisit(
      { name: 'Demo Student One', phone: '56012345', desiredCountry: 'USA', createdBy: 'staff-1' },
      makeDeps()
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.type).toBe('new')
      expect(result.visit.counselorId).toBe('demoCounselorOne')
    }
  })

  it('leaves counselorId null when no candidate matches the tier', async () => {
    const deps = makeDeps()
    deps.specializationRepository = createFakeSpecializationRepository([])
    const result = await submitNewClientVisit(
      { name: 'Demo Student One', phone: '56012345', desiredCountry: 'USA', createdBy: 'staff-1' },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.counselorId).toBeNull()
  })

  it('rejects an invalid name without creating a visit', async () => {
    const deps = makeDeps()
    const result = await submitNewClientVisit(
      { name: 'Ahmad', phone: '56012345', desiredCountry: 'USA', createdBy: 'staff-1' },
      deps
    )
    expect(result.ok).toBe(false)
    expect(await deps.visitRepository.findMostRecentByPhone('56012345')).toBeNull()
  })

  it('rejects an invalid phone number', async () => {
    const result = await submitNewClientVisit(
      { name: 'Demo Student One', phone: '712345', desiredCountry: 'USA', createdBy: 'staff-1' },
      makeDeps()
    )
    expect(result.ok).toBe(false)
  })

  it('sticks a returning phone number to the counselor from their last visit', async () => {
    const visitRepository = createFakeVisitRepository()
    const deps = {
      visitRepository,
      specializationRepository: createFakeSpecializationRepository(candidates),
      clock: createFixedClock(new Date('2026-08-12T12:00:00Z')),
    }
    const priorVisit = await visitRepository.create({
      type: 'new',
      name: 'Demo Student One',
      phone: '56012345',
      desiredCountry: 'GCC',
      counselorId: 'ali-mahmoud',
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: 'staff-1',
    })
    // لازم الزيارة السابقة تكون مغلقة — عميل راجع، مو نفس الزيارة لسا مفتوحة
    // (تلك حالة التكرار المحظورة، بموضوع ثاني كليًا)
    await visitRepository.markClosed(priorVisit.id, new Date(), 'closed', 'closed')

    const result = await submitNewClientVisit(
      { name: 'Demo Student One', phone: '56012345', desiredCountry: 'USA', createdBy: 'staff-1' },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.counselorId).toBe('ali-mahmoud')
  })

  it('falls back to normal rotation when the sticky counselor is no longer visible', async () => {
    const visitRepository = createFakeVisitRepository()
    const nightAli: CounselorCandidate = {
      id: 'ali-mahmoud',
      scopes: ['GCC'],
      lastAssignedAt: null,
      lastSeenAt: SEEN_TODAY,
      shift: 'night',
    }
    const deps = {
      visitRepository,
      specializationRepository: createFakeSpecializationRepository([
        ...candidates.filter((c) => c.id !== 'ali-mahmoud'),
        nightAli,
      ]),
      clock: createFixedClock(new Date('2026-08-12T03:00:00Z')), // 6am Kuwait, night shift not visible
    }
    const priorVisit = await visitRepository.create({
      type: 'new',
      name: 'Demo Student One',
      phone: '56012345',
      desiredCountry: 'GCC',
      counselorId: 'ali-mahmoud',
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: 'staff-1',
    })
    await visitRepository.markClosed(priorVisit.id, new Date(), 'closed', 'closed')

    const result = await submitNewClientVisit(
      { name: 'Demo Student One', phone: '56012345', desiredCountry: 'USA', createdBy: 'staff-1' },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.counselorId).toBe('demoCounselorOne')
  })

  // القاعدة: الحاضر بشفته أولاً، وإلا الاحتياط — ولو كان خارج شفته. الشفت
  // يحدد مين يظهر بالدروب داون للاستقبال، ما يحدد مين يستحق عميل بلا صاحب
  it('falls back to a night-shift counselor rather than leaving the client with nobody', async () => {
    const nightDemoCounselorOne: CounselorCandidate = {
      id: 'demoCounselorOne',
      scopes: ['USA', 'UK & Ireland'],
      lastAssignedAt: null,
      lastSeenAt: SEEN_TODAY,
      shift: 'night',
    }
    const deps = {
      visitRepository: createFakeVisitRepository(),
      specializationRepository: createFakeSpecializationRepository([nightDemoCounselorOne]),
      clock: createFixedClock(new Date('2026-08-12T03:00:00Z')), // 6am Kuwait
    }
    const result = await submitNewClientVisit(
      { name: 'Demo Student One', phone: '56012345', desiredCountry: 'USA', createdBy: 'staff-1' },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.counselorId).toBe('demoCounselorOne')
      expect(result.assignedWhileOffShift).toBe(true)
      expect(result.assignedWhileAbsent).toBe(false)
    }
  })

  it('blocks a second submission from the same phone while the first is still open and recent, like Fictional Student A', async () => {
    const visitRepository = createFakeVisitRepository()
    await visitRepository.create({
      type: 'new',
      name: 'Fictional Student A',
      phone: '56012345',
      desiredCountry: 'USA',
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })
    const deps = {
      visitRepository,
      specializationRepository: createFakeSpecializationRepository(candidates),
      clock: createFixedClock(new Date()),
    }

    const result = await submitNewClientVisit(
      { name: 'Fictional Student A', phone: '56012345', desiredCountry: 'USA', createdBy: null },
      deps
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('duplicateVisitPending')
  })

  it('allows the second submission through when overrideDuplicate is set', async () => {
    const visitRepository = createFakeVisitRepository()
    await visitRepository.create({
      type: 'new',
      name: 'Fictional Student C',
      phone: '56012345',
      desiredCountry: 'USA',
      counselorId: null,
      linkedVisitId: null,
      requestedCounselorId: null,
      createdBy: null,
    })
    const deps = {
      visitRepository,
      specializationRepository: createFakeSpecializationRepository(candidates),
      clock: createFixedClock(new Date()),
    }

    const result = await submitNewClientVisit(
      {
        name: 'Fictional Student B',
        phone: '56012345',
        desiredCountry: 'USA',
        createdBy: null,
        overrideDuplicate: true,
      },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.duplicateOverridden).toBe(true)
  })

  // العلم مرفوع بالفورم دائمًا بعد ما يضغط الموظف "استمرار"، حتى لو ما فيه
  // زيارة مفتوحة أصلاً. لو سجّلنا كل مرة ينرفع فيها، السجل يمتلئ بتخطّيات
  // ما صارت — فنسجّل بس لما يكون فيه تحذير فعلي وانتخطّى
  it('reports no override when the warning would never have fired', async () => {
    const deps = {
      visitRepository: createFakeVisitRepository(),
      specializationRepository: createFakeSpecializationRepository(candidates),
      clock: createFixedClock(new Date()),
    }

    const result = await submitNewClientVisit(
      {
        name: 'Sample Client',
        phone: '50000009',
        desiredCountry: 'USA',
        createdBy: null,
        overrideDuplicate: true,
      },
      deps
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.duplicateOverridden).toBe(false)
  })

  // عبدالعزيز الطيار انعطى لمستشار غايب من ١٢ يوم، والعداد نقص من ٣ لـ٢ فبان
  // كأنه تقدّم — والعميل ينتظر أحد ما بيجي
  // العميل ما يبقى بلا صاحب أبداً، ويستلمه صاحب الدور سجّل دخول أو لا — والعلَم للسجل بس
  describe('nobody is left without a counselor', () => {
    const NOW = new Date('2026-09-21T14:00:00Z') // الاثنين

    function candidatesSeen(lastSeenAt: Date | null): CounselorCandidate[] {
      return [{ id: 'demoCounselorOne', scopes: ['USA'], lastAssignedAt: null, lastSeenAt }]
    }

    async function submitWith(
      candidates: CounselorCandidate[],
      country = 'USA',
      phone = '50000001'
    ) {
      return submitNewClientVisit(
        { name: 'Sample Client', phone, desiredCountry: country, createdBy: null },
        {
          visitRepository: createFakeVisitRepository(),
          specializationRepository: createFakeSpecializationRepository(candidates),
          clock: createFixedClock(NOW),
        }
      )
    }

    it('gives the client to a present counselor, unflagged', async () => {
      const result = await submitWith(candidatesSeen(new Date('2026-09-21T06:00:00Z')))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.visit.counselorId).toBe('demoCounselorOne')
        expect(result.assignedWhileAbsent).toBe(false)
      }
    })

    // القرار: عميل بلا صاحب ما هو بطابور أحد. الغايب أحسن من لا أحد، بشرط
    // إن الصف يبان أحمر عشان المشرف ينقله
    it('gives the client to an absent counselor rather than to nobody, and flags it', async () => {
      const result = await submitWith(candidatesSeen(new Date('2026-08-31T06:00:00Z')))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.visit.counselorId).toBe('demoCounselorOne')
        expect(result.assignedWhileAbsent).toBe(true)
      }
    })

    it('treats a counselor who has never signed in the same way', async () => {
      const result = await submitWith(candidatesSeen(null))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.visit.counselorId).toBe('demoCounselorOne')
        expect(result.assignedWhileAbsent).toBe(true)
      }
    })

    // قرار ٢٤ سبتمبر: تسجيل الدخول ما يأثر. كان الحاضر يتقدّم دايمًا على الغايب
    it('gives an away counselor their turn like anyone else, and only notes it', async () => {
      const result = await submitWith([
        { id: 'absent', scopes: ['USA'], lastAssignedAt: null, lastSeenAt: null },
        {
          id: 'present',
          scopes: ['USA'],
          lastAssignedAt: new Date('2026-09-21T09:00:00Z'),
          lastSeenAt: NOW,
        },
      ])
      expect(result.ok).toBe(true)
      if (result.ok) {
        // "absent" قبل "present" بالترتيب الثابت، ودوره الأول
        expect(result.visit.counselorId).toBe('absent')
        expect(result.assignedWhileAbsent).toBe(true)
      }
    })

    // الحالة الوحيدة اللي يبقى فيها العميل بلا مستشار: ما فيه أحد يغطي وجهته
    it('leaves the client unassigned only when nobody covers that country', async () => {
      const result = await submitWith(candidatesSeen(NOW), 'Canada', '50000004')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.visit.counselorId).toBeNull()
        expect(result.assignedWhileAbsent).toBe(false)
        expect(result.unassignedReason).toBe('noneCoverScope')
      }
    })

    // السبب الثالث: فيه من يغطيها، وحاضر، بس حسابه معطّل — ما يوصل للمرشحين
    // إطلاقًا، فبدون هالسؤال نقول "ما فيه أحد يغطيها" وإحنا عارفين إن فيه
    it('says the account is deactivated, rather than pretending nobody covers it', async () => {
      const result = await submitNewClientVisit(
        {
          name: 'Sample Client',
          phone: '50000007',
          desiredCountry: 'Australia & New Zealand',
          createdBy: null,
        },
        {
          visitRepository: createFakeVisitRepository(),
          specializationRepository: createFakeSpecializationRepository(
            [],
            ['Australia & New Zealand']
          ),
          clock: createFixedClock(NOW),
        }
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.visit.counselorId).toBeNull()
        expect(result.unassignedReason).toBe('onlyDeactivated')
        expect(result.scopeHoldersOffShift).toBe(1)
      }
    })

    // السبب الثاني، ومختلف تمامًا: فيه من يغطيها بس كلهم خارج الشفت. قول
    // "غياب" هنا يودّي المشرف يطارد شخص حاضر أصلاً بس دوامه مسائي
    it('reaches an off-shift counselor as the fallback, and flags it as off shift', async () => {
      // ١٠ صباحًا بتوقيت الكويت — المسائي يبان من ٣ لـ١٠ مساءً فقط
      const morning = new Date('2026-09-21T07:00:00Z')
      const result = await submitNewClientVisit(
        {
          name: 'Sample Client',
          phone: '50000005',
          desiredCountry: 'Australia & New Zealand',
          createdBy: null,
        },
        {
          visitRepository: createFakeVisitRepository(),
          specializationRepository: createFakeSpecializationRepository([
            {
              id: 'night',
              scopes: ['Australia & New Zealand'],
              lastAssignedAt: null,
              shift: 'night',
              lastSeenAt: morning,
            },
          ]),
          clock: createFixedClock(morning),
        }
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.visit.counselorId).toBe('night')
        expect(result.assignedWhileOffShift).toBe(true)
        expect(result.unassignedReason).toBeNull()
      }
    })

    // نفس المستشار المسائي بعد الساعة ٣ — يستلم عادي
    it('assigns that same night-shift counselor once their shift has started', async () => {
      const evening = new Date('2026-09-21T14:00:00Z') // ٥ مساءً بالكويت
      const result = await submitNewClientVisit(
        {
          name: 'Sample Client',
          phone: '50000006',
          desiredCountry: 'Australia & New Zealand',
          createdBy: null,
        },
        {
          visitRepository: createFakeVisitRepository(),
          specializationRepository: createFakeSpecializationRepository([
            {
              id: 'night',
              scopes: ['Australia & New Zealand'],
              lastAssignedAt: null,
              shift: 'night',
              lastSeenAt: evening,
            },
          ]),
          clock: createFixedClock(evening),
        }
      )
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.visit.counselorId).toBe('night')
    })

    // لو داوم الأحد وما فتح التطبيق الاثنين، هو تحت الخط — يستلم بلا علم أحمر
    it('does not flag someone merely quiet for a day or two', async () => {
      const result = await submitWith(candidatesSeen(new Date('2026-09-20T12:00:00Z')))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.visit.counselorId).toBe('demoCounselorOne')
        expect(result.assignedWhileAbsent).toBe(false)
        expect(result.assignedNotSignedInToday).toBe(true)
      }
    })
  })
})

describe('submitNewClientVisit round robin', () => {
  const NOW = new Date('2026-09-21T09:00:00Z') // الاثنين، ١٢ الظهر بالكويت — الكل بالشفت
  const LONG_AGO = new Date('2026-08-19T09:00:00Z')

  // نفس المستودع بين الإرسالات، فمكان الدورة يتحفظ بينها — مثل القاعدة
  function kiosk(candidates: CounselorCandidate[]) {
    const deps = {
      visitRepository: createFakeVisitRepository(),
      specializationRepository: createFakeSpecializationRepository(candidates),
      clock: createFixedClock(NOW),
    }
    let n = 0
    return {
      deps,
      async next(phone = `5000${String(++n).padStart(4, '0')}`, overrideDuplicate = false) {
        const result = await submitNewClientVisit(
          {
            name: 'Sample Client',
            phone,
            desiredCountry: 'USA',
            createdBy: null,
            overrideDuplicate,
          },
          deps
        )
        if (!result.ok) throw new Error(result.errors.join(','))
        return result.visit.counselorId
      },
    }
  }

  const usa = (id: string, extra: Partial<CounselorCandidate> = {}): CounselorCandidate => ({
    id,
    scopes: ['USA'],
    lastAssignedAt: null,
    lastSeenAt: NOW,
    ...extra,
  })

  it('gives three counselors covering one country clients 1, 2, 3, 1, 2, 3', async () => {
    const k = kiosk([usa('c1'), usa('c2'), usa('c3')])
    const got = []
    for (let i = 0; i < 6; i++) got.push(await k.next())
    expect(got).toEqual(['c1', 'c2', 'c3', 'c1', 'c2', 'c3'])
  })

  // كان "أطول مدة بدون عميل": الغايب من أسابيع تاريخه أقدم، فيتصدّر ويكرر
  it('gives a counselor away for weeks one turn, not several in a row', async () => {
    const k = kiosk([
      usa('c1', { lastAssignedAt: new Date('2026-09-20T09:00:00Z') }),
      usa('c2', { lastAssignedAt: LONG_AGO, lastSeenAt: LONG_AGO }),
      usa('c3', { lastAssignedAt: new Date('2026-09-21T08:00:00Z') }),
    ])
    const got = []
    for (let i = 0; i < 6; i++) got.push(await k.next())
    expect(got).toEqual(['c1', 'c2', 'c3', 'c1', 'c2', 'c3'])
  })

  it('assigns in turn when nobody has ever signed in', async () => {
    const k = kiosk([usa('c1', { lastSeenAt: null }), usa('c2', { lastSeenAt: null })])
    expect([await k.next(), await k.next(), await k.next()]).toEqual(['c1', 'c2', 'c1'])
  })

  it('sends a returning client back to their counselor even if never signed in, without using a turn', async () => {
    const k = kiosk([usa('c1', { lastSeenAt: null }), usa('c2'), usa('c3')])
    expect(await k.next('50001111')).toBe('c1')
    expect(await k.next()).toBe('c2')
    // نفس الرقم يرجع — لمستشاره، والدورة ما تتحرك
    expect(await k.next('50001111', true)).toBe('c1')
    expect(await k.next()).toBe('c3')
  })
})

describe('submitNewClientVisit came-to', () => {
  it('records no came-to for a new client, who asks for nobody', async () => {
    const result = await submitNewClientVisit(
      { name: 'Demo Student One', phone: '56012345', desiredCountry: 'USA', createdBy: null },
      makeDeps()
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.requestedCounselorId).toBeNull()
      expect(result.visit.assignedAt).toBeInstanceOf(Date)
    }
  })
})
