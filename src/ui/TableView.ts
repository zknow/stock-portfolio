import { MISSING, directionOf, formatAmount, formatPrice, formatRate, formatShares } from '../domain/format'
import type { Direction } from '../domain/format'
import type { PnlRow, PnlTotals } from '../domain/pnl'
import type { ReturnDisplay, SortDirection, SortKey } from '../domain/types'
import type { EditMode } from './EditControls'

interface Column {
  key: SortKey
  label: string
}

/** F1：順序即此處的順序。成本欄位整組受 F17 的開關控制 */
const IDENTITY_COLUMNS: Column[] = [
  { key: 'code', label: '代號' },
  { key: 'name', label: '名稱' },
]

const COST_COLUMNS: Column[] = [
  { key: 'shares', label: '股數' },
  { key: 'averageCost', label: '平均成本' },
]

const PRICE_COLUMN: Column = { key: 'price', label: '現價' }

const RETURN_COLUMNS: Record<ReturnDisplay, [Column, Column]> = {
  rate: [
    { key: 'totalReturnRate', label: '總報酬率' },
    { key: 'todayReturnRate', label: '今日報酬率' },
  ],
  amount: [
    { key: 'totalReturn', label: '總報酬金額' },
    { key: 'todayReturn', label: '今日報酬金額' },
  ],
}

/** F17：關閉成本時只留代號、名稱、現價、今日報酬 */
export function columnsFor(display: ReturnDisplay, showCost = true): Column[] {
  const [total, today] = RETURN_COLUMNS[display]
  return [
    ...IDENTITY_COLUMNS,
    ...(showCost ? COST_COLUMNS : []),
    PRICE_COLUMN,
    ...(showCost ? [total, today] : [today]),
  ]
}

/** 同一個指標的兩個排序鍵：金額與比率 */
const RETURN_KEY_PAIRS: ReadonlyArray<readonly [SortKey, SortKey]> = [
  ['totalReturn', 'totalReturnRate'],
  ['todayReturn', 'todayReturnRate'],
]

/** 切換顯示模式時，被隱藏的排序鍵換成同組的另一個，方向不變（F13、ADR-0015） */
export function mapSortKey(key: SortKey, display: ReturnDisplay): SortKey {
  const pair = RETURN_KEY_PAIRS.find((keys) => keys.includes(key))
  if (pair === undefined) return key
  return display === 'rate' ? pair[1] : pair[0]
}

/** 關閉成本時會一起消失的排序鍵（F17） */
const COST_SORT_KEYS: ReadonlySet<SortKey> = new Set<SortKey>([
  'shares',
  'averageCost',
  'totalReturn',
  'totalReturnRate',
  'marketValue',
])

/** 切換成本顯示時，若排序鍵落在被隱藏的欄位就改用今日報酬，方向不變（F17） */
export function visibleSortKey(key: SortKey, display: ReturnDisplay, showCost: boolean): SortKey {
  return showCost || !COST_SORT_KEYS.has(key) ? key : mapSortKey('todayReturn', display)
}

/** 數字欄：決定欄頭對齊與首次點擊的方向。`marketValue` 不顯示但仍為數字欄 */
const NUMERIC_KEYS: ReadonlySet<SortKey> = new Set<SortKey>([
  'shares',
  'averageCost',
  'price',
  'totalReturn',
  'totalReturnRate',
  'todayReturn',
  'todayReturnRate',
  'marketValue',
])

const SORT_VALUES: Record<SortKey, (row: PnlRow) => number | string | null> = {
  code: (row) => row.holding.code,
  name: (row) => row.holding.name,
  shares: (row) => row.holding.shares,
  averageCost: (row) => row.holding.averageCost,
  price: (row) => row.quote?.price ?? null,
  totalReturn: (row) => row.totalReturn,
  totalReturnRate: (row) => row.totalReturnRate,
  todayReturn: (row) => row.todayReturn,
  todayReturnRate: (row) => row.todayReturnRate,
  marketValue: (row) => row.marketValue,
}

export interface SortState {
  key: SortKey
  direction: SortDirection
}

/** 就地編輯中的草稿。以字串保存，保留使用者輸入的原貌（F4） */
export interface EditDraft {
  code: string
  shares: string
  averageCost: string
}

export type DraftField = 'shares' | 'averageCost'

export interface TableEdit {
  mode: EditMode
  draft: EditDraft | null
  /** 就地編輯的驗證錯誤，null 代表無誤 */
  error: string | null
}

export interface TableHandlers {
  sort(key: SortKey): void
  startEdit(code: string): void
  changeDraft(code: string, field: DraftField, value: string): void
  commit(code: string): void
  cancelEdit(): void
  remove(code: string): void
  requestAdd(): void
}

export interface TableView {
  render(
    rows: PnlRow[],
    totals: PnlTotals,
    sort: SortState,
    edit: TableEdit,
    display: ReturnDisplay,
    showCost: boolean,
  ): void
}

/** 首次點擊某欄時的起始方向：數字欄遞減，文字欄遞增 */
export function defaultDirection(key: SortKey): SortDirection {
  return NUMERIC_KEYS.has(key) ? 'desc' : 'asc'
}

/** 缺值一律排最後，不受升冪或降冪影響（F13） */
export function sortRows(rows: PnlRow[], key: SortKey, direction: SortDirection): PnlRow[] {
  const factor = direction === 'asc' ? 1 : -1
  const valueOf = SORT_VALUES[key]

  return [...rows].sort((a, b) => {
    const left = valueOf(a)
    const right = valueOf(b)
    if (left === null || right === null) {
      return left === right ? 0 : left === null ? 1 : -1
    }
    if (typeof left === 'string' || typeof right === 'string') {
      return factor * String(left).localeCompare(String(right), 'zh-Hant')
    }
    return factor * (left - right)
  })
}

function cell(text: string, className: string): HTMLTableCellElement {
  const element = document.createElement('td')
  element.className = className
  element.textContent = text
  return element
}

function span(text: string, className: string): HTMLSpanElement {
  const element = document.createElement('span')
  element.className = className
  element.textContent = text
  return element
}

function button(text: string, className: string): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = className
  element.textContent = text
  return element
}

function valueCell(value: number | null, text: string): HTMLTableCellElement {
  return cell(text, `numeric ${value === null ? 'missing' : directionOf(value)}`)
}

/** ADR-0007：漲跌不得只靠顏色，數字旁必須帶方向符號 */
function priceCell(row: PnlRow): HTMLTableCellElement {
  const price = row.quote?.price ?? null
  if (price === null) return cell(MISSING, 'numeric missing')

  const previousClose = row.quote?.previousClose ?? null
  const direction: Direction = previousClose === null ? 'flat' : directionOf(price - previousClose)
  const element = cell(formatPrice(price), `numeric ${direction}`)

  if (direction !== 'flat') {
    const arrow = span(direction === 'up' ? '▲' : '▼', 'arrow')
    arrow.setAttribute('aria-hidden', 'true')
    element.prepend(arrow)
  }
  return element
}

/** 編輯模式：股數與平均成本可點擊就地編輯（F4） */
function editableCell(
  row: PnlRow,
  edit: TableEdit,
  handlers: TableHandlers,
  field: DraftField,
): HTMLTableCellElement {
  const draft = edit.draft?.code === row.holding.code ? edit.draft : null
  const text = field === 'shares' ? formatShares(row.holding.shares) : formatPrice(row.holding.averageCost)

  if (edit.mode !== 'edit' || draft === null) {
    const element = cell(text, 'numeric')
    if (edit.mode === 'edit') {
      element.classList.add('editable')
      element.addEventListener('click', () => handlers.startEdit(row.holding.code))
    }
    return element
  }

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'cell-input'
  input.value = field === 'shares' ? draft.shares : draft.averageCost
  input.dataset.code = row.holding.code
  input.dataset.field = field
  input.addEventListener('input', () => {
    // 立即清掉上一輪的驗證訊息，不必等下一次輪詢重繪
    element.closest('tr')?.querySelector('.row-error')?.remove()
    handlers.changeDraft(row.holding.code, field, input.value)
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handlers.commit(row.holding.code)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      handlers.cancelEdit()
    }
  })

  const element = cell('', 'numeric')
  element.replaceChildren(input)
  return element
}

/** 僅編輯模式出現的第 10 欄 */
function actionsCell(row: PnlRow, edit: TableEdit, handlers: TableHandlers): HTMLTableCellElement {
  const element = cell('', 'actions')
  element.hidden = edit.mode !== 'edit'
  const { code } = row.holding

  const remove = button('刪除', 'ghost')
  remove.addEventListener('click', () => handlers.remove(code))
  element.append(remove)

  if (edit.draft?.code === code) {
    const save = button('儲存', 'primary')
    save.addEventListener('click', () => handlers.commit(code))

    const cancel = button('取消', 'ghost')
    cancel.addEventListener('click', () => handlers.cancelEdit())

    element.append(save, cancel)
    if (edit.error !== null) element.append(span(edit.error, 'row-error'))
  }

  return element
}

function rowFor(
  row: PnlRow,
  edit: TableEdit,
  handlers: TableHandlers,
  display: ReturnDisplay,
  showCost: boolean,
): HTMLTableRowElement {
  const element = document.createElement('tr')
  if (row.quote !== null && !row.quote.traded) element.className = 'untraded'

  const { code, name } = row.holding
  element.append(cell(code, ''), cell(name, ''))
  if (showCost) element.append(editableCell(row, edit, handlers, 'shares'), editableCell(row, edit, handlers, 'averageCost'))
  element.append(priceCell(row), ...returnCells(row, display, showCost), actionsCell(row, edit, handlers))
  return element
}

/** 兩個報酬欄依顯示模式二選一（F6）；關閉成本時只留今日報酬（F17） */
function returnCells(row: PnlRow, display: ReturnDisplay, showCost: boolean): HTMLTableCellElement[] {
  const today =
    display === 'rate'
      ? valueCell(row.todayReturnRate, formatRate(row.todayReturnRate))
      : valueCell(row.todayReturn, formatAmount(row.todayReturn))
  if (!showCost) return [today]

  const total =
    display === 'rate'
      ? valueCell(row.totalReturnRate, formatRate(row.totalReturnRate))
      : valueCell(row.totalReturn, formatAmount(row.totalReturn))
  return [total, today]
}

function pair(label: string, text: string, direction: Direction): HTMLElement {
  const box = document.createElement('div')
  box.className = 'pair'

  const value = span(text, 'value')
  value.classList.add(direction)

  box.append(span(label, 'label'), value)
  return box
}

/** 總計列的報酬項目跟著顯示模式（F12）；關閉成本時只留今日報酬（F17） */
function returnPairs(values: PnlTotals, display: ReturnDisplay, showCost: boolean): HTMLElement[] {
  const today =
    display === 'rate'
      ? pair('今日報酬率', formatRate(values.todayReturnRate), directionOf(values.todayReturnRate))
      : pair('今日報酬金額', `NT$${formatAmount(values.todayReturn)}`, directionOf(values.todayReturn))
  if (!showCost) return [today]

  const total =
    display === 'rate'
      ? pair('總報酬率', formatRate(values.totalReturnRate), directionOf(values.totalReturnRate))
      : pair('總報酬金額', `NT$${formatAmount(values.totalReturn)}`, directionOf(values.totalReturn))
  return [total, today]
}

interface FocusSnapshot {
  code: string
  field: string
  start: number | null
  end: number | null
}

/** 5 秒輪詢會重建整個 tbody，輸入中的焦點與游標位置必須先記下再還原（F4） */
function captureFocus(): FocusSnapshot | null {
  const active = document.activeElement
  if (!(active instanceof HTMLInputElement)) return null

  const { code, field } = active.dataset
  if (code === undefined || field === undefined) return null
  return { code, field, start: active.selectionStart, end: active.selectionEnd }
}

export function createTableView(host: HTMLElement, handlers: TableHandlers): TableView {
  const head = document.createElement('thead')
  let headers: Array<{ column: Column; th: HTMLTableCellElement }> = []
  let actionsHead = document.createElement('th')
  let shownDisplay: ReturnDisplay | null = null
  let shownShowCost: boolean | null = null

  /** 欄數與欄頭文字都跟著顯示模式與成本開關走，只在切換時重建（ADR-0015、ADR-0020） */
  function buildHead(display: ReturnDisplay, showCost: boolean): void {
    shownDisplay = display
    shownShowCost = showCost
    const headRow = document.createElement('tr')

    headers = columnsFor(display, showCost).map((column) => {
      const th = document.createElement('th')
      if (NUMERIC_KEYS.has(column.key)) th.className = 'numeric'

      const toggle = button(column.label, '')
      toggle.addEventListener('click', () => handlers.sort(column.key))

      th.append(toggle)
      headRow.append(th)
      return { column, th }
    })

    actionsHead = document.createElement('th')
    actionsHead.className = 'actions'
    actionsHead.textContent = '操作'
    headRow.append(actionsHead)

    head.replaceChildren(headRow)
  }

  const body = document.createElement('tbody')
  const table = document.createElement('table')
  table.append(head, body)

  const board = document.createElement('div')
  board.className = 'board'
  board.append(table)
  host.append(board)

  const totals = document.createElement('footer')
  totals.className = 'totals'
  host.append(totals)

  function restoreFocus(snapshot: FocusSnapshot | null): void {
    if (snapshot === null) return
    const target = body.querySelector<HTMLInputElement>(
      `input[data-code="${snapshot.code}"][data-field="${snapshot.field}"]`,
    )
    if (target === null) return
    target.focus()
    if (snapshot.start !== null && snapshot.end !== null) target.setSelectionRange(snapshot.start, snapshot.end)
  }

  /** 空狀態：訊息放在表格內的一列，欄頭照常顯示，視窗寬度才與只有一列資料時一致（F1、F11） */
  function emptyRow(mode: EditMode, display: ReturnDisplay, showCost: boolean): HTMLTableRowElement {
    const row = document.createElement('tr')
    const element = cell('', 'empty')
    element.colSpan = columnsFor(display, showCost).length + 1

    element.append(span('尚未新增任何持股', 'empty-title'))
    if (mode === 'edit') {
      const add = button('新增股票', 'primary')
      add.addEventListener('click', () => handlers.requestAdd())
      element.append(add)
    } else {
      element.append(span('切換到編輯模式即可新增', 'empty-hint'))
    }

    row.append(element)
    return row
  }

  return {
    render(rows, values, sort, edit, display, showCost) {
      const focus = captureFocus()

      if (shownDisplay !== display || shownShowCost !== showCost) buildHead(display, showCost)

      for (const { column, th } of headers) {
        if (column.key === sort.key) {
          th.setAttribute('aria-sort', sort.direction === 'asc' ? 'ascending' : 'descending')
        } else {
          th.removeAttribute('aria-sort')
        }
      }
      actionsHead.hidden = edit.mode !== 'edit'

      const isEmpty = rows.length === 0
      body.replaceChildren(
        ...(isEmpty
          ? [emptyRow(edit.mode, display, showCost)]
          : rows.map((row) => rowFor(row, edit, handlers, display, showCost))),
      )

      const notes = document.createElement('div')
      notes.className = 'notes'
      if (values.excludedCount > 0) {
        notes.append(span(`已排除 ${values.excludedCount} 檔：缺估值價`, ''))
      }
      if (values.todayExcludedCount > 0) {
        notes.append(span(`今日排除 ${values.todayExcludedCount} 檔：缺昨收`, ''))
      }

      const totalsParts = showCost
        ? [
            pair('總成本', `NT$${formatAmount(values.cost)}`, 'flat'),
            pair('總市值', `NT$${formatAmount(values.marketValue)}`, 'flat'),
          ]
        : []
      totals.replaceChildren(...totalsParts, ...returnPairs(values, display, showCost), notes)

      restoreFocus(focus)
    },
  }
}
