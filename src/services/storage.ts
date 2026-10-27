import { filesystem, os } from '@neutralinojs/lib'
import { SORT_KEYS, ZOOM_DEFAULT } from '../domain/types'
import type { Holding, ReturnDisplay, SortKey, UiPreferences } from '../domain/types'
import { isValidCode, isValidCost, isValidShares } from '../domain/validate'
import { ensureDirectory } from './fsutil'
import { errorText, log } from './logger'

export const SCHEMA_VERSION = 1
export const PORTFOLIO_FILE = 'portfolio.json'

/** 舊版資料目錄，僅供首次啟動遷移讀取（ADR-0029） */
const LEGACY_DIR = 'config'

let dataDirectory: Promise<string> | null = null

/** `%APPDATA%\stock-portfolio`（ADR-0029） */
export function dataDir(): Promise<string> {
  dataDirectory ??= os.getEnv('APPDATA').then((base) => `${base}\\stock-portfolio`)
  return dataDirectory
}

export async function dataFile(name: string): Promise<string> {
  return `${await dataDir()}\\${name}`
}

export const DEFAULT_PREFERENCES: UiPreferences = {
  sortKey: 'marketValue',
  sortDirection: 'desc',
  returnDisplay: 'rate',
  showCost: true,
  zoom: ZOOM_DEFAULT,
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

/** 舊檔沒有這個欄位時顯示成本欄位（ADR-0020） */
function readShowCost(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_PREFERENCES.showCost
}

/** 舊檔沒有這個欄位，非有限數值一律回預設；超出上下限的值由 `ui/scale.ts` 的 `setZoom` 夾限（ADR-0018） */
function readZoom(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : ZOOM_DEFAULT
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
    showCost: readShowCost(record.showCost),
    zoom: readZoom(record.zoom),
    holdings: holdings.filter((holding): holding is Holding => holding !== null),
  }
}

export async function load(): Promise<LoadResult> {
  let raw: string
  try {
    raw = await filesystem.readFile(await dataFile(PORTFOLIO_FILE))
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
  await ensureDirectory(await dataDir())
  await filesystem.writeFile(await dataFile(PORTFOLIO_FILE), `${JSON.stringify(file, null, 2)}\n`)
}

async function readOrNull(path: string): Promise<string | null> {
  try {
    return await filesystem.readFile(path)
  } catch {
    return null
  }
}

/** 目標已存在就不動；舊檔只複製、不刪除（ADR-0029） */
export async function migrateLegacyFile(name: string): Promise<void> {
  try {
    const target = await dataFile(name)
    if ((await readOrNull(target)) !== null) return
    const legacy = await readOrNull(`${LEGACY_DIR}/${name}`)
    if (legacy === null) return
    await ensureDirectory(await dataDir())
    await filesystem.writeFile(target, legacy)
    await log('INFO', 'data.migrated', `${LEGACY_DIR}/${name}`)
  } catch (error) {
    await log('ERROR', 'data.migrateFailed', error)
  }
}
