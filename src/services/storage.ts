import { filesystem } from '@neutralinojs/lib'
import { SORT_KEYS } from '../domain/types'
import type { Holding, ReturnDisplay, SortKey, UiPreferences } from '../domain/types'
import { isValidCode, isValidCost, isValidShares } from '../domain/validate'
import { ensureDirectory } from './fsutil'
import { errorText, log } from './logger'

export const SCHEMA_VERSION = 1
export const CONFIG_DIR = 'config'
export const PORTFOLIO_PATH = 'config/portfolio.json'

export const DEFAULT_PREFERENCES: UiPreferences = {
  sortKey: 'marketValue',
  sortDirection: 'desc',
  returnDisplay: 'rate',
}

export interface PortfolioFile extends UiPreferences {
  schemaVersion: number
  holdings: Holding[]
}

export interface LoadResult {
  file: PortfolioFile
  /** 非 null 代表原檔損毀。呼叫端必須拒絕寫入，以免覆蓋原檔 */
  error: string | null
}

export function defaultPortfolio(): PortfolioFile {
  return { schemaVersion: SCHEMA_VERSION, ...DEFAULT_PREFERENCES, holdings: [] }
}

function readHolding(value: unknown): Holding | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const { code, name, market, shares, averageCost } = record
  if (typeof code !== 'string' || !isValidCode(code)) return null
  if (typeof name !== 'string' || name === '') return null
  if (market !== 'listing' && market !== 'otc') return null
  if (typeof shares !== 'number' || !isValidShares(shares)) return null
  if (typeof averageCost !== 'number' || !isValidCost(averageCost)) return null
  return { code, name, market, shares, averageCost }
}

function readSortKey(value: unknown): SortKey {
  return typeof value === 'string' && (SORT_KEYS as readonly string[]).includes(value)
    ? (value as SortKey)
    : DEFAULT_PREFERENCES.sortKey
}

/** 舊檔沒有這個欄位，非法值一律回預設（ADR-0015） */
function readReturnDisplay(value: unknown): ReturnDisplay {
  return value === 'amount' || value === 'rate' ? value : DEFAULT_PREFERENCES.returnDisplay
}

export function parsePortfolio(text: string): PortfolioFile {
  const payload: unknown = JSON.parse(text)
  if (typeof payload !== 'object' || payload === null) throw new Error('portfolio.json 的頂層不是物件')
  const record = payload as Record<string, unknown>

  const version = typeof record.schemaVersion === 'number' ? record.schemaVersion : SCHEMA_VERSION
  if (version > SCHEMA_VERSION) {
    throw new Error(`portfolio.json 的 schemaVersion ${version} 高於支援的 ${SCHEMA_VERSION}`)
  }
  // version < SCHEMA_VERSION：目前只存在版本 1，尚無遷移步驟

  if (!Array.isArray(record.holdings)) throw new Error('portfolio.json 缺少 holdings 陣列')
  const holdings = record.holdings.map(readHolding)
  if (holdings.some((holding) => holding === null)) throw new Error('portfolio.json 含不合法的持股')

  return {
    schemaVersion: SCHEMA_VERSION,
    sortKey: readSortKey(record.sortKey),
    sortDirection: record.sortDirection === 'asc' ? 'asc' : 'desc',
    returnDisplay: readReturnDisplay(record.returnDisplay),
    holdings: holdings.filter((holding): holding is Holding => holding !== null),
  }
}

export async function load(): Promise<LoadResult> {
  let raw: string
  try {
    raw = await filesystem.readFile(PORTFOLIO_PATH)
  } catch {
    return { file: defaultPortfolio(), error: null }
  }

  try {
    return { file: parsePortfolio(raw), error: null }
  } catch (error) {
    const detail = errorText(error)
    await log('ERROR', 'portfolio.corrupt', detail)
    return { file: defaultPortfolio(), error: detail }
  }
}

export async function save(file: PortfolioFile): Promise<void> {
  await ensureDirectory(CONFIG_DIR)
  await filesystem.writeFile(PORTFOLIO_PATH, `${JSON.stringify(file, null, 2)}\n`)
}
