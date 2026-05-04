import { Construction } from 'lucide-react'

interface ComingSoonProps {
  title: string
}

export default function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-32 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-kratos/10">
        <Construction size={24} className="text-kratos" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 max-w-xs text-sm text-slate-500">
        This section is under construction and will be available in a future update.
      </p>
    </div>
  )
}
