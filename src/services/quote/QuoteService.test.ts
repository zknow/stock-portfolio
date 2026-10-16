import { describe, expect, it } from 'vitest'
import { FAIL_THRESHOLD, RETRY_INTERVAL_MS, advanceSource, shouldRetryMis } from './QuoteService'
import type { SourceState } from './QuoteService'

const fresh: SourceState = { degraded: false, failCount: 0, lastRetryAt: null }

describe('advanceSource', () => {
  it('未達門檻不降級', () => {
    const first = advanceSource(fresh, 'mis', 'fail', 1000)
    expect(first.state).toEqual({ degraded: false, failCount: 1, lastRetryAt: null })
    expect(first.event).toBeNull()

    const second = advanceSource(first.state, 'mis', 'fail', 2000)
    expect(second.state).toEqual({ degraded: false, failCount: 2, lastRetryAt: null })
    expect(second.event).toBeNull()
  })

  it('連續失敗 3 次降級並記下回試時間', () => {
    let state = fresh
    for (let attempt = 1; attempt < FAIL_THRESHOLD; attempt += 1) {
      state = advanceSource(state, 'mis', 'fail', attempt).state
    }

    const third = advanceSource(state, 'mis', 'fail', 3000)
    expect(third.state).toEqual({ degraded: true, failCount: FAIL_THRESHOLD, lastRetryAt: 3000 })
    expect(third.event).toBe('degrade')
  })

  it('MIS 成功一次即清零，降級中則回報恢復', () => {
    const normal = advanceSource({ degraded: false, failCount: 2, lastRetryAt: null }, 'mis', 'ok', 1000)
    expect(normal.state).toEqual({ degraded: false, failCount: 0, lastRetryAt: null })
    expect(normal.event).toBeNull()

    const recovered = advanceSource({ degraded: true, failCount: 5, lastRetryAt: 1 }, 'mis', 'ok', 9000)
    expect(recovered.state).toEqual({ degraded: false, failCount: 0, lastRetryAt: null })
    expect(recovered.event).toBe('recover')
  })

  it('降級中再失敗只更新回試時間，不重複降級', () => {
    const retry = advanceSource({ degraded: true, failCount: 3, lastRetryAt: 1000 }, 'mis', 'fail', 5000)
    expect(retry.state).toEqual({ degraded: true, failCount: 4, lastRetryAt: 5000 })
    expect(retry.event).toBeNull()
  })

  it('Yahoo 的成敗不改變 MIS 的計數', () => {
    const state: SourceState = { degraded: true, failCount: 3, lastRetryAt: 1000 }
    expect(advanceSource(state, 'yahoo', 'fail', 9000).state).toBe(state)
    expect(advanceSource(state, 'yahoo', 'ok', 9000).state).toBe(state)
  })
})

describe('shouldRetryMis', () => {
  it('未降級時不回試', () => {
    expect(shouldRetryMis(fresh, 10_000_000)).toBe(false)
  })

  it('降級後滿 5 分鐘才回試', () => {
    const state: SourceState = { degraded: true, failCount: 3, lastRetryAt: 1000 }
    expect(shouldRetryMis(state, 1000 + RETRY_INTERVAL_MS - 1)).toBe(false)
    expect(shouldRetryMis(state, 1000 + RETRY_INTERVAL_MS)).toBe(true)
  })
})
