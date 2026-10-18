import type { Holding, Quote } from './types'

export interface PnlRow {
  holding: Holding
  quote: Quote | null
  /** 平均單位成本 × 股數。恒有值 */
  cost: number
  marketValue: number | null
  totalReturn: number | null
  totalReturnRate: number | null
  todayReturn: number | null
  todayReturnRate: number | null
}

export interface PnlTotals {
  cost: number
  marketValue: number
  totalReturn: number
  totalReturnRate: number | null
  todayReturn: number
  /** 今日總報酬 ÷ 昨日總市值（Σ 昨收×股數），只算昨收不缺的持股（ADR-0015） */
  todayReturnRate: number | null
  /** 估值價缺失，未計入總計的檔數 */
  excludedCount: number
  /** 昨收缺失，未計入今日總報酬的檔數 */
  todayExcludedCount: number
}

export function computePnlRow(holding: Holding, quote: Quote | null): PnlRow {
  const valuationPrice = quote?.valuationPrice ?? null
  const previousClose = quote?.previousClose ?? null
  const { shares, averageCost } = holding

  return {
    holding,
    quote,
    cost: averageCost * shares,
    marketValue: valuationPrice === null ? null : valuationPrice * shares,
    totalReturn: valuationPrice === null ? null : (valuationPrice - averageCost) * shares,
    totalReturnRate: valuationPrice === null ? null : (valuationPrice - averageCost) / averageCost,
    todayReturn:
      valuationPrice === null || previousClose === null
        ? null
        : (valuationPrice - previousClose) * shares,
    todayReturnRate:
      valuationPrice === null || previousClose === null
        ? null
        : (valuationPrice - previousClose) / previousClose,
  }
}

export function computeTotals(rows: PnlRow[]): PnlTotals {
  let cost = 0
  let marketValue = 0
  let totalReturn = 0
  let todayReturn = 0
  let todayBase = 0
  let excludedCount = 0
  let todayExcludedCount = 0

  for (const row of rows) {
    if (row.marketValue === null || row.totalReturn === null) {
      excludedCount += 1
      continue
    }

    cost += row.cost
    marketValue += row.marketValue
    totalReturn += row.totalReturn

    if (row.todayReturn === null) {
      todayExcludedCount += 1
    } else {
      todayReturn += row.todayReturn
      // 昨日市值 = 今日市值 − 今日報酬，不必回頭讀 quote
      todayBase += row.marketValue - row.todayReturn
    }
  }

  return {
    cost,
    marketValue,
    totalReturn,
    totalReturnRate: cost === 0 ? null : totalReturn / cost,
    todayReturn,
    todayReturnRate: todayBase === 0 ? null : todayReturn / todayBase,
    excludedCount,
    todayExcludedCount,
  }
}
