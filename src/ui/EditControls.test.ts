import { describe, expect, it } from 'vitest'
import type { SymbolEntry } from '../domain/types'
import { parseNumber, resolveCode, toHolding, validateAdd } from './EditControls'
import type { AddInput } from './EditControls'

const TABLE: SymbolEntry[] = [
  { code: '2330', name: '台積電', market: 'listing' },
  { code: '6488', name: '環球晶', market: 'otc' },
]

function lookup(code: string): SymbolEntry | undefined {
  return TABLE.find((entry) => entry.code === code)
}

const exists = (code: string): boolean => code === '2330'

function input(overrides: Partial<AddInput> = {}): AddInput {
  return { code: '6488', name: '環球晶', market: 'otc', shares: '1000', averageCost: '850.5', ...overrides }
}

describe('resolveCode', () => {
  it('格式不符為 invalid，查無為 unknown，命中為 found', () => {
    expect(resolveCode('233', lookup)).toBe('invalid')
    expect(resolveCode('2330-', lookup)).toBe('invalid')
    expect(resolveCode('9999', lookup)).toBe('unknown')
    expect(resolveCode('2330', lookup)).toBe('found')
  })
})

describe('validateAdd', () => {
  it('合法輸入通過', () => {
    expect(validateAdd(input(), exists)).toBeNull()
  })

  it('代號格式不符直接拒絕（F10）', () => {
    expect(validateAdd(input({ code: '233' }), exists)).toBe('代號需為 4–6 位英數字')
  })

  it('代號已存在時提示改用編輯', () => {
    expect(validateAdd(input({ code: '2330' }), exists)).toBe('代號已存在，請改用編輯')
  })

  it('查無代號且未展開逃生門時要求自填名稱', () => {
    expect(validateAdd(input({ code: '9999', name: '' }), exists)).toBe(
      '查無此代號，請展開「強制新增」並自填名稱',
    )
    expect(validateAdd(input({ code: '9999', name: '自訂名稱' }), exists)).toBeNull()
  })

  it('股數必須為正整數，平均成本必須為正數', () => {
    expect(validateAdd(input({ shares: '0' }), exists)).toBe('股數必須為正整數')
    expect(validateAdd(input({ shares: '1.5' }), exists)).toBe('股數必須為正整數')
    expect(validateAdd(input({ shares: '' }), exists)).toBe('股數必須為正整數')
    expect(validateAdd(input({ averageCost: '0' }), exists)).toBe('平均成本必須為正數')
    expect(validateAdd(input({ averageCost: 'abc' }), exists)).toBe('平均成本必須為正數')
  })
})

describe('toHolding', () => {
  it('千分位逗號可接受，名稱去除前後空白', () => {
    expect(toHolding(input({ shares: '1,000', name: ' 環球晶 ' }))).toEqual({
      code: '6488',
      name: '環球晶',
      market: 'otc',
      shares: 1000,
      averageCost: 850.5,
    })
  })

  it('parseNumber 接受逗號與空白，無法解析時為 NaN', () => {
    expect(parseNumber(' 2,420 ')).toBe(2420)
    expect(Number.isNaN(parseNumber('abc'))).toBe(true)
  })
})
