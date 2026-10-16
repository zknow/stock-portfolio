import { describe, expect, it } from 'vitest'
import { isValidCode, isValidCost, isValidShares } from './validate'

describe('isValidCode', () => {
  it('接受 4 到 6 位英數字', () => {
    expect(isValidCode('2330')).toBe(true)
    expect(isValidCode('00878')).toBe(true)
    expect(isValidCode('020000')).toBe(true)
    expect(isValidCode('00632R')).toBe(true)
    expect(isValidCode('00632r')).toBe(true)
  })

  it('長度或字元不符即拒絕', () => {
    expect(isValidCode('233')).toBe(false)
    expect(isValidCode('2330000')).toBe(false)
    expect(isValidCode('2330-')).toBe(false)
    expect(isValidCode('')).toBe(false)
  })
})

describe('isValidShares', () => {
  it('接受正整數', () => {
    expect(isValidShares(1)).toBe(true)
    expect(isValidShares(1000)).toBe(true)
  })

  it('拒絕 0、負數、小數與非數值', () => {
    expect(isValidShares(0)).toBe(false)
    expect(isValidShares(-1)).toBe(false)
    expect(isValidShares(1.5)).toBe(false)
    expect(isValidShares(Number.NaN)).toBe(false)
    expect(isValidShares(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('isValidCost', () => {
  it('接受正數', () => {
    expect(isValidCost(0.5)).toBe(true)
    expect(isValidCost(500)).toBe(true)
  })

  it('拒絕 0、負數與非數值', () => {
    expect(isValidCost(0)).toBe(false)
    expect(isValidCost(-1)).toBe(false)
    expect(isValidCost(Number.NaN)).toBe(false)
    expect(isValidCost(Number.POSITIVE_INFINITY)).toBe(false)
  })
})
