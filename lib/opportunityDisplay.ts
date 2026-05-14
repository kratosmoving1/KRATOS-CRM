export function formatQuoteNumber(opportunityNumber: string | null | undefined) {
  if (!opportunityNumber) return '—'
  const suffix = opportunityNumber.match(/(\d+)$/)?.[1]
  if (!suffix) return opportunityNumber
  return String(Number(suffix))
}
