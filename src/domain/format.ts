export const MISSING = '—'

export type Direction = 'up' | 'down' | 'flat'

function groupThousands(value: number, fractionDigits: number): string {
  const text = Math.abs(value).toFixed(fractionDigits)
  const dot = text.indexOf('.')
  const integer = dot === -1 ? text : text.slice(0, dot)
  const fraction = dot === -1 ? '' : text.slice(dot)
  return `${value < 0 ? '-' : ''}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction}`
}

export function formatPrice(value: number | null): string {
  return value === null ? MISSING : groupThousands(value, 2)
}

export function formatShares(value: number): string {
  return groupThousands(value, 0)
}

export function formatAmount(value: number | null): string {
  return value === null ? MISSING : groupThousands(value, 0)
}

export function formatRate(value: number | null): string {
  if (value === null) return MISSING
  return `${value > 0 ? '+' : ''}${groupThousands(value * 100, 2)}%`
}

export function directionOf(value: number | null): Direction {
  if (value === null || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}
