import { describe, expect, it } from 'vitest'
import { computePnlRow, computeTotals } from './pnl'
import { buildQuote } from './quote'
import type { Holding } from './types'

function holding(shares: number, averageCost: number): Holding {
  return { code: '2330', name: '台積電', market: 'listing', shares, averageCost }
}

describe('computePnlRow', () => {
  it('有成交時以現價計算', () => {
    const row = computePnlRow(
      holding(1000, 500),
      buildQuote({ code: '2330', price: 600, previousClose: 590, dataDate: '20261016' }),
    )

    expect(row.cost).toBe(500000)
    expect(row.marketValue).toBe(600000)
    expect(row.totalReturn).toBe(100000)
    expect(row.totalReturnRate).toBeCloseTo(0.2, 10)
    expect(row.todayReturn).toBe(10000)
    expect(row.todayReturnRate).toBeCloseTo(10 / 590, 10)
  })

  it('當日無成交時以昨收作為估值價', () => {
    const row = computePnlRow(
      holding(1000, 500),
      buildQuote({ code: '2330', price: null, previousClose: 590, dataDate: '20261016' }),
    )

    expect(row.marketValue).toBe(590000)
    expect(row.totalReturn).toBe(90000)
    expect(row.todayReturn).toBe(0)
    expect(row.todayReturnRate).toBe(0)
  })

  it('有現價但昨收缺失時，只有今日報酬缺值', () => {
    const row = computePnlRow(
      holding(1000, 500),
      buildQuote({ code: '2330', price: 600, previousClose: null, dataDate: '20261016' }),
    )

    expect(row.totalReturn).toBe(100000)
    expect(row.todayReturn).toBeNull()
    expect(row.todayReturnRate).toBeNull()
  })

  it('估值價缺失時報酬欄位全為 null，但成本仍算得出', () => {
    const row = computePnlRow(
      holding(1000, 500),
      buildQuote({ code: '2330', price: null, previousClose: null, dataDate: '20261016' }),
    )

    expect(row.cost).toBe(500000)
    expect(row.marketValue).toBeNull()
    expect(row.totalReturn).toBeNull()
    expect(row.totalReturnRate).toBeNull()
    expect(row.todayReturn).toBeNull()
    expect(row.todayReturnRate).toBeNull()
  })

  it('尚無報價時等同估值價缺失', () => {
    const row = computePnlRow(holding(1000, 500), null)

    expect(row.cost).toBe(500000)
    expect(row.marketValue).toBeNull()
  })
})

describe('computeTotals', () => {
  const normal = computePnlRow(
    holding(1000, 500),
    buildQuote({ code: '2330', price: 600, previousClose: 590, dataDate: '20261016' }),
  )
  const noValuation = computePnlRow(
    holding(2000, 100),
    buildQuote({ code: '2412', price: null, previousClose: null, dataDate: '20261016' }),
  )

  it('排除估值價缺失的持股並計數', () => {
    const totals = computeTotals([normal, noValuation])

    expect(totals.excludedCount).toBe(1)
    expect(totals.todayExcludedCount).toBe(0)
    expect(totals.cost).toBe(500000)
    expect(totals.marketValue).toBe(600000)
    expect(totals.totalReturn).toBe(100000)
    expect(totals.totalReturnRate).toBeCloseTo(0.2, 10)
    expect(totals.todayReturn).toBe(10000)
    expect(totals.todayReturnRate).toBeCloseTo(10000 / 590000, 10)
  })

  it('昨收缺失的持股不計入今日總報酬，也不進今日報酬率的分母', () => {
    const noPreviousClose = computePnlRow(
      holding(1000, 500),
      buildQuote({ code: '2330', price: 600, previousClose: null, dataDate: '20261016' }),
    )
    const totals = computeTotals([noPreviousClose])

    expect(totals.excludedCount).toBe(0)
    expect(totals.todayExcludedCount).toBe(1)
    expect(totals.marketValue).toBe(600000)
    expect(totals.todayReturn).toBe(0)
    expect(totals.todayReturnRate).toBeNull()
  })

  it('今日總報酬率以昨收市值加權，不是逐列比率的平均', () => {
    // 昨收 100 → 現價 101（+1%）、昨收 200 → 現價 194（−3%），各 1000 股
    const up = computePnlRow(
      holding(1000, 50),
      buildQuote({ code: '2330', price: 101, previousClose: 100, dataDate: '20261016' }),
    )
    const down = computePnlRow(
      holding(1000, 50),
      buildQuote({ code: '2412', price: 194, previousClose: 200, dataDate: '20261016' }),
    )
    const totals = computeTotals([up, down])

    expect(totals.todayReturn).toBe(-5000)
    expect(totals.todayReturnRate).toBeCloseTo(-5000 / 300000, 10)
    expect(totals.todayReturnRate).not.toBeCloseTo(-0.01, 6)
  })

  it('空投組的總報酬率為 null', () => {
    const totals = computeTotals([])

    expect(totals.cost).toBe(0)
    expect(totals.totalReturn).toBe(0)
    expect(totals.totalReturnRate).toBeNull()
    expect(totals.todayReturnRate).toBeNull()
  })
})
