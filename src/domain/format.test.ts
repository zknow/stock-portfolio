import { describe, expect, it } from 'vitest'
import { MISSING, directionOf, formatAmount, formatPrice, formatRate, formatShares } from './format'

describe('formatPrice', () => {
  it('千分位加 2 位小數', () => {
    expect(formatPrice(2420)).toBe('2,420.00')
    expect(formatPrice(1234.567)).toBe('1,234.57')
    expect(formatPrice(1234567.891)).toBe('1,234,567.89')
  })

  it('缺值顯示破折號', () => {
    expect(formatPrice(null)).toBe(MISSING)
  })
})

describe('formatShares', () => {
  it('千分位整數', () => {
    expect(formatShares(0)).toBe('0')
    expect(formatShares(1000)).toBe('1,000')
    expect(formatShares(1234567)).toBe('1,234,567')
  })
})

describe('formatAmount', () => {
  it('千分位 0 位小數', () => {
    expect(formatAmount(12345.6)).toBe('12,346')
    expect(formatAmount(-12345.6)).toBe('-12,346')
  })

  it('缺值顯示破折號', () => {
    expect(formatAmount(null)).toBe(MISSING)
  })
})

describe('formatRate', () => {
  it('2 位小數加百分號，正數加正號', () => {
    expect(formatRate(0.1234)).toBe('+12.34%')
    expect(formatRate(-0.0125)).toBe('-1.25%')
    expect(formatRate(0)).toBe('0.00%')
  })

  it('缺值顯示破折號', () => {
    expect(formatRate(null)).toBe(MISSING)
  })
})

describe('directionOf', () => {
  it('回傳漲跌語意，不涉及顏色', () => {
    expect(directionOf(1)).toBe('up')
    expect(directionOf(-1)).toBe('down')
    expect(directionOf(0)).toBe('flat')
    expect(directionOf(null)).toBe('flat')
  })
})
