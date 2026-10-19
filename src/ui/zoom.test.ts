import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_DEFAULT } from '../domain/types'
import { keyZoom, resolveZoom, wheelZoom } from './zoom'

describe('keyZoom', () => {
  it('Ctrl+= 與 Ctrl++ 放大，Ctrl+- 縮小', () => {
    expect(keyZoom('=')).toEqual({ kind: 'step', steps: 1 })
    expect(keyZoom('+')).toEqual({ kind: 'step', steps: 1 })
    expect(keyZoom('-')).toEqual({ kind: 'step', steps: -1 })
    expect(keyZoom('_')).toEqual({ kind: 'step', steps: -1 })
  })

  it('Ctrl+0 回預設', () => {
    expect(keyZoom('0')).toEqual({ kind: 'reset' })
  })

  it('其他鍵不處理', () => {
    expect(keyZoom('a')).toBeNull()
    expect(keyZoom('1')).toBeNull()
    expect(keyZoom('Escape')).toBeNull()
  })
})

describe('wheelZoom', () => {
  it('往上放大、往下縮小', () => {
    expect(wheelZoom(-120)).toEqual({ kind: 'step', steps: 1 })
    expect(wheelZoom(120)).toEqual({ kind: 'step', steps: -1 })
  })

  it('沒有位移不處理', () => {
    expect(wheelZoom(0)).toBeNull()
  })
})

describe('resolveZoom', () => {
  it('跳級距並夾在上下限', () => {
    expect(resolveZoom(1, { kind: 'step', steps: 1 })).toBe(1.1)
    expect(resolveZoom(MAX_ZOOM, { kind: 'step', steps: 1 })).toBe(MAX_ZOOM)
    expect(resolveZoom(MIN_ZOOM, { kind: 'step', steps: -1 })).toBe(MIN_ZOOM)
  })

  it('歸零回預設倍率', () => {
    expect(resolveZoom(1.7, { kind: 'reset' })).toBe(ZOOM_DEFAULT)
  })
})
