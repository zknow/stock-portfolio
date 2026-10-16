import { describe, expect, it } from 'vitest'
import { buildChartUrl, parseChartResponse, toYahooSymbol } from './YahooProvider'

function chart(meta: Record<string, unknown>): string {
  return JSON.stringify({ chart: { result: [{ meta, timestamp: [1760000000] }], error: null } })
}

describe('toYahooSymbol', () => {
  it('上市加 .TW，上櫃加 .TWO', () => {
    expect(toYahooSymbol({ code: '2330', market: 'listing' })).toBe('2330.TW')
    expect(toYahooSymbol({ code: '6488', market: 'otc' })).toBe('6488.TWO')
  })
})

describe('buildChartUrl', () => {
  it('帶上 interval 與 range', () => {
    expect(buildChartUrl({ code: '2330', market: 'listing' })).toBe(
      'https://query1.finance.yahoo.com/v8/finance/chart/2330.TW?interval=1d&range=1d',
    )
  })
})

describe('parseChartResponse', () => {
  it('取 regularMarketPrice 與 chartPreviousClose', () => {
    const quote = parseChartResponse(
      chart({ regularMarketPrice: 1075.5, chartPreviousClose: 1060, regularMarketTime: 1760592600 }),
      '2330',
    )
    expect(quote?.price).toBe(1075.5)
    expect(quote?.previousClose).toBe(1060)
    expect(quote?.valuationPrice).toBe(1075.5)
    expect(quote?.traded).toBe(true)
  })

  it('缺現價時視為當日無成交，估值價用昨收', () => {
    const quote = parseChartResponse(chart({ chartPreviousClose: 1060 }), '2330')
    expect(quote?.price).toBeNull()
    expect(quote?.valuationPrice).toBe(1060)
    expect(quote?.traded).toBe(false)
  })

  it('沒有結果時回 null', () => {
    expect(parseChartResponse(JSON.stringify({ chart: { result: [] } }), '2330')).toBeNull()
    expect(parseChartResponse(JSON.stringify({ chart: { result: null } }), '2330')).toBeNull()
    expect(parseChartResponse(JSON.stringify({ chart: {} }), '2330')).toBeNull()
  })

  it('dataDate 由 regularMarketTime 轉成本地日期', () => {
    const time = Math.floor(new Date(2026, 9, 16, 12, 0, 0).getTime() / 1000)
    const quote = parseChartResponse(
      chart({ regularMarketPrice: 10, chartPreviousClose: 9, regularMarketTime: time }),
      '2330',
    )
    expect(quote?.dataDate).toBe('20261016')
  })
})
