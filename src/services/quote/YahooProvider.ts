import { buildQuote, parsePrice } from '../../domain/quote'
import type { Quote, QuoteTarget } from '../../domain/types'
import { dateKey } from '../clock'
import { getText } from '../http'
import type { QuoteProvider } from './QuoteProvider'

export const YAHOO_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart'

export function toYahooSymbol(target: QuoteTarget): string {
  return `${target.code}${target.market === 'listing' ? '.TW' : '.TWO'}`
}

export function buildChartUrl(target: QuoteTarget): string {
  return `${YAHOO_ENDPOINT}/${toYahooSymbol(target)}?interval=1d&range=1d`
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

export const yahooProvider: QuoteProvider = {
  kind: 'yahoo',
  async fetchQuotes(targets) {
    const quotes = await Promise.all(
      targets.map(async (target) => {
        const response = await getText(buildChartUrl(target))
        if (response.status !== 200) throw new Error(`Yahoo HTTP ${response.status}`)
        return parseChartResponse(response.body, target.code)
      }),
    )

    return {
      source: 'yahoo',
      quotes: quotes.filter((quote): quote is Quote => quote !== null),
      fetchedAt: new Date().toISOString(),
    }
  },
}
