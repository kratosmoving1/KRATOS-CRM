const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number): string {
  return cad.format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-CA').format(value)
}
