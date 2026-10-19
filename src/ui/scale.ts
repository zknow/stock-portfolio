import { MAX_ZOOM, MIN_ZOOM, ZOOM_DEFAULT, ZOOM_STEP } from '../domain/types'

/** 等比縮放的基準尺寸（F11）：內容設計在 1100×760 */
export const BASE_WIDTH = 1100
export const BASE_HEIGHT = 760

/** 縮放因子下限（ADR-0016）。最小視窗寬度改由內容自然寬度推得，不再靠這個下限配合捲動 */
export const MIN_SCALE = 0.85

/** 使用者縮放倍率（F11、ADR-0018）。由 main.ts 依偏好設定，套用在視窗寬度推得的因子之上 */
let zoom = ZOOM_DEFAULT

export function scaleFactor(width: number, userZoom = ZOOM_DEFAULT): number {
  return Math.max(width / BASE_WIDTH, MIN_SCALE) * userZoom
}

/** 夾在倍率上下限與 10% 的格線上 */
export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 10) / 10))
}

/** 一次縮放級距（鍵盤或滾輪一格） */
export function nextZoom(current: number, steps: number): number {
  return clampZoom(current + steps * ZOOM_STEP)
}

export function currentZoom(): number {
  return zoom
}

/** 套用倍率、更新 CSS 變數，回傳夾限後的結果 */
export function setZoom(value: number): number {
  zoom = clampZoom(value)
  applyScale(window.innerWidth)
  return zoom
}

/** 最小視窗高度按基準比例推導，視窗形狀與設計維持一致（ADR-0016） */
export function minHeightFor(minWidth: number): number {
  return Math.round((minWidth * BASE_HEIGHT) / BASE_WIDTH)
}

export function applyScale(width: number): void {
  document.documentElement.style.setProperty('--scale', String(scaleFactor(width, zoom)))
}

/** Neutralino 沒有 `windowResize` 事件，只能用 DOM 的 `resize`（F11） */
export function watchResize(): void {
  window.addEventListener('resize', () => applyScale(window.innerWidth))
}
