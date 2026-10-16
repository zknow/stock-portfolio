import { describe, expect, it } from 'vitest'
import { buildQuote, isStale, parsePrice } from './quote'

describe('parsePrice', () => {
  it('解析來源的價數字串', () => {
    expect(parsePrice('2420.0000')).toBe(2420)
  })

  it('也接受已經是的數字', () => {
    expect(parsePrice(1075.5)).toBe(1075.5)
  })

  it('無成交、缺值、非數字一律回 null', () => {
    expect(parsePrice('-')).toBeNull()
    expect(parsePrice('—')).toBeNull()
    expect(parsePrice('')).toBeNull()
    expect(parsePrice('abc')).toBeNull()
    expect(parsePrice(undefined)).toBeNull()
    expect(parsePrice(null)).toBeNull()
  })

  it('非正數回 null', () => {
    expect(parsePrice('0')).toBeNull()
    expect(parsePrice('-5')).toBeNull()
    expect(parsePrice(0)).toBeNull()
    expect(parsePrice(Number.NaN)).toBeNull()
    expect(parsePrice(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('buildQuote', () => {
  it('有成交時估值價等於現價', () => {
    expect(buildQuote({ code: '2330', price: 600, previousClose: 590, dataDate: '20261016' })).toEqual({
      code: '2330',
      price: 600,
      valuationPrice: 600,
      previousClose: 590,
      traded: true,
      dataDate: '20261016',
    })
  })

  it('當日無成交時估值價等於昨收', () => {
    const quote = buildQuote({ code: '2330', price: null, previousClose: 590, dataDate: '20261016' })
    expect(quote).toEqual({
      code: '2330',
      price: null,
      valuationPrice: 590,
      previousClose: 590,
      traded: false,
      dataDate: '20261016',
    })
  })

  it('昨收缺失且有現價時，估值價仍為現價', () => {
    const quote = buildQuote({ code: '2330', price: 600, previousClose: null, dataDate: '20261016' })
    expect(quote.valuationPrice).toBe(600)
    expect(quote.traded).toBe(true)
  })

  it('現價與昨收皆缺時估值價為 null', () => {
    const quote = buildQuote({ code: '2330', price: null, previousClose: null, dataDate: '20261016' })
    expect(quote.valuationPrice).toBeNull()
    expect(quote.traded).toBe(false)
  })
})

describe('isStale', () => {
  it('同日不算非當日', () => {
    expect(isStale('20261016', '20261016')).toBe(false)
  })

  it('非同日算非當日', () => {
    expect(isStale('20261015', '20261016')).toBe(true)
  })
})
