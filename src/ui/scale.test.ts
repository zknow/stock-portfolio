import { describe, expect, it } from 'vitest'
import { BASE_HEIGHT, BASE_WIDTH, MIN_SCALE, minHeightFor, scaleFactor } from './scale'

describe('scaleFactor', () => {
  it('視窗寬度除以基準寬 1100', () => {
    expect(scaleFactor(BASE_WIDTH)).toBe(1)
    expect(scaleFactor(1320)).toBeCloseTo(1.2)
  })

  it('低於下限時夾在 0.85，字級不會縮到不可讀', () => {
    expect(scaleFactor(700)).toBe(MIN_SCALE)
    expect(scaleFactor(1)).toBe(MIN_SCALE)
  })

  it('下限對應的視窗寬度為 935', () => {
    expect(scaleFactor(BASE_WIDTH * MIN_SCALE)).toBe(MIN_SCALE)
    expect(scaleFactor(BASE_WIDTH * MIN_SCALE + 1)).toBeGreaterThan(MIN_SCALE)
  })
})

describe('minHeightFor', () => {
  it('按基準比例 1100:760 換算', () => {
    expect(minHeightFor(BASE_WIDTH)).toBe(BASE_HEIGHT)
    expect(minHeightFor(550)).toBe(Math.round((550 * BASE_HEIGHT) / BASE_WIDTH))
    expect(minHeightFor(550)).toBe(380)
  })
})
