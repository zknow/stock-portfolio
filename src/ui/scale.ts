/** 等比縮放的基準寬度（F11） */
export const BASE_WIDTH = 1100

export function applyScale(width: number): void {
  document.documentElement.style.setProperty('--scale', String(width / BASE_WIDTH))
}

/** Neutralino 沒有 `windowResize` 事件，只能用 DOM 的 `resize`（F11） */
export function watchResize(): void {
  window.addEventListener('resize', () => applyScale(window.innerWidth))
}
