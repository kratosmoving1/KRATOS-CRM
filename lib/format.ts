const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
})

const cadFull = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(value: number): string {
  return cad.format(value)
}

// Shows cents — for hourly rates and per-item prices
export function formatCurrencyFull(value: number): string {
  return cadFull.format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-CA').format(value)
}
