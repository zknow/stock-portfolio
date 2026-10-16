import { describe, expect, it } from 'vitest'
import { errorText, formatLogLine } from './logger'

describe('errorText', () => {
  it('Error 取 message，其餘轉字串', () => {
    expect(errorText(new Error('boom'))).toBe('boom')
    expect(errorText('boom')).toBe('boom')
  })
})

describe('formatLogLine', () => {
  it('單行含時間、層級、事件與細節', () => {
    const line = formatLogLine('WARN', 'quote.degrade', 'MIS 連續失敗 3 次', new Date(2026, 9, 16, 13, 30, 1))
    expect(line).toBe('2026-10-16 13:30:01 WARN quote.degrade MIS 連續失敗 3 次\n')
  })

  it('沒有細節時不留尾隨空白', () => {
    const line = formatLogLine('INFO', 'app.start', '', new Date(2026, 9, 16, 9, 0, 0))
    expect(line).toBe('2026-10-16 09:00:00 INFO app.start\n')
  })
})
