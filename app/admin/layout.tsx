// Top-level admin layout — intentionally thin.
// The admin shell (sidebar + header) lives in (protected)/layout.tsx
// so the login page is standalone and never wrapped in the shell.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
