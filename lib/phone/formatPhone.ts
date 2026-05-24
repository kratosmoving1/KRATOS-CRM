export function formatDisplayPhone(value: string | null | undefined) {
  if (!value) return '—'
  const digits = value.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (national.length !== 10) return value
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
}
