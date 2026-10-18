/** 等比縮放的基準尺寸（F11）：內容設計在 1100×760 */
export const BASE_WIDTH = 1100
export const BASE_HEIGHT = 760

/** 縮放因子下限（ADR-0016）。最小視窗寬度改由內容自然寬度推得，不再靠這個下限配合捲動 */
export const MIN_SCALE = 0.85

export function scaleFactor(width: number): number {
  return Math.max(width / BASE_WIDTH, MIN_SCALE)
}

/** 最小視窗高度按基準比例推導，視窗形狀與設計維持一致（ADR-0016） */
export function minHeightFor(minWidth: number): number {
  return Math.round((minWidth * BASE_HEIGHT) / BASE_WIDTH)
}

export function applyScale(width: number): void {
  document.documentElement.style.setProperty('--scale', String(scaleFactor(width)))
}

/** Neutralino 沒有 `windowResize` 事件，只能用 DOM 的 `resize`（F11） */
export function watchResize(): void {
  window.addEventListener('resize', () => applyScale(window.innerWidth))
}
