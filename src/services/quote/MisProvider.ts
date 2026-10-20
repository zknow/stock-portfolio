import { buildQuote, codesWithoutQuote, parsePrice } from '../../domain/quote'
import type { MarketIndex, Quote, QuoteTarget } from '../../domain/types'
import { getText } from '../http'
import { log } from '../logger'
import type { QuoteProvider } from './QuoteProvider'

export const MIS_ENDPOINT = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp'
/** 發行量加權股價指數在 MIS 的代號 */
export const MIS_INDEX_CODE = 't00'

export function toExCh(target: QuoteTarget): string {
  return `${target.market === 'listing' ? 'tse' : 'otc'}_${target.code}.tw`
}

export function buildMisUrl(targets: QuoteTarget[]): string {
  const channels = [...targets.map(toExCh), toExCh({ code: MIS_INDEX_CODE, market: 'listing' })]
  return `${MIS_ENDPOINT}?ex_ch=${channels.join('|')}&json=1&delay=0`
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

function priceOf(entry: Record<string, unknown>): number | null {
  const trade = entry.trade
  const lastTrade = typeof trade === 'object' && trade !== null ? text((trade as Record<string, unknown>).z) : ''
  return parsePrice(lastTrade) ?? parsePrice(text(entry.z))
}

export interface MisResponse {
  quotes: Quote[]
  index: MarketIndex | null
}

/**
 * 現價解析順序：`trade.z` → `z` → 當日無成交。
 * 錯誤代號或錯誤前綴時 MIS 會在原位置插入佔位物件，以空字串的 `c` 判定並略過。
 */
export function parseMisResponse(body: string): MisResponse {
  const quotes: Quote[] = []
  let index: MarketIndex | null = null

  for (const entry of readEntries(JSON.parse(body))) {
    const code = text(entry.c)
    if (code === '') continue

    if (code === MIS_INDEX_CODE) {
      index = {
        price: priceOf(entry),
        previousClose: parsePrice(text(entry.y)),
        dataDate: text(entry.d),
      }
      continue
    }

    quotes.push(
      buildQuote({
        code,
        price: priceOf(entry),
        previousClose: parsePrice(text(entry.y)),
        dataDate: text(entry.d),
      }),
    )
  }

  return { quotes, index }
}

export const misProvider: QuoteProvider = {
  kind: 'mis',
  async fetchQuotes(targets) {
    const response = await getText(buildMisUrl(targets))
    if (response.status !== 200) throw new Error(`MIS HTTP ${response.status}`)

    const { quotes, index } = parseMisResponse(response.body)
    const missing = codesWithoutQuote(targets, quotes)
    if (missing.length > 0) {
      // MIS 對查不到的代號回傳佔位物件而不是錯誤，不記下來的話畫面會靜默留白
      await log('WARN', 'quote.missing', `MIS 未回傳報價：${missing.join('、')}`)
    }

    return { source: 'mis', quotes, index, fetchedAt: new Date().toISOString() }
  },
}
