import { app, events, init, window as neuWindow } from '@neutralinojs/lib'
import { computePnlRow, computeTotals } from './domain/pnl'
import type { PnlRow } from './domain/pnl'
import type { Quote, QuoteBatch, QuoteTarget, SortKey } from './domain/types'
import { log } from './services/logger'
import { createQuoteService } from './services/quote/QuoteService'
import type { QuoteService, QuoteStatus } from './services/quote/QuoteService'
import { defaultPortfolio, load, save } from './services/storage'
import type { PortfolioFile } from './services/storage'
import { ensureFresh } from './services/symbolTable'
import { createStatusBar } from './ui/StatusBar'
import type { StatusBar } from './ui/StatusBar'
import { applyScale, watchResize } from './ui/scale'
import { createTableView, defaultDirection, sortRows } from './ui/TableView'
import type { TableView } from './ui/TableView'
import './ui/theme.css'

/** 與 neutralino.config.json 的 minWidth / minHeight 一致（F14） */
const MIN_WIDTH = 700
const MIN_HEIGHT = 480
const SAVE_DELAY_MS = 500

const root = (() => {
  const element = document.querySelector<HTMLDivElement>('#app')
  if (!element) throw new Error('#app not found')
  return element
})()

let portfolio: PortfolioFile = defaultPortfolio()
/** 非 null 代表 portfolio.json 損毀，拒絕覆寫原檔（§8） */
let loadError: string | null = null
let batch: QuoteBatch | null = null
let status: QuoteStatus = {
  phase: 'stopped',
  source: 'mis',
  degraded: false,
  fetchedAt: null,
  stale: false,
}
let saveTimer: number | null = null

let table: TableView
let statusBar: StatusBar
let tally: HTMLSpanElement
let service: QuoteService

function targets(): QuoteTarget[] {
  return portfolio.holdings.map(({ code, market }) => ({ code, market }))
}

function refresh(): void {
  const quotes = new Map<string, Quote>(
    (batch?.quotes ?? []).map((quote): [string, Quote] => [quote.code, quote]),
  )
  const rows: PnlRow[] = portfolio.holdings.map((holding) =>
    computePnlRow(holding, quotes.get(holding.code) ?? null),
  )
  const { sortKey, sortDirection } = portfolio

  table.render(sortRows(rows, sortKey, sortDirection), computeTotals(rows), {
    key: sortKey,
    direction: sortDirection,
  })
  tally.textContent = `共 ${rows.length} 檔`
  statusBar.render({ status, error: loadError })
}

function sortBy(key: SortKey): void {
  const direction =
    portfolio.sortKey === key
      ? portfolio.sortDirection === 'asc'
        ? 'desc'
        : 'asc'
      : defaultDirection(key)

  portfolio = { ...portfolio, sortKey: key, sortDirection: direction }
  refresh()
  scheduleSave()
}

async function persist(): Promise<void> {
  try {
    await save(portfolio)
  } catch (error) {
    await log('ERROR', 'portfolio.saveFailed', error)
  }
}

/** 節流寫入，避免拖拉視窗時連續寫檔 */
function scheduleSave(): void {
  if (loadError !== null || saveTimer !== null) return
  saveTimer = window.setTimeout(() => {
    saveTimer = null
    void persist()
  }, SAVE_DELAY_MS)
}

async function flushSave(): Promise<void> {
  if (saveTimer === null) return
  window.clearTimeout(saveTimer)
  saveTimer = null
  await persist()
}

function buildShell(): void {
  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'

  const title = document.createElement('h1')
  title.textContent = '台股庫存'

  tally = document.createElement('span')
  tally.className = 'tally'

  toolbar.append(title, tally)

  root.append(toolbar)
  table = createTableView(root, sortBy)
  statusBar = createStatusBar(root)
}

/** F14：視窗尺寸需套用最小尺寸限制 */
async function applyWindowSize(): Promise<void> {
  await neuWindow.setSize({
    width: Math.max(portfolio.windowWidth, MIN_WIDTH),
    height: Math.max(portfolio.windowHeight, MIN_HEIGHT),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
  })
}

async function main(): Promise<void> {
  await init()

  buildShell()
  applyScale(window.innerWidth)

  const loaded = await load()
  portfolio = loaded.file
  loadError = loaded.error
  refresh()

  watchResize()
  window.addEventListener('resize', () => {
    portfolio = { ...portfolio, windowWidth: window.innerWidth, windowHeight: window.innerHeight }
    scheduleSave()
  })

  await applyWindowSize()
  await ensureFresh(new Date())
  await log('INFO', 'app.launch', `${window.innerWidth}×${window.innerHeight}`)

  service = createQuoteService((update) => {
    batch = update.batch
    status = update.status
    refresh()
  })
  service.setTargets(targets())

  await events.on('windowClose', async () => {
    await flushSave()
    await service.stop()
    await log('INFO', 'app.exit')
    await app.exit()
  })

  await service.start()
}

main().catch((error: unknown) => {
  root.textContent = `啟動失敗：${String(error)}`
})
