import type { Holding, Market, ReturnDisplay, SymbolEntry } from '../domain/types'
import { isValidCode, isValidCost, isValidShares } from '../domain/validate'

export type EditMode = 'view' | 'edit'

export interface AddInput {
  code: string
  name: string
  market: Market
  shares: string
  averageCost: string
}

export type ResolveStatus = 'invalid' | 'unknown' | 'found'

export const MARKET_LABEL: Record<Market, string> = { listing: '上市', otc: '上櫃' }

/** 允許千分位逗號；其餘交給 isValidShares / isValidCost 判定 */
export function parseNumber(text: string): number {
  return Number(text.replace(/,/g, '').trim())
}

export function resolveCode(code: string, lookup: (code: string) => SymbolEntry | undefined): ResolveStatus {
  if (!isValidCode(code)) return 'invalid'
  return lookup(code) === undefined ? 'unknown' : 'found'
}

/** F2：回傳錯誤訊息，null 代表通過 */
export function validateAdd(input: AddInput, exists: (code: string) => boolean): string | null {
  if (!isValidCode(input.code)) return '代號需為 4–6 位英數字'
  if (exists(input.code)) return '代號已存在，請改用編輯'
  if (input.name.trim() === '') return '查無此代號，請展開「強制新增」並自填名稱'
  if (!isValidShares(parseNumber(input.shares))) return '股數必須為正整數'
  if (!isValidCost(parseNumber(input.averageCost))) return '平均成本必須為正數'
  return null
}

export function toHolding(input: AddInput): Holding {
  return {
    code: input.code,
    name: input.name.trim(),
    market: input.market,
    shares: parseNumber(input.shares),
    averageCost: parseNumber(input.averageCost),
  }
}

export interface EditControlsOptions {
  lookup(code: string): SymbolEntry | undefined
  exists(code: string): boolean
  /** 回傳錯誤訊息；null 代表成功 */
  submit(holding: Holding): Promise<string | null>
  onModeChange(mode: EditMode): void
  onDisplayChange(display: ReturnDisplay): void
}

export interface EditControls {
  /** 工具列上的控制項：報酬顯示切換鈕、模式切換鈕與新增鈕 */
  toolbar: HTMLElement
  /** 新增表單，由呼叫端插入版面 */
  form: HTMLElement
  setMode(mode: EditMode): void
  setDisplay(display: ReturnDisplay): void
  openAdd(): void
  setEnabled(enabled: boolean): void
}

function inputElement(id: string, className: string): HTMLInputElement {
  const element = document.createElement('input')
  element.type = 'text'
  element.id = id
  element.className = className
  element.autocomplete = 'off'
  return element
}

function labeled(labelText: string, control: HTMLElement): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'field'

  const label = document.createElement('label')
  label.textContent = labelText
  if (control.id !== '') label.htmlFor = control.id

  wrap.append(label, control)
  return wrap
}

function button(text: string, className: string): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = className
  element.textContent = text
  return element
}

export function createEditControls(options: EditControlsOptions): EditControls {
  let mode: EditMode = 'view'
  let display: ReturnDisplay = 'rate'
  let input: AddInput = { code: '', name: '', market: 'listing', shares: '', averageCost: '' }
  /** 逃生門已展開 */
  let forcing = false

  const group = document.createElement('div')
  group.className = 'edit-group'

  /** F6：只切換顯示，不隨 setEnabled 停用（portfolio.json 損毀時仍可切，只是不寫回） */
  const displayButton = button('', 'ghost')
  displayButton.addEventListener('click', () => options.onDisplayChange(display === 'rate' ? 'amount' : 'rate'))

  const modeButton = button('', 'ghost')
  modeButton.addEventListener('click', () => options.onModeChange(mode === 'view' ? 'edit' : 'view'))

  const addButton = button('新增股票', 'primary')
  addButton.hidden = true
  addButton.addEventListener('click', () => openAdd())

  group.append(displayButton, modeButton, addButton)

  const codeInput = inputElement('add-code', '')
  const sharesInput = inputElement('add-shares', '')
  const costInput = inputElement('add-cost', '')
  const nameInput = inputElement('add-name', '')

  const marketSelect = document.createElement('select')
  marketSelect.id = 'add-market'
  for (const [value, label] of Object.entries(MARKET_LABEL)) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    marketSelect.append(option)
  }

  const resolved = document.createElement('span')
  resolved.className = 'resolved'

  const forceButton = button('強制新增', 'ghost')
  forceButton.hidden = true
  forceButton.addEventListener('click', () => {
    forcing = true
    forceButton.hidden = true
    escapeFields.hidden = false
    nameInput.focus()
  })

  const escapeFields = document.createElement('div')
  escapeFields.className = 'addform-row'
  escapeFields.hidden = true
  escapeFields.append(labeled('市場', marketSelect), labeled('名稱', nameInput))

  const errorText = document.createElement('p')
  errorText.className = 'form-error'
  errorText.hidden = true

  const submitButton = button('新增', 'primary')
  submitButton.type = 'submit'

  const cancelButton = button('取消', 'ghost')
  cancelButton.addEventListener('click', () => closeAdd())

  const nameField = document.createElement('div')
  nameField.className = 'field'
  const nameLabel = document.createElement('span')
  nameLabel.className = 'label'
  nameLabel.textContent = '名稱'
  nameField.append(nameLabel, resolved, forceButton)

  const firstRow = document.createElement('div')
  firstRow.className = 'addform-row'
  firstRow.append(
    labeled('代號', codeInput),
    nameField,
    labeled('股數', sharesInput),
    labeled('平均成本', costInput),
    submitButton,
    cancelButton,
  )

  const form = document.createElement('form')
  form.className = 'addform'
  form.hidden = true
  form.append(firstRow, escapeFields, errorText)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    void submit()
  })
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeAdd()
    }
  })

  function showError(message: string | null): void {
    errorText.textContent = message ?? ''
    errorText.hidden = message === null
  }

  function syncResolved(): void {
    const status = resolveCode(input.code, options.lookup)
    const entry = status === 'found' ? options.lookup(input.code) : undefined
    if (entry !== undefined) {
      input.name = entry.name
      input.market = entry.market
      forcing = false
      nameInput.value = entry.name
      marketSelect.value = entry.market
      resolved.textContent = `${entry.name} · ${MARKET_LABEL[entry.market]}`
      resolved.classList.remove('alert')
      escapeFields.hidden = true
      forceButton.hidden = true
      return
    }

    input.name = ''
    nameInput.value = ''
    escapeFields.hidden = !forcing
    forceButton.hidden = status !== 'unknown' || forcing
    resolved.textContent = status === 'unknown' ? '查無此代號' : '代號需為 4–6 位英數字'
    resolved.classList.toggle('alert', status === 'unknown')
  }

  function reset(): void {
    input = { code: '', name: '', market: 'listing', shares: '', averageCost: '' }
    forcing = false
    codeInput.value = ''
    sharesInput.value = ''
    costInput.value = ''
    nameInput.value = ''
    marketSelect.value = 'listing'
    resolved.textContent = '輸入代號後自動帶入'
    resolved.classList.remove('alert')
    forceButton.hidden = true
    escapeFields.hidden = true
    showError(null)
  }

  function openAdd(): void {
    form.hidden = false
    reset()
    codeInput.focus()
  }

  function closeAdd(): void {
    form.hidden = true
    reset()
  }

  async function submit(): Promise<void> {
    const error = validateAdd(input, options.exists)
    if (error !== null) {
      showError(error)
      return
    }

    const failure = await options.submit(toHolding(input))
    if (failure !== null) {
      showError(failure)
      return
    }

    reset()
    codeInput.focus()
  }

  codeInput.addEventListener('input', () => {
    input.code = codeInput.value.trim().toUpperCase()
    showError(null)
    syncResolved()
  })
  sharesInput.addEventListener('input', () => {
    input.shares = sharesInput.value
    showError(null)
  })
  costInput.addEventListener('input', () => {
    input.averageCost = costInput.value
    showError(null)
  })
  nameInput.addEventListener('input', () => {
    input.name = nameInput.value
    showError(null)
  })
  marketSelect.addEventListener('change', () => {
    input.market = marketSelect.value === 'otc' ? 'otc' : 'listing'
  })

  function setMode(next: EditMode): void {
    mode = next
    modeButton.textContent = next === 'edit' ? '完成' : '編輯'
    modeButton.setAttribute('aria-pressed', String(next === 'edit'))
    addButton.hidden = next !== 'edit'
    if (next === 'view') closeAdd()
  }

  function setDisplay(next: ReturnDisplay): void {
    display = next
    displayButton.textContent = next === 'rate' ? '%' : 'NT$'
    displayButton.title = next === 'rate' ? '目前顯示百分比，點擊改為金額' : '目前顯示金額，點擊改為百分比'
    displayButton.setAttribute('aria-label', '報酬顯示切換')
  }

  function setEnabled(enabled: boolean): void {
    modeButton.disabled = !enabled
    modeButton.title = enabled ? '' : '無法讀取 portfolio.json，已停用編輯'
    if (!enabled) setMode('view')
  }

  setMode('view')
  setDisplay('rate')
  reset()

  return {
    toolbar: group,
    form,
    setMode,
    setDisplay,
    openAdd,
    setEnabled,
  }
}
