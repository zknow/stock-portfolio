export type Market = 'listing' | 'otc'

export type QuoteSource = 'mis' | 'yahoo'

export interface Holding {
  code: string
  name: string
  market: Market
  shares: number
  averageCost: number
}

/** 報價查詢標的。只需要代號與市場別 */
export interface QuoteTarget {
  code: string
  market: Market
}

export interface Quote {
  code: string
  /** 現價。null 代表當日無成交 */
  price: number | null
  /** 計算用的估值價。當日無成交時等於昨收；兩者皆缺時為 null */
  valuationPrice: number | null
  previousClose: number | null
  traded: boolean
  /** 資料日期，YYYYMMDD */
  dataDate: string
}

export interface SymbolEntry {
  code: string
  name: string
  market: Market
}

export interface QuoteBatch {
  source: QuoteSource
  quotes: Quote[]
  fetchedAt: string
}

/** 可排序的鍵。`marketValue` 不顯示於表格，但為預設排序鍵 */
export const SORT_KEYS = [
  'code',
  'name',
  'shares',
  'averageCost',
  'price',
  'totalReturn',
  'totalReturnRate',
  'todayReturn',
  'todayReturnRate',
  'marketValue',
] as const

export type SortKey = (typeof SORT_KEYS)[number]

export type SortDirection = 'asc' | 'desc'

/** 報酬欄的顯示模式：比率（預設）或金額（F6、ADR-0015） */
export type ReturnDisplay = 'rate' | 'amount'

/** 使用者縮放倍率（F11、ADR-0018）：80%–200%，每格 10%，100% 為預設 */
export const MIN_ZOOM = 0.8
export const MAX_ZOOM = 2
export const ZOOM_STEP = 0.1
export const ZOOM_DEFAULT = 1

export interface UiPreferences {
  sortKey: SortKey
  sortDirection: SortDirection
  returnDisplay: ReturnDisplay
  /** 使用者縮放倍率，乘在等比縮放的因子之上 */
  zoom: number
}
