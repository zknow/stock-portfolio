import { app, events, init, os, window as neuWindow } from '@neutralinojs/lib'
import type { Icon, MessageBoxChoice } from '@neutralinojs/lib'
import { computePnlRow, computeTotals } from './domain/pnl'
import type { PnlRow } from './domain/pnl'
import type { Holding, Quote, QuoteBatch, QuoteTarget, SortKey } from './domain/types'
import { isValidCost, isValidShares } from './domain/validate'
import { log } from './services/logger'
import { createQuoteService } from './services/quote/QuoteService'
import type { QuoteService, QuoteStatus } from './services/quote/QuoteService'
import { defaultPortfolio, load, save } from './services/storage'
import type { PortfolioFile } from './services/storage'
import { emptyTable, ensureFresh, lookup as lookupSymbol } from './services/symbolTable'
import type { SymbolTable } from './services/symbolTable'
import { createEditControls, parseNumber } from './ui/EditControls'
import type { EditControls, EditMode } from './ui/EditControls'
import { createStatusBar } from './ui/StatusBar'
import type { StatusBar } from './ui/StatusBar'
import { applyScale, watchResize } from './ui/scale'
import { createTableView, defaultDirection, sortRows } from './ui/TableView'
import type { EditDraft, DraftField, TableView } from './ui/TableView'
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
let symbols: SymbolTable = emptyTable()
let mode: EditMode = 'view'
let draft: EditDraft | null = null
let editError: string | null = null
let saveTimer: number | null = null

let table: TableView
let statusBar: StatusBar
let editControls: EditControls
let tally: HTMLSpanElement
let service: QuoteService | null = null

function targets(): QuoteTarget[] {
  return portfolio.holdings.map(({ code, market }) => ({ code, market }))
}

function findHolding(code: string): Holding | undefined {
  return portfolio.holdings.find((holding) => holding.code === code)
}

function setHoldings(holdings: Holding[]): void {
  portfolio = { ...portfolio, holdings }
}

function refresh(): void {
  const quotes = new Map<string, Quote>(
    (batch?.quotes ?? []).map((quote): [string, Quote] => [quote.code, quote]),
  )
  const rows: PnlRow[] = portfolio.holdings.map((holding) =>
    computePnlRow(holding, quotes.get(holding.code) ?? null),
  )
  const { sortKey, sortDirection } = portfolio

  table.render(
    sortRows(rows, sortKey, sortDirection),
    computeTotals(rows),
    { key: sortKey, direction: sortDirection },
    { mode, draft, error: editError },
  )
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

/** F8：模式切換入口為工具列切換鈕，切換時放棄進行中的編輯 */
function setMode(next: EditMode): void {
  mode = next
  draft = null
  editError = null
  editControls.setMode(next)
  refresh()
}

function startEdit(code: string): void {
  // 一次只編輯一列：已有草稿時不切換，避免默默丟掉輸入中的內容
  if (draft !== null && draft.code !== code) return

  const holding = findHolding(code)
  if (holding === undefined) return

  draft = { code, shares: String(holding.shares), averageCost: String(holding.averageCost) }
  editError = null
  refresh()
}

function changeDraft(code: string, field: DraftField, value: string): void {
  if (draft === null || draft.code !== code) return
  draft = field === 'shares' ? { ...draft, shares: value } : { ...draft, averageCost: value }
  editError = null
}

function cancelEdit(): void {
  draft = null
  editError = null
  refresh()
}

/** F4：就地編輯的提交。驗證失敗時保留輸入內容 */
async function commitEdit(code: string): Promise<void> {
  if (draft === null || draft.code !== code) return

  const shares = parseNumber(draft.shares)
  const averageCost = parseNumber(draft.averageCost)
  const error = !isValidShares(shares)
    ? '股數必須為正整數'
    : !isValidCost(averageCost)
      ? '平均成本必須為正數'
      : null
  if (error !== null) {
    editError = error
    refresh()
    return
  }

  setHoldings(
    portfolio.holdings.map((holding) =>
      holding.code === code ? { ...holding, shares, averageCost } : holding,
    ),
  )
  draft = null
  editError = null
  refresh()
  await persist()
}

/** F2：新增成功後立即納入輪詢清單，並補抓一次使新列立即有報價 */
async function addHolding(holding: Holding): Promise<string | null> {
  if (loadError !== null) return '無法讀取 portfolio.json，已停用編輯'

  setHoldings([...portfolio.holdings, holding])
  refresh()
  await persist()

  service?.setTargets(targets())
  await service?.refreshOnce()
  return null
}

/** F3：刪除需二次確認，確認對話框顯示代號與名稱 */
async function removeHolding(code: string): Promise<void> {
  const holding = findHolding(code)
  if (holding === undefined || loadError !== null) return

  // @neutralinojs/lib 的 enum 只有型別、執行期是 undefined，因此傳字面值（值與 enum 相同）
  const choice = await os.showMessageBox(
    `刪除 ${holding.code} ${holding.name}？`,
    '此動作不可復原。',
    'YES_NO' as MessageBoxChoice,
    'WARNING' as Icon,
  )
  if (choice.toLowerCase() !== 'yes') return

  setHoldings(portfolio.holdings.filter((entry) => entry.code !== code))
  if (draft?.code === code) {
    draft = null
    editError = null
  }
  refresh()
  await persist()
  service?.setTargets(targets())
}

function buildShell(): void {
  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'

  const title = document.createElement('h1')
  title.textContent = '台股庫存'

  tally = document.createElement('span')
  tally.className = 'tally'

  editControls = createEditControls({
    lookup: (code) => lookupSymbol(symbols, code),
    exists: (code) => findHolding(code) !== undefined,
    submit: addHolding,
    onModeChange: setMode,
  })

  toolbar.append(title, tally, editControls.toolbar)
  root.append(toolbar, editControls.form)

  table = createTableView(root, {
    sort: sortBy,
    startEdit,
    changeDraft,
    commit: (code) => void commitEdit(code),
    cancelEdit,
    remove: (code) => void removeHolding(code),
    requestAdd: () => editControls.openAdd(),
  })
  statusBar = createStatusBar(root)
}

/** F14：視窗尺寸需套用最小尺寸限制 */
async function applyWindowSize(): Promise<void> {
  // windowWidth / windowHeight 是內容尺寸（CSS px），但 setSize 收的是外框尺寸（實體 px），
  // 兩者差一個 devicePixelRatio 與標題列／邊框，直接用會讓視窗每次啟動都縮小
  const ratio = window.devicePixelRatio || 1
  const outer = await neuWindow.getSize()
  const frameWidth = Math.max((outer.width ?? 0) - window.innerWidth * ratio, 0)
  const frameHeight = Math.max((outer.height ?? 0) - window.innerHeight * ratio, 0)
  const width = Math.max(portfolio.windowWidth, MIN_WIDTH)
  const height = Math.max(portfolio.windowHeight, MIN_HEIGHT)

  await neuWindow.setSize({
    width: Math.round(width * ratio + frameWidth),
    height: Math.round(height * ratio + frameHeight),
    minWidth: Math.round(MIN_WIDTH * ratio + frameWidth),
    minHeight: Math.round(MIN_HEIGHT * ratio + frameHeight),
  })

  // setSize 送出後就回傳，實際尺寸晚一點才反映到 window.innerWidth；
  // 不等它穩定，啟動記錄會記到調整前的舊尺寸
  for (let waited = 0; waited < 500; waited += 50) {
    if (window.innerWidth === width && window.innerHeight === height) break
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function main(): Promise<void> {
  await init()

  buildShell()
  applyScale(window.innerWidth)

  const loaded = await load()
  portfolio = loaded.file
  loadError = loaded.error
  editControls.setEnabled(loadError === null)
  refresh()

  watchResize()
  // 要等 applyWindowSize 套用完才開始記錄尺寸：框架建立視窗的初始尺寸會先觸發 resize，
  // 那時若就寫回 portfolio，applyWindowSize 會反過來套用初始尺寸，偏好等於每次被蓋掉
  let sizeSettled = false
  window.addEventListener('resize', () => {
    if (!sizeSettled) return
    portfolio = { ...portfolio, windowWidth: window.innerWidth, windowHeight: window.innerHeight }
    scheduleSave()
  })

  await applyWindowSize()
  sizeSettled = true
  symbols = await ensureFresh(new Date())
  await log('INFO', 'app.launch', `${window.innerWidth}×${window.innerHeight}`)

  service = createQuoteService((update) => {
    batch = update.batch
    status = update.status
    refresh()
  })
  service.setTargets(targets())

  await events.on('windowClose', async () => {
    await flushSave()
    await service?.stop()
    await log('INFO', 'app.exit')
    await app.exit()
  })

  await service.start()
}

main().catch((error: unknown) => {
  root.textContent = `啟動失敗：${String(error)}`
})
