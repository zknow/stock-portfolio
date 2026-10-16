import { filesystem } from '@neutralinojs/lib'
import type { SymbolEntry } from '../domain/types'
import { isValidCode } from '../domain/validate'
import { dateText } from './clock'
import { ensureDirectory } from './fsutil'
import { getText } from './http'
import { log } from './logger'
import { CONFIG_DIR } from './storage'

export const SYMBOL_PATH = 'config/symbols.json'
export const TWSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'
export const TPEX_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes'

export interface SymbolTable {
  /** 本地日期，YYYY-MM-DD */
  updatedAt: string
  entries: SymbolEntry[]
}

export function emptyTable(): SymbolTable {
  return { updatedAt: '', entries: [] }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readRows(body: string): Record<string, unknown>[] {
  const payload: unknown = JSON.parse(body)
  if (!Array.isArray(payload)) return []
  return payload.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
}

/** TWSE `STOCK_DAY_ALL`。市場別由端點推得 */
export function parseTwse(body: string): SymbolEntry[] {
  return readRows(body).flatMap((row) => {
    const code = text(row.Code)
    const name = text(row.Name)
    return code === '' || name === '' ? [] : [{ code, name, market: 'listing' as const }]
  })
}

/** TPEx `tpex_mainboard_quotes`。市場別由端點推得 */
export function parseTpex(body: string): SymbolEntry[] {
  return readRows(body).flatMap((row) => {
    const code = text(row.SecuritiesCompanyCode)
    const name = text(row.CompanyName)
    return code === '' || name === '' ? [] : [{ code, name, market: 'otc' as const }]
  })
}

/** 代號為唯一鍵，先出現的來源優先 */
export function mergeEntries(groups: SymbolEntry[][]): SymbolEntry[] {
  const merged = new Map<string, SymbolEntry>()
  for (const entries of groups) {
    for (const entry of entries) {
      if (!merged.has(entry.code)) merged.set(entry.code, entry)
    }
  }
  return [...merged.values()]
}

export function readSymbolEntry(value: unknown): SymbolEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const code = record.code
  const name = record.name
  const market = record.market
  if (typeof code !== 'string' || !isValidCode(code)) return null
  if (typeof name !== 'string' || name === '') return null
  if (market !== 'listing' && market !== 'otc') return null
  return { code, name, market }
}

export function parseTable(raw: string): SymbolTable | null {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof payload !== 'object' || payload === null) return null

  const record = payload as Record<string, unknown>
  if (!Array.isArray(record.entries)) return null

  const entries = record.entries.map(readSymbolEntry)
  if (entries.some((entry) => entry === null)) return null

  return {
    updatedAt: text(record.updatedAt),
    entries: entries.filter((entry): entry is SymbolEntry => entry !== null),
  }
}

export function lookup(table: SymbolTable, code: string): SymbolEntry | undefined {
  return table.entries.find((entry) => entry.code === code)
}

export async function save(table: SymbolTable): Promise<void> {
  await ensureDirectory(CONFIG_DIR)
  await filesystem.writeFile(SYMBOL_PATH, `${JSON.stringify(table, null, 2)}\n`)
}

async function read(): Promise<SymbolTable | null> {
  try {
    return parseTable(await filesystem.readFile(SYMBOL_PATH))
  } catch {
    return null
  }
}

export async function refresh(now: Date): Promise<SymbolTable> {
  const [twse, tpex] = await Promise.all([getText(TWSE_URL), getText(TPEX_URL)])
  if (twse.status !== 200) throw new Error(`TWSE HTTP ${twse.status}`)
  if (tpex.status !== 200) throw new Error(`TPEx HTTP ${tpex.status}`)

  const table: SymbolTable = {
    updatedAt: dateText(now),
    entries: mergeEntries([parseTwse(twse.body), parseTpex(tpex.body)]),
  }
  await save(table)
  return table
}

/** 非當日才更新；更新失敗沿用舊快取，不阻擋啟動 */
export async function ensureFresh(now: Date): Promise<SymbolTable> {
  const cached = await read()
  if (cached !== null && cached.updatedAt === dateText(now)) return cached

  try {
    const refreshed = await refresh(now)
    await log('INFO', 'symbols.updated', `${refreshed.entries.length} 筆`)
    return refreshed
  } catch (error) {
    await log('WARN', 'symbols.updateFailed', error)
    return cached ?? emptyTable()
  }
}
