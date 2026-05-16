export type NormalizedPhoneResult = {
  input: string
  normalized: string
  isE164: boolean
}

export function normalizePhoneToE164(value: string): NormalizedPhoneResult {
  const input = value.trim()
  const withoutExtension = input.replace(/(?:ext\.?|x)\s*\d+$/i, '').trim()
  const digits = withoutExtension.replace(/\D/g, '')

  if (withoutExtension.startsWith('+') && digits.length >= 8 && digits.length <= 15) {
    return {
      input,
      normalized: `+${digits}`,
      isE164: true,
    }
  }

  if (digits.length === 10) {
    return {
      input,
      normalized: `+1${digits}`,
      isE164: true,
    }
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return {
      input,
      normalized: `+${digits}`,
      isE164: true,
    }
  }

  return {
    input,
    normalized: input,
    isE164: false,
  }
}
