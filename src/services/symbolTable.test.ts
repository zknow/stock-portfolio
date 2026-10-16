import { describe, expect, it } from 'vitest'
import { emptyTable, lookup, mergeEntries, parseTable, parseTpex, parseTwse } from './symbolTable'

const TWSE = JSON.stringify([
  { Date: '1151015', Code: '2330', Name: '台積電', ClosingPrice: '1075.00' },
  { Date: '1151015', Code: '0050', Name: '元大台灣50', ClosingPrice: '199.00' },
  { Date: '1151015', Code: '', Name: '' },
])

const TPEX = JSON.stringify([
  { Date: '1151015', SecuritiesCompanyCode: '6488', CompanyName: '環球晶', Close: '432.50' },
  { Date: '1151015', SecuritiesCompanyCode: '8069', CompanyName: '元太', Close: '176.00' },
])

describe('parseTwse', () => {
  it('取 Code 與 Name，市場別為上市', () => {
    expect(parseTwse(TWSE)).toEqual([
      { code: '2330', name: '台積電', market: 'listing' },
      { code: '0050', name: '元大台灣50', market: 'listing' },
    ])
  })

  it('非陣列時回空陣列', () => {
    expect(parseTwse('{}')).toEqual([])
  })
})

describe('parseTpex', () => {
  it('取 SecuritiesCompanyCode 與 CompanyName，市場別為上櫃', () => {
    expect(parseTpex(TPEX)).toEqual([
      { code: '6488', name: '環球晶', market: 'otc' },
      { code: '8069', name: '元太', market: 'otc' },
    ])
  })
})

describe('mergeEntries', () => {
  it('代號為唯一鍵，先出現的來源優先', () => {
    const merged = mergeEntries([parseTwse(TWSE), parseTpex(TPEX)])
    expect(merged).toHaveLength(4)
    expect(merged[0]).toEqual({ code: '2330', name: '台積電', market: 'listing' })

    const duplicated = mergeEntries([[{ code: '2330', name: '重複', market: 'otc' }], parseTwse(TWSE)])
    expect(duplicated).toEqual([
      { code: '2330', name: '重複', market: 'otc' },
      { code: '0050', name: '元大台灣50', market: 'listing' },
    ])
  })
})

describe('parseTable', () => {
  it('讀出快取', () => {
    const raw = JSON.stringify({
      updatedAt: '2026-10-16',
      entries: [{ code: '2330', name: '台積電', market: 'listing' }],
    })
    const table = parseTable(raw)
    expect(table?.updatedAt).toBe('2026-10-16')
    expect(table?.entries).toEqual([{ code: '2330', name: '台積電', market: 'listing' }])
  })

  it('毀損或格式不符時回 null', () => {
    expect(parseTable('不是 JSON')).toBeNull()
    expect(parseTable('{}')).toBeNull()
    expect(parseTable(JSON.stringify({ updatedAt: '2026-10-16', entries: [{ code: '23' }] }))).toBeNull()
    expect(parseTable(JSON.stringify({ updatedAt: '2026-10-16', entries: [] }))?.entries).toEqual([])
  })
})

describe('lookup', () => {
  it('查不到代號時回 undefined', () => {
    const table = {
      updatedAt: '2026-10-16',
      entries: [{ code: '2330', name: '台積電', market: 'listing' as const }],
    }
    expect(lookup(table, '2330')?.name).toBe('台積電')
    expect(lookup(table, '9999')).toBeUndefined()
    expect(lookup(emptyTable(), '2330')).toBeUndefined()
  })
})
