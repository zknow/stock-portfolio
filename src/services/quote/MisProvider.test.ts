import { describe, expect, it } from 'vitest'
import { buildMisUrl, parseMisResponse, toExCh } from './MisProvider'

function body(msgArray: unknown[]): string {
  return JSON.stringify({ rtcode: '0000', rtmessage: 'OK', msgArray })
}

const FULL = {
  c: '2330',
  n: '台積電',
  ex: 'tse',
  z: '1075.0000',
  y: '1060.0000',
  t: '13:30:00',
  d: '20261016',
  v: '12345',
  trade: { z: '1075.0000' },
}

describe('toExCh', () => {
  it('上市加 tse_，上櫃加 otc_', () => {
    expect(toExCh({ code: '2330', market: 'listing' })).toBe('tse_2330.tw')
    expect(toExCh({ code: '6488', market: 'otc' })).toBe('otc_6488.tw')
  })
})

describe('buildMisUrl', () => {
  it('批次以 | 串接', () => {
    expect(
      buildMisUrl([
        { code: '2330', market: 'listing' },
        { code: '6488', market: 'otc' },
      ]),
    ).toBe('https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw|otc_6488.tw&json=1&delay=0')
  })
})

describe('parseMisResponse', () => {
  it('trade.z 優先於 z', () => {
    const quotes = parseMisResponse(body([{ ...FULL, z: '1070.0000' }]))
    expect(quotes[0]?.price).toBe(1075)
  })

  it('沒有 trade 物件時用 z', () => {
    const quotes = parseMisResponse(body([{ c: '2330', y: '1060.0000', z: '1075.0000', d: '20261016' }]))
    expect(quotes[0]?.price).toBe(1075)
  })

  it('trade.z 為 "-" 時退回 z', () => {
    const quotes = parseMisResponse(body([{ ...FULL, trade: { z: '-' } }]))
    expect(quotes[0]?.price).toBe(1075)
  })

  it('z 為 "-" 且無 trade 物件時視為當日無成交，估值價用昨收', () => {
    const quotes = parseMisResponse(body([{ c: '2330', n: '台積電', z: '-', y: '1060.0000', v: '0', d: '20261016' }]))
    expect(quotes[0]).toEqual({
      code: '2330',
      price: null,
      valuationPrice: 1060,
      previousClose: 1060,
      traded: false,
      dataDate: '20261016',
    })
  })

  it('昨收為 "-" 時估值價與昨收都為 null', () => {
    const quotes = parseMisResponse(body([{ c: '2330', z: '-', y: '-', d: '20261016' }]))
    expect(quotes[0]?.valuationPrice).toBeNull()
    expect(quotes[0]?.previousClose).toBeNull()
  })

  it('c 為空字串的佔位物件被略過，不影響同批次其他代號', () => {
    const quotes = parseMisResponse(body([{ tv: '-', s: '-', c: '', z: '-' }, { ...FULL, c: '6488' }]))
    expect(quotes).toHaveLength(1)
    expect(quotes[0]?.code).toBe('6488')
  })

  it('空 msgArray 或缺少 msgArray 時回空陣列', () => {
    expect(parseMisResponse(JSON.stringify({ rtcode: '0000', msgArray: [] }))).toEqual([])
    expect(parseMisResponse(JSON.stringify({ rtcode: '0000' }))).toEqual([])
  })

  it('缺少 d 時 dataDate 為空字串', () => {
    expect(parseMisResponse(body([{ c: '2330', z: '10', y: '9' }]))[0]?.dataDate).toBe('')
  })
})
