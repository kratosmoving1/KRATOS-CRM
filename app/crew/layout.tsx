import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Kratos Crew',
  description: 'Kratos Moving crew job app',
  manifest: '/crew-manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Kratos Crew' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
}

export default function CrewLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {children}
    </div>
  )
}
