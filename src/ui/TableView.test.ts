import { describe, expect, it } from 'vitest'
import { computePnlRow } from '../domain/pnl'
import type { PnlRow } from '../domain/pnl'
import type { Holding, Quote } from '../domain/types'
import { defaultDirection, columnsFor, mapSortKey, sortRows, visibleSortKey } from './TableView'

function row(code: string, price: number | null, previousClose: number | null): PnlRow {
  const holding: Holding = { code, name: `名${code}`, market: 'listing', shares: 1000, averageCost: 100 }
  const quote: Quote = {
    code,
    price,
    valuationPrice: price ?? previousClose,
    previousClose,
    traded: price !== null,
    dataDate: '20261016',
  }
  return computePnlRow(holding, quote)
}

/** 1066 無報價，用來驗證缺值排序 */
const ROWS: PnlRow[] = [
  row('2330', 2420, 2440),
  row('6488', 902, 923),
  row('1101', 30, 32),
  row('1066', null, null),
]

function codes(rows: PnlRow[]): string[] {
  return rows.map((entry) => entry.holding.code)
}

describe('sortRows', () => {
  it('數字欄依方向排序', () => {
    expect(codes(sortRows(ROWS, 'price', 'desc'))).toEqual(['2330', '6488', '1101', '1066'])
    expect(codes(sortRows(ROWS, 'price', 'asc'))).toEqual(['1101', '6488', '2330', '1066'])
  })

  it('文字欄依方向排序', () => {
    expect(codes(sortRows(ROWS, 'code', 'asc'))).toEqual(['1066', '1101', '2330', '6488'])
    expect(codes(sortRows(ROWS, 'code', 'desc'))).toEqual(['6488', '2330', '1101', '1066'])
  })

  it('缺值一律排最後，升冪降冪皆同', () => {
    for (const direction of ['asc', 'desc'] as const) {
      for (const key of ['price', 'totalReturn', 'todayReturn', 'marketValue'] as const) {
        expect(codes(sortRows(ROWS, key, direction)).at(-1)).toBe('1066')
      }
    }
  })

  it('不修改傳入的陣列', () => {
    const original = codes(ROWS)
    sortRows(ROWS, 'code', 'desc')
    expect(codes(ROWS)).toEqual(original)
  })
})

describe('defaultDirection', () => {
  it('數字欄由大到小，文字欄由小到大', () => {
    expect(defaultDirection('marketValue')).toBe('desc')
    expect(defaultDirection('todayReturnRate')).toBe('desc')
    expect(defaultDirection('code')).toBe('asc')
    expect(defaultDirection('name')).toBe('asc')
  })
})

describe('columnsFor', () => {
  it('兩個報酬欄依顯示模式二選一', () => {
    const keys = (display: 'rate' | 'amount'): string[] => columnsFor(display).map((column) => column.key)

    expect(keys('rate')).toEqual(['code', 'name', 'shares', 'averageCost', 'price', 'totalReturnRate', 'todayReturnRate'])
    expect(keys('amount')).toEqual(['code', 'name', 'shares', 'averageCost', 'price', 'totalReturn', 'todayReturn'])
  })

  it('欄頭文字跟著模式變', () => {
    expect(columnsFor('rate').at(-1)?.label).toBe('今日報酬率')
    expect(columnsFor('amount').at(-1)?.label).toBe('今日報酬金額')
  })

  it('關閉成本時只留代號、名稱、現價、今日報酬', () => {
    const keys = (display: 'rate' | 'amount'): string[] =>
      columnsFor(display, false).map((column) => column.key)

    expect(keys('rate')).toEqual(['code', 'name', 'price', 'todayReturnRate'])
    expect(keys('amount')).toEqual(['code', 'name', 'price', 'todayReturn'])
  })
})

describe('visibleSortKey', () => {
  it('開啟成本時原樣保留', () => {
    expect(visibleSortKey('shares', 'rate', true)).toBe('shares')
    expect(visibleSortKey('totalReturnRate', 'rate', true)).toBe('totalReturnRate')
  })

  it('關閉成本時被隱藏的排序鍵改用今日報酬，方向由呼叫端保留', () => {
    expect(visibleSortKey('shares', 'rate', false)).toBe('todayReturnRate')
    expect(visibleSortKey('averageCost', 'amount', false)).toBe('todayReturn')
    expect(visibleSortKey('marketValue', 'rate', false)).toBe('todayReturnRate')
  })

  it('關閉成本時可見的排序鍵不變', () => {
    expect(visibleSortKey('code', 'rate', false)).toBe('code')
    expect(visibleSortKey('price', 'amount', false)).toBe('price')
    expect(visibleSortKey('todayReturn', 'rate', false)).toBe('todayReturn')
  })
})

describe('mapSortKey', () => {
  it('切換時把被隱藏的報酬鍵換成同組的另一個', () => {
    expect(mapSortKey('totalReturn', 'rate')).toBe('totalReturnRate')
    expect(mapSortKey('totalReturnRate', 'rate')).toBe('totalReturnRate')
    expect(mapSortKey('todayReturnRate', 'amount')).toBe('todayReturn')
    expect(mapSortKey('marketValue', 'amount')).toBe('marketValue')
    expect(mapSortKey('code', 'rate')).toBe('code')
  })
})
