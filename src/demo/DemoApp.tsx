'use client'
import { usePathname } from 'next/navigation'
import { DemoShell } from './DemoShell'
import { Overview } from './Overview'
import { Visits } from './Visits'
import { CounselorDesk } from './CounselorDesk'
import { Applications } from './Applications'
import { Accounts, ActivityLog, TeamOverview } from './Management'
import { Apply, Intake, Tracking, Welcome } from './PublicFlows'
import { useDemo } from './DemoProvider'
import { Posters } from './Posters'

export function DemoApp() {
  const path = usePathname()
  const { ready, tr } = useDemo()
  if (!ready)
    return (
      <div className="loading-demo" role="status">
        <div className="loading-mark" />
        <span>{tr('Preparing your fictional workspace…', 'جارٍ تحضير المساحة الوهمية…')}</span>
      </div>
    )
  if (path.startsWith('/apply/status/')) return <Tracking />
  if (path.includes('qr-poster')) return <Posters application={path.startsWith('/apply')} />
  if (path === '/apply') return <Apply />
  if (path === '/intake') return <Intake />
  if (['/login', '/forgot-password', '/reset-password'].includes(path)) return <Welcome />
  let content = <Overview />
  if (path === '/admin/visits') content = <Visits />
  if (path === '/counselor/students') content = <Visits personal />
  if (path === '/counselor') content = <CounselorDesk />
  if (path === '/visas') content = <Applications kind="visa" />
  if (path === '/exams') content = <Applications kind="exam" />
  if (path === '/admin/accounts') content = <Accounts />
  if (path === '/admin/activity' || path === '/admin/online-history') content = <ActivityLog />
  if (path === '/admin/supervision' || path === '/admin/online-now') content = <TeamOverview />
  return <DemoShell>{content}</DemoShell>
}
