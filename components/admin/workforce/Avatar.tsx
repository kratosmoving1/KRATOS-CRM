interface AvatarProps {
  src: string | null | undefined
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
}

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${SIZES[size]} rounded-full object-cover border-2 border-slate-200`}
      />
    )
  }

  return (
    <div
      className={`${SIZES[size]} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-semibold flex items-center justify-center border-2 border-slate-200 shrink-0`}
    >
      {initials || '?'}
    </div>
  )
}
