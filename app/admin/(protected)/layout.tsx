export const dynamic = 'force-dynamic'

import AdminShell from '@/components/admin/AdminShell'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
