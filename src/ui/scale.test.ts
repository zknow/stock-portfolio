import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_DEFAULT, ZOOM_STEP } from '../domain/types'
import { BASE_HEIGHT, BASE_WIDTH, MIN_SCALE, clampZoom, minHeightFor, nextZoom, scaleFactor } from './scale'

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

  it('使用者倍率乘在因子之上（ADR-0018）', () => {
    expect(scaleFactor(700, 1.5)).toBeCloseTo(MIN_SCALE * 1.5)
    expect(scaleFactor(BASE_WIDTH, 2)).toBe(2)
    expect(scaleFactor(BASE_WIDTH, ZOOM_DEFAULT)).toBe(1)
  })
})

describe('clampZoom', () => {
  it('夾在 80%–200%', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM)
    expect(clampZoom(5)).toBe(MAX_ZOOM)
    expect(clampZoom(1.34)).toBe(1.3)
  })
})

describe('nextZoom', () => {
  it('一級距 10%，上限不再往上', () => {
    expect(nextZoom(1, 1)).toBe(1.1)
    expect(nextZoom(1, -1)).toBe(0.9)
    expect(nextZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM)
    expect(nextZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM)
  })

  it('往返不會累積浮點誤差', () => {
    expect(nextZoom(nextZoom(1.1, -1), 1)).toBe(1.1)
    expect(nextZoom(0.8, 1)).toBe(ZOOM_STEP + MIN_ZOOM)
  })
})

describe('minHeightFor', () => {
  it('按基準比例 1100:760 換算', () => {
    expect(minHeightFor(BASE_WIDTH)).toBe(BASE_HEIGHT)
    expect(minHeightFor(550)).toBe(Math.round((550 * BASE_HEIGHT) / BASE_WIDTH))
    expect(minHeightFor(550)).toBe(380)
  })
})
