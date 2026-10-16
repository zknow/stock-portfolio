/** 等比縮放的基準寬度（F11） */
export const BASE_WIDTH = 1100

/** 縮放因子下限。再小字級會不可讀，改由表格水平捲動消化（ADR-0011） */
export const MIN_SCALE = 0.85

export function scaleFactor(width: number): number {
  return Math.max(width / BASE_WIDTH, MIN_SCALE)
}

export function applyScale(width: number): void {
  document.documentElement.style.setProperty('--scale', String(scaleFactor(width)))
}

/** Neutralino 沒有 `windowResize` 事件，只能用 DOM 的 `resize`（F11） */
export function watchResize(): void {
  window.addEventListener('resize', () => applyScale(window.innerWidth))
}
