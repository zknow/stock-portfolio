import { ZOOM_DEFAULT } from '../domain/types'
import { currentZoom, nextZoom } from './scale'

/** 一次縮放指令：跳級距或回到預設 */
export type ZoomIntent = { kind: 'step'; steps: number } | { kind: 'reset' }

/** Ctrl+= / Ctrl++ 放大，Ctrl+- 縮小，Ctrl+0 回預設；其他鍵回 null（F11、ADR-0018） */
export function keyZoom(key: string): ZoomIntent | null {
  if (key === '=' || key === '+') return { kind: 'step', steps: 1 }
  if (key === '-' || key === '_') return { kind: 'step', steps: -1 }
  if (key === '0') return { kind: 'reset' }
  return null
}

/** 滾輪往上放大、往下縮小。一個事件跳一個級距 */
export function wheelZoom(deltaY: number): ZoomIntent | null {
  if (deltaY === 0) return null
  return { kind: 'step', steps: deltaY < 0 ? 1 : -1 }
}

export function resolveZoom(current: number, intent: ZoomIntent): number {
  return intent.kind === 'reset' ? ZOOM_DEFAULT : nextZoom(current, intent.steps)
}

/**
 * 自行實作 Ctrl 縮放（F11、ADR-0018）。WebView2 的原生頁面縮放讀不到也設不回，
 * 而且它放大的不是版面：內容會超出貼合後的視窗而被裁掉，因此一律擋掉。
 */
export function watchZoom(onChange: (zoom: number) => void): void {
  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey) return
    const intent = keyZoom(event.key)
    if (intent === null) return
    event.preventDefault()
    onChange(resolveZoom(currentZoom(), intent))
  })

  window.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const intent = wheelZoom(event.deltaY)
      if (intent !== null) onChange(resolveZoom(currentZoom(), intent))
    },
    { passive: false },
  )
}
