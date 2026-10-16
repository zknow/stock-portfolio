import { buildQuote, parsePrice } from '../../domain/quote'
import type { Quote, QuoteTarget } from '../../domain/types'
import { getText } from '../http'
import type { QuoteProvider } from './QuoteProvider'

export const MIS_ENDPOINT = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp'

export function toExCh(target: QuoteTarget): string {
  return `${target.market === 'listing' ? 'tse' : 'otc'}_${target.code}.tw`
}

export function buildMisUrl(targets: QuoteTarget[]): string {
  return `${MIS_ENDPOINT}?ex_ch=${targets.map(toExCh).join('|')}&json=1&delay=0`
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readEntries(payload: unknown): Record<string, unknown>[] {
  if (typeof payload !== 'object' || payload === null) return []
  const msgArray = (payload as { msgArray?: unknown }).msgArray
  if (!Array.isArray(msgArray)) return []
  return msgArray.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
}

/**
 * 現價解析順序：`trade.z` → `z` → 當日無成交。
 * 錯誤代號或錯誤前綴時 MIS 會在原位置插入佔位物件，以空字串的 `c` 判定並略過。
 */
export function parseMisResponse(body: string): Quote[] {
  const quotes: Quote[] = []

  for (const entry of readEntries(JSON.parse(body))) {
    const code = text(entry.c)
    if (code === '') continue

    const trade = entry.trade
    const lastTrade = typeof trade === 'object' && trade !== null ? text((trade as Record<string, unknown>).z) : ''

    quotes.push(
      buildQuote({
        code,
        price: parsePrice(lastTrade) ?? parsePrice(text(entry.z)),
        previousClose: parsePrice(text(entry.y)),
        dataDate: text(entry.d),
      }),
    )
  }

  return quotes
}

export const misProvider: QuoteProvider = {
  kind: 'mis',
  async fetchQuotes(targets) {
    const response = await getText(buildMisUrl(targets))
    if (response.status !== 200) throw new Error(`MIS HTTP ${response.status}`)
    return { source: 'mis', quotes: parseMisResponse(response.body), fetchedAt: new Date().toISOString() }
  },
}
