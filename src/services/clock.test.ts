import { describe, expect, it } from 'vitest'
import { dateKey, dateText, isAfterClose, isTradingTime, timeText, timestampText } from './clock'

function local(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(year, month - 1, day, hour, minute, second)
}

describe('時間文字', () => {
  it('依本地時間格式化', () => {
    const now = local(2026, 10, 16, 9, 5, 7)
    expect(dateKey(now)).toBe('20261016')
    expect(dateText(now)).toBe('2026-10-16')
    expect(timeText(now)).toBe('09:05:07')
    expect(timestampText(now)).toBe('2026-10-16 09:05:07')
  })
})

describe('isTradingTime', () => {
  it('週五 09:00 與 13:29 在時段內', () => {
    expect(isTradingTime(local(2026, 10, 16, 9, 0))).toBe(true)
    expect(isTradingTime(local(2026, 10, 16, 13, 29))).toBe(true)
  })

  it('09:00 前與 13:30 起不在時段內', () => {
    expect(isTradingTime(local(2026, 10, 16, 8, 59))).toBe(false)
    expect(isTradingTime(local(2026, 10, 16, 13, 30))).toBe(false)
    expect(isTradingTime(local(2026, 10, 16, 20, 0))).toBe(false)
  })

  it('週六日不在時段內', () => {
    expect(isTradingTime(local(2026, 10, 17, 10, 0))).toBe(false)
    expect(isTradingTime(local(2026, 10, 18, 10, 0))).toBe(false)
  })
})

describe('isAfterClose', () => {
  it('平日 13:30 起為 true', () => {
    expect(isAfterClose(local(2026, 10, 16, 13, 29))).toBe(false)
    expect(isAfterClose(local(2026, 10, 16, 13, 30))).toBe(true)
  })

  it('平日的開盤前與盤中為 false', () => {
    expect(isAfterClose(local(2026, 10, 16, 8, 0))).toBe(false)
    expect(isAfterClose(local(2026, 10, 16, 10, 0))).toBe(false)
  })

  it('週六日為 false，即使時間已過 13:30', () => {
    expect(isAfterClose(local(2026, 10, 17, 20, 0))).toBe(false)
    expect(isAfterClose(local(2026, 10, 18, 20, 0))).toBe(false)
  })
})
