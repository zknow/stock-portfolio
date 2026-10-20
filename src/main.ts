import { app, events, init, os, window as neuWindow } from '@neutralinojs/lib'
import type { Icon, MessageBoxChoice } from '@neutralinojs/lib'
import { computePnlRow, computeTotals } from './domain/pnl'
import type { PnlRow } from './domain/pnl'
import type { Holding, Quote, QuoteBatch, QuoteTarget, ReturnDisplay, SortKey } from './domain/types'
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
import { BASE_WIDTH, MIN_SCALE, applyScale, minHeightFor, setZoom, watchResize } from './ui/scale'
import { createTableView, defaultDirection, mapSortKey, sortRows, visibleSortKey } from './ui/TableView'
import type { EditDraft, DraftField, TableView } from './ui/TableView'
import { watchZoom } from './ui/zoom'
import './ui/theme.css'

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
/** 最小視窗尺寸（內容尺寸，CSS px），由內容自然寬度推得（F11、ADR-0016） */
let minSize = { width: 0, height: 0 }

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
    portfolio.returnDisplay,
    portfolio.showCost,
  )
  tally.textContent = `共 ${rows.length} 檔`
  statusBar.render({ status, index: batch?.index ?? null, error: loadError })
  syncMinSize()
}

/** F11：在縮放下限乘上使用者倍率下量測內容的自然寬度，加上目前的垂直捲軸寬度即視窗需要的寬度（ADR-0016） */
function measureMinSize(): { width: number; height: number } {
  const board = root.querySelector<HTMLElement>('.board')
  const form = editControls.form

  // 傳入下限對應的寬度，等同把 --scale 固定在「下限 × 使用者倍率」
  applyScale(BASE_WIDTH * MIN_SCALE)
  // 新增表單可換行（flex-wrap），不會造成水平溢出，量測時排除。
  // 不能用 hidden：那會讓輸入框在輪詢重繪時失焦
  form.style.width = '0'
  root.style.width = 'max-content'

  // 垂直捲軸佔用的寬度（沒有捲軸時為 0）。量測時的高度與實際相同，捲軸出現與否一致
  const gutter = board === null ? 0 : board.offsetWidth - board.clientWidth
  const width = Math.ceil(root.getBoundingClientRect().width + gutter)

  root.style.width = ''
  form.style.width = ''
  applyScale(window.innerWidth)

  return { width, height: minHeightFor(width) }
}

/** 內容改變時重算視窗尺寸；啟動後的第一次量測由 applyWindowSize 負責 */
function syncMinSize(): void {
  const next = measureMinSize()
  if (next.width === minSize.width && next.height === minSize.height) return

  const applied = minSize.width !== 0
  minSize = next
  if (applied) void applyWindowSize()
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

/** F6：切換金額／百分比顯示，並把被隱藏的排序鍵換成同組的另一個（F13） */
function setDisplay(display: ReturnDisplay): void {
  portfolio = { ...portfolio, returnDisplay: display, sortKey: mapSortKey(portfolio.sortKey, display) }
  editControls.setDisplay(display)
  refresh()
  scheduleSave()
}

/** F17：成本欄位開關。目前排序鍵落在被隱藏的欄位時改用今日報酬 */
function setCostVisibility(showCost: boolean): void {
  portfolio = {
    ...portfolio,
    showCost,
    sortKey: visibleSortKey(portfolio.sortKey, portfolio.returnDisplay, showCost),
  }
  editControls.setCost(showCost)
  refresh()
  scheduleSave()
}

/** F11：Ctrl 縮放。套用倍率、重新貼合視窗並寫回偏好（ADR-0018） */
function changeZoom(value: number): void {
  portfolio = { ...portfolio, zoom: setZoom(value) }
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
    onDisplayChange: setDisplay,
    onCostChange: setCostVisibility,
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

/** F11：把視窗調到貼合內容（啟動與內容變動時都套用，ADR-0016） */
async function applyWindowSize(): Promise<void> {
  // minSize 是內容尺寸（CSS px），但 setSize 收的是外框尺寸（實體 px），
  // 兩者差一個 devicePixelRatio 與標題列／邊框，直接用會讓視窗每次啟動都縮小
  const ratio = window.devicePixelRatio || 1
  const outer = await neuWindow.getSize()
  const frameWidth = Math.max((outer.width ?? 0) - window.innerWidth * ratio, 0)
  const frameHeight = Math.max((outer.height ?? 0) - window.innerHeight * ratio, 0)

  // 高度改變會讓垂直捲軸出現或消失，可用寬度跟著差一個捲軸寬；套用後再量一次收斂
  for (let pass = 0; pass < 2; pass++) {
    if (minSize.width === 0) minSize = measureMinSize()

    await neuWindow.setSize({
      width: Math.round(minSize.width * ratio + frameWidth),
      height: Math.round(minSize.height * ratio + frameHeight),
      minWidth: Math.round(minSize.width * ratio + frameWidth),
      minHeight: Math.round(minSize.height * ratio + frameHeight),
    })
    await settleWindow()

    const settled = measureMinSize()
    if (settled.width === minSize.width && settled.height === minSize.height) return
    minSize = settled
  }
}

/** setSize 送出後就回傳，等 window.innerWidth / innerHeight 不再變動才回傳（最多 500 ms） */
async function settleWindow(): Promise<void> {
  let last = ''
  for (let waited = 0; waited < 500; waited += 50) {
    const now = `${window.innerWidth}×${window.innerHeight}`
    if (now === last) return
    last = now
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function main(): Promise<void> {
  await init()

  buildShell()

  const loaded = await load()
  portfolio = loaded.file
  loadError = loaded.error
  setZoom(portfolio.zoom)
  editControls.setEnabled(loadError === null)
  editControls.setDisplay(portfolio.returnDisplay)
  editControls.setCost(portfolio.showCost)
  refresh()

  watchResize()
  watchZoom(changeZoom)

  await applyWindowSize()
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
