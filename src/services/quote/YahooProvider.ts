import { buildQuote, parsePrice } from '../../domain/quote'
import type { MarketIndex, Quote, QuoteTarget } from '../../domain/types'
import { dateKey } from '../clock'
import { getText } from '../http'
import type { QuoteProvider } from './QuoteProvider'

export const YAHOO_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart'
/** 發行量加權股價指數在 Yahoo 的代號 */
export const YAHOO_INDEX_SYMBOL = '^TWII'

export function toYahooSymbol(target: QuoteTarget): string {
  return `${target.code}${target.market === 'listing' ? '.TW' : '.TWO'}`
}

function chartUrl(symbol: string): string {
  return `${YAHOO_ENDPOINT}/${symbol}?interval=1d&range=1d`
}

export function buildChartUrl(target: QuoteTarget): string {
  return chartUrl(toYahooSymbol(target))
}

export function buildIndexUrl(): string {
  return chartUrl(YAHOO_INDEX_SYMBOL)
}

function readMeta(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== 'object' || payload === null) return null
  const chart = (payload as { chart?: unknown }).chart
  if (typeof chart !== 'object' || chart === null) return null
  const result = (chart as { result?: unknown }).result
  if (!Array.isArray(result) || result.length === 0) return null
  const first: unknown = result[0]
  if (typeof first !== 'object' || first === null) return null
  const meta = (first as { meta?: unknown }).meta
  return typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>) : null
}

export function parseChartResponse(body: string, code: string): Quote | null {
  const meta = readMeta(JSON.parse(body))
  if (meta === null) return null

  const marketTime = meta.regularMarketTime
  const dataDate =
    typeof marketTime === 'number' ? dateKey(new Date(marketTime * 1000)) : dateKey(new Date())

  return buildQuote({
    code,
    price: parsePrice(meta.regularMarketPrice as number | undefined),
    previousClose: parsePrice(meta.chartPreviousClose as number | undefined),
    dataDate,
  })
}

/** 指數只是輔助資訊，取不到時不影響持股報價 */
async function fetchIndex(): Promise<MarketIndex | null> {
  const response = await getText(buildIndexUrl())
  if (response.status !== 200) return null

  const quote = parseChartResponse(response.body, YAHOO_INDEX_SYMBOL)
  if (quote === null) return null
  return { price: quote.price, previousClose: quote.previousClose, dataDate: quote.dataDate }
}

export const yahooProvider: QuoteProvider = {
  kind: 'yahoo',
  async fetchQuotes(targets) {
    const [quotes, index] = await Promise.all([
      Promise.all(
        targets.map(async (target) => {
          const response = await getText(buildChartUrl(target))
          if (response.status !== 200) throw new Error(`Yahoo HTTP ${response.status}`)
          return parseChartResponse(response.body, target.code)
        }),
      ),
      fetchIndex(),
    ])

    return {
      source: 'yahoo',
      quotes: quotes.filter((quote): quote is Quote => quote !== null),
      index,
      fetchedAt: new Date().toISOString(),
    }
  },
}
