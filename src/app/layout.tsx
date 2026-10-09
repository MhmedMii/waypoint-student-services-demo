import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DemoProvider } from '../demo/DemoProvider'
import '@fontsource-variable/manrope'
import '@fontsource/noto-sans-arabic/400.css'
import '@fontsource/noto-sans-arabic/600.css'
import '../demo/demo.css'

export const metadata: Metadata = {
  title: 'Waypoint — Student services demo',
  description:
    'Explore a fictional education consultancy workspace: student visits, counselor queues, visa applications, and exam bookings. All records are fictional.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Waypoint — Student services demo',
    description: 'Fictional people. Working demo workflows.',
    type: 'website',
  },
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <DemoProvider>
          <Suspense fallback={<div className="loading-demo">Preparing the demo…</div>}>
            {children}
          </Suspense>
        </DemoProvider>
      </body>
    </html>
  )
}
