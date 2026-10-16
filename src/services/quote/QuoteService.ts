import { isStale } from '../../domain/quote'
import type { QuoteBatch, QuoteSource, QuoteTarget } from '../../domain/types'
import { dateKey, isTradingTime } from '../clock'
import { log } from '../logger'
import { misProvider } from './MisProvider'
import type { QuoteProvider } from './QuoteProvider'
import { yahooProvider } from './YahooProvider'

export const POLL_INTERVAL_MS = 5000
export const FAIL_THRESHOLD = 3
export const RETRY_INTERVAL_MS = 5 * 60 * 1000

export interface SourceState {
  /** 降級中，使用 Yahoo */
  degraded: boolean
  /** MIS 連續失敗次數 */
  failCount: number
  /** 上次回試 MIS 的時間，未降級時為 null */
  lastRetryAt: number | null
}

export interface SourceTransition {
  state: SourceState
  event: 'degrade' | 'recover' | null
}

export type Outcome = 'ok' | 'fail'

export function advanceSource(
  state: SourceState,
  source: QuoteSource,
  outcome: Outcome,
  now: number,
): SourceTransition {
  if (source === 'yahoo') return { state, event: null }

  if (outcome === 'ok') {
    return {
      state: { degraded: false, failCount: 0, lastRetryAt: null },
      event: state.degraded ? 'recover' : null,
    }
  }

  const failCount = state.failCount + 1
  if (!state.degraded && failCount >= FAIL_THRESHOLD) {
    return { state: { degraded: true, failCount, lastRetryAt: now }, event: 'degrade' }
  }
  return {
    state: { degraded: state.degraded, failCount, lastRetryAt: state.degraded ? now : null },
    event: null,
  }
}

export function shouldRetryMis(state: SourceState, now: number): boolean {
  return state.degraded && now - (state.lastRetryAt ?? 0) >= RETRY_INTERVAL_MS
}

export type SessionPhase = 'polling' | 'stopped'

export interface QuoteStatus {
  phase: SessionPhase
  source: QuoteSource
  degraded: boolean
  /** 最近一次成功抓取的時間 */
  fetchedAt: string | null
  /** 資料日期非當日 */
  stale: boolean
}

export interface QuoteUpdate {
  batch: QuoteBatch | null
  status: QuoteStatus
}

export interface QuoteService {
  start(): Promise<void>
  stop(): Promise<void>
  setTargets(targets: QuoteTarget[]): void
  status(): QuoteStatus
}

export function createQuoteService(onUpdate: (update: QuoteUpdate) => void): QuoteService {
  let targets: QuoteTarget[] = []
  let sourceState: SourceState = { degraded: false, failCount: 0, lastRetryAt: null }
  let batch: QuoteBatch | null = null
  let stale = false
  let phase: SessionPhase = 'stopped'
  let running = false
  let catchUpDone = true
  let timer: number | null = null

  function currentStatus(): QuoteStatus {
    return {
      phase,
      source: sourceState.degraded ? 'yahoo' : 'mis',
      degraded: sourceState.degraded,
      fetchedAt: batch?.fetchedAt ?? null,
      stale,
    }
  }

  function emit(): void {
    onUpdate({ batch, status: currentStatus() })
  }

  async function attempt(source: QuoteSource): Promise<boolean> {
    const provider: QuoteProvider = source === 'mis' ? misProvider : yahooProvider

    try {
      const fetched = await provider.fetchQuotes(targets)
      batch = fetched
      stale = fetched.quotes.some((quote) => isStale(quote.dataDate, dateKey(new Date())))

      const transition = advanceSource(sourceState, source, 'ok', Date.now())
      sourceState = transition.state
      if (transition.event === 'recover') await log('INFO', 'quote.recover', 'MIS 回試成功，恢復主來源')
      return true
    } catch (error) {
      const transition = advanceSource(sourceState, source, 'fail', Date.now())
      sourceState = transition.state
      await log('WARN', 'quote.fail', `${source} 失敗（連續 ${sourceState.failCount} 次）：${error}`)
      if (transition.event === 'degrade') {
        await log('WARN', 'quote.degrade', `MIS 連續失敗 ${sourceState.failCount} 次，改抓 Yahoo`)
      }
      return false
    }
  }

  async function pollOnce(): Promise<void> {
    if (targets.length === 0) {
      emit()
      return
    }

    if (sourceState.degraded && shouldRetryMis(sourceState, Date.now())) {
      if (!(await attempt('mis'))) await attempt('yahoo')
    } else {
      await attempt(sourceState.degraded ? 'yahoo' : 'mis')
    }

    emit()
  }

  async function tick(): Promise<void> {
    if (!running) return

    if (isTradingTime(new Date())) {
      await pollOnce()
    } else if (!catchUpDone) {
      catchUpDone = true
      await pollOnce()
      phase = 'stopped'
      emit()
      await log('INFO', 'quote.closed', '已過 13:30，完成收盤補抓並停止輪詢')
      return
    }

    if (!running) return
    if (isTradingTime(new Date())) timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS)
  }

  return {
    async start() {
      if (running) return
      running = true
      catchUpDone = !isTradingTime(new Date())
      phase = 'polling'
      await log('INFO', 'app.start', '報價服務啟動')
      await pollOnce()

      if (!running) return
      if (isTradingTime(new Date())) {
        timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS)
      } else {
        phase = 'stopped'
        emit()
      }
    },

    async stop() {
      if (!running) return
      running = false
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      phase = 'stopped'
      await log('INFO', 'app.stop', '報價服務停止')
    },

    setTargets(next) {
      targets = next
    },

    status: currentStatus,
  }
}
