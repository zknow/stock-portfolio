import { directionOf, formatPrice, formatRate } from '../domain/format'
import type { Direction } from '../domain/format'
import type { MarketIndex } from '../domain/types'
import { isAfterClose, timeText } from '../services/clock'
import type { QuoteStatus } from '../services/quote/QuoteService'

export interface StatusInput {
  status: QuoteStatus
  index: MarketIndex | null
  /** 非 null 代表 portfolio.json 損毀，已停用設定寫入 */
  error: string | null
}

export interface IndexSummary {
  price: string
  /** 漲跌，含方向符號；缺昨收時為 null */
  change: string | null
  /** 漲跌幅，含括號；缺昨收時為 null */
  rate: string | null
  direction: Direction
}

/** 加權指數的狀態列內容：紅漲綠跌，方向不得只靠顏色（ADR-0007） */
export function indexSummary(index: MarketIndex | null): IndexSummary | null {
  if (index === null || index.price === null) return null

  const price = formatPrice(index.price)
  if (index.previousClose === null) return { price, change: null, rate: null, direction: 'flat' }

  const change = index.price - index.previousClose
  const direction = directionOf(change)
  const rate = `(${formatRate(change / index.previousClose)})`
  if (direction === 'flat') return { price, change: '0.00', rate, direction }

  const arrow = direction === 'up' ? '△' : '▽'
  return { price, change: `${arrow}${formatPrice(Math.abs(change))}`, rate, direction }
}

export interface StatusBar {
  render(input: StatusInput): void
}

const SOURCE_LABEL = { mis: 'MIS 即時', yahoo: 'Yahoo（延遲約 20 分）' }

function span(text: string, className: string): HTMLSpanElement {
  const element = document.createElement('span')
  element.className = className
  element.textContent = text
  return element
}

export function createStatusBar(host: HTMLElement): StatusBar {
  const bar = document.createElement('footer')
  bar.className = 'status'
  host.append(bar)

  return {
    render({ status, index, error }) {
      const parts: HTMLElement[] = []

      if (error !== null) {
        parts.push(span('無法讀取 portfolio.json，已停用設定寫入', 'alert'), span(error, 'alert'))
      }
      if (status.fetchedAt !== null) {
        parts.push(span(`更新於 ${timeText(new Date(status.fetchedAt))}`, ''))
        parts.push(span(SOURCE_LABEL[status.source], status.degraded ? 'alert' : 'source'))
      }
      if (status.phase === 'stopped') {
        parts.push(span(isAfterClose(new Date()) ? '已收盤' : '非交易時段', ''))
      }
      if (status.stale) {
        parts.push(span('非當日資料', 'alert'))
      }

      const summary = indexSummary(index)
      if (summary !== null) {
        const group = document.createElement('span')
        group.className = `index ${summary.direction}`
        group.append(span('加權指數', 'index-label'), span(summary.price, 'index-price'))
        if (summary.change !== null && summary.rate !== null) {
          group.append(span(summary.change, ''), span(summary.rate, ''))
        }
        parts.push(group)
      }

      bar.replaceChildren(...parts)
    },
  }
}
