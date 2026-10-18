import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, SCHEMA_VERSION, parsePortfolio } from './storage'

const VALID = {
  schemaVersion: 1,
  sortKey: 'marketValue',
  sortDirection: 'desc',
  holdings: [{ code: '2330', name: '台積電', market: 'listing', shares: 1000, averageCost: 850.5 }],
}

function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...record }
  delete copy[key]
  return copy
}

describe('parsePortfolio', () => {
  it('讀出持股與 UI 偏好', () => {
    const file = parsePortfolio(JSON.stringify(VALID))
    expect(file.schemaVersion).toBe(SCHEMA_VERSION)
    expect(file.holdings).toEqual(VALID.holdings)
    expect(file.sortKey).toBe('marketValue')
    expect(file.sortDirection).toBe('desc')
  })

  it('忽略舊檔殘留的視窗寬高欄位（視窗尺寸不再持久化，ADR-0016）', () => {
    const file = parsePortfolio(JSON.stringify({ ...VALID, windowWidth: 1100, windowHeight: 760 }))
    expect(file.holdings).toEqual(VALID.holdings)
  })

  it('缺少 schemaVersion 時視為目前版本', () => {
    const file = parsePortfolio(JSON.stringify(without(VALID, 'schemaVersion')))
    expect(file.schemaVersion).toBe(SCHEMA_VERSION)
    expect(file.holdings).toHaveLength(1)
  })

  it('schemaVersion 高於支援版本時拒絕，避免降版覆寫', () => {
    expect(() => parsePortfolio(JSON.stringify({ ...VALID, schemaVersion: SCHEMA_VERSION + 1 }))).toThrow('高於支援')
  })

  it('偏好不合法時回到預設值', () => {
    const file = parsePortfolio(JSON.stringify({ ...VALID, sortKey: '不存在的鍵', sortDirection: '橫向' }))
    expect(file.sortKey).toBe(DEFAULT_PREFERENCES.sortKey)
    expect(file.sortDirection).toBe('desc')
  })

  it('returnDisplay 缺失或非法時回預設，合法值原樣讀出', () => {
    expect(parsePortfolio(JSON.stringify(VALID)).returnDisplay).toBe(DEFAULT_PREFERENCES.returnDisplay)
    expect(parsePortfolio(JSON.stringify({ ...VALID, returnDisplay: 'amount' })).returnDisplay).toBe('amount')
    expect(parsePortfolio(JSON.stringify({ ...VALID, returnDisplay: '百分比' })).returnDisplay).toBe(
      DEFAULT_PREFERENCES.returnDisplay,
    )
  })

  it('持股不合法時視為損毀', () => {
    expect(() => parsePortfolio(JSON.stringify({ ...VALID, holdings: [{ code: '2330' }] }))).toThrow('不合法的持股')
    expect(() => parsePortfolio(JSON.stringify({ ...VALID, holdings: [{ ...VALID.holdings[0], shares: 0 }] }))).toThrow(
      '不合法的持股',
    )
    expect(() => parsePortfolio(JSON.stringify(without(VALID, 'holdings')))).toThrow('holdings')
    expect(() => parsePortfolio('{')).toThrow()
  })

  it('空投組可以讀出', () => {
    expect(parsePortfolio(JSON.stringify({ ...VALID, holdings: [] })).holdings).toEqual([])
  })
})
