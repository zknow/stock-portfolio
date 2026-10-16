import { isAfterClose, timeText } from '../services/clock'
import type { QuoteStatus } from '../services/quote/QuoteService'

export interface StatusInput {
  status: QuoteStatus
  /** 非 null 代表 portfolio.json 損毀，已停用設定寫入 */
  error: string | null
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
    render({ status, error }) {
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

      bar.replaceChildren(...parts)
    },
  }
}
