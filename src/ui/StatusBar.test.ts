import { describe, expect, it } from 'vitest'
import { indexSummary } from './StatusBar'

describe('indexSummary', () => {
  it('下跌顯示方向 ▽，跌幅帶負號', () => {
    expect(indexSummary({ price: 46662.77, previousClose: 46820.87, dataDate: '20261020' })).toEqual({
      price: '46,662.77',
      change: '▽158.10',
      rate: '(-0.34%)',
      direction: 'down',
    })
  })

  it('上漲顯示方向 △，漲幅帶正號', () => {
    expect(indexSummary({ price: 46820.87, previousClose: 46662.77, dataDate: '20261020' })).toEqual({
      price: '46,820.87',
      change: '△158.10',
      rate: '(+0.34%)',
      direction: 'up',
    })
  })

  it('平盤不帶方向符號', () => {
    expect(indexSummary({ price: 46662.77, previousClose: 46662.77, dataDate: '20261020' })).toEqual({
      price: '46,662.77',
      change: '0.00',
      rate: '(0.00%)',
      direction: 'flat',
    })
  })

  it('缺昨收時只顯示指數本身', () => {
    expect(indexSummary({ price: 46662.77, previousClose: null, dataDate: '20261020' })).toEqual({
      price: '46,662.77',
      change: null,
      rate: null,
      direction: 'flat',
    })
  })

  it('沒有指數或缺現價時不顯示', () => {
    expect(indexSummary(null)).toBeNull()
    expect(indexSummary({ price: null, previousClose: 46820.87, dataDate: '20261020' })).toBeNull()
  })
})
