import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Kratos CRM', template: '%s | Kratos CRM' },
  description: 'Internal CRM for Kratos Moving Inc.',
  icons: { icon: '/logo.png', shortcut: '/logo.png', apple: '/logo.png' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
