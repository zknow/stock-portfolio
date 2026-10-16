import { MISSING, directionOf, formatAmount, formatPrice, formatRate, formatShares } from '../domain/format'
import type { Direction } from '../domain/format'
import type { PnlRow, PnlTotals } from '../domain/pnl'
import type { SortDirection, SortKey } from '../domain/types'

interface Column {
  key: SortKey
  label: string
  numeric: boolean
}

/** F1：可見欄位固定 9 欄，順序即此處的順序 */
const COLUMNS: Column[] = [
  { key: 'code', label: '代號', numeric: false },
  { key: 'name', label: '名稱', numeric: false },
  { key: 'shares', label: '股數', numeric: true },
  { key: 'averageCost', label: '平均成本', numeric: true },
  { key: 'price', label: '現價', numeric: true },
  { key: 'totalReturn', label: '總報酬金額', numeric: true },
  { key: 'totalReturnRate', label: '總報酬率', numeric: true },
  { key: 'todayReturn', label: '今日報酬金額', numeric: true },
  { key: 'todayReturnRate', label: '今日報酬率', numeric: true },
]

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

export interface TableView {
  render(rows: PnlRow[], totals: PnlTotals, sort: SortState): void
}

/** 首次點擊某欄時的起始方向：數字欄遞減，文字欄遞增 */
export function defaultDirection(key: SortKey): SortDirection {
  return COLUMNS.find((column) => column.key === key)?.numeric === true ? 'desc' : 'asc'
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

function rowFor(row: PnlRow): HTMLTableRowElement {
  const element = document.createElement('tr')
  if (row.quote !== null && !row.quote.traded) element.className = 'untraded'

  const { code, name, shares, averageCost } = row.holding
  element.append(
    cell(code, ''),
    cell(name, ''),
    cell(formatShares(shares), 'numeric'),
    cell(formatPrice(averageCost), 'numeric'),
    priceCell(row),
    valueCell(row.totalReturn, formatAmount(row.totalReturn)),
    valueCell(row.totalReturnRate, formatRate(row.totalReturnRate)),
    valueCell(row.todayReturn, formatAmount(row.todayReturn)),
    valueCell(row.todayReturnRate, formatRate(row.todayReturnRate)),
  )
  return element
}

function pair(label: string, text: string, direction: Direction): HTMLElement {
  const box = document.createElement('div')
  box.className = 'pair'

  const value = span(text, 'value')
  value.classList.add(direction)

  box.append(span(label, 'label'), value)
  return box
}

export function createTableView(host: HTMLElement, onSort: (key: SortKey) => void): TableView {
  const headRow = document.createElement('tr')
  const headers = COLUMNS.map((column) => {
    const th = document.createElement('th')
    if (column.numeric) th.className = 'numeric'

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = column.label
    button.addEventListener('click', () => onSort(column.key))

    th.append(button)
    headRow.append(th)
    return { column, th }
  })

  const head = document.createElement('thead')
  head.append(headRow)

  const body = document.createElement('tbody')
  const table = document.createElement('table')
  table.append(head, body)

  const empty = document.createElement('p')
  empty.className = 'empty'
  empty.textContent = '尚未新增任何持股'
  empty.hidden = true

  const board = document.createElement('div')
  board.className = 'board'
  board.append(table, empty)
  host.append(board)

  const totals = document.createElement('footer')
  totals.className = 'totals'
  host.append(totals)

  return {
    render(rows, values, sort) {
      for (const { column, th } of headers) {
        if (column.key === sort.key) {
          th.setAttribute('aria-sort', sort.direction === 'asc' ? 'ascending' : 'descending')
        } else {
          th.removeAttribute('aria-sort')
        }
      }

      body.replaceChildren(...rows.map(rowFor))

      const isEmpty = rows.length === 0
      table.hidden = isEmpty
      empty.hidden = !isEmpty

      const notes = document.createElement('div')
      notes.className = 'notes'
      if (values.excludedCount > 0) {
        notes.append(span(`已排除 ${values.excludedCount} 檔：缺估值價`, ''))
      }
      if (values.todayExcludedCount > 0) {
        notes.append(span(`今日排除 ${values.todayExcludedCount} 檔：缺昨收`, ''))
      }

      totals.replaceChildren(
        pair('總成本', `NT$${formatAmount(values.cost)}`, 'flat'),
        pair('總市值', `NT$${formatAmount(values.marketValue)}`, 'flat'),
        pair('總報酬金額', `NT$${formatAmount(values.totalReturn)}`, directionOf(values.totalReturn)),
        pair('總報酬率', formatRate(values.totalReturnRate), directionOf(values.totalReturnRate)),
        pair('今日報酬金額', `NT$${formatAmount(values.todayReturn)}`, directionOf(values.todayReturn)),
        notes,
      )
    },
  }
}
