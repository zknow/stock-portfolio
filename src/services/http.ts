import { net, os } from '@neutralinojs/lib'
import type { NetRequestOptions } from '@neutralinojs/lib'

export interface HttpTextResponse {
  status: number
  body: string
}

export type Transport = 'net' | 'curl'

/** `os.execCommand` 沒有逾時參數，這條路徑的逾時由 `curl.exe -m` 負責 */
export const DEFAULT_TIMEOUT_SECONDS = 10

const PROXY_ENV_KEYS = ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy']

/** 出現 proxy 環境變數時改走 curl.exe，因為 `Neutralino.net` 不支援 proxy */
export function pickTransport(env: (name: string) => string | undefined): Transport {
  return PROXY_ENV_KEYS.some((key) => (env(key) ?? '') !== '') ? 'curl' : 'net'
}

const STATUS_LINE = /^HTTP\/\d(?:\.\d)?\s+(\d{3})[^\n]*(?:\r?\n)?/
const HEADER_END = /\r?\n\r?\n/

/** 切掉開頭的標頭區塊，回傳本文；找不到標頭與本文的分界時回 null */
function cutHeaders(text: string): string | null {
  const index = text.search(HEADER_END)
  if (index === -1) return null
  return text.startsWith('\r\n\r\n', index) ? text.slice(index + 4) : text.slice(index + 2)
}

/**
 * 解析 `curl.exe -s -i` 的輸出。
 * 走 proxy 的 HTTPS 連線會先吐 `HTTP/1.1 200 Connection established` 這一塊，
 * 因此連續剝掉開頭的標頭區塊，取最後一塊的狀態碼，其後即為本文。
 */
export function parseCurlOutput(output: string): HttpTextResponse {
  let rest = output
  let status: number | null = null

  for (;;) {
    const line = STATUS_LINE.exec(rest)
    if (line === null) break
    const parsed = Number(line[1])
    if (!Number.isFinite(parsed)) break

    const body = cutHeaders(rest)
    if (body === null) break

    status = parsed
    rest = body
  }

  if (status === null) throw new Error('curl 輸出缺少狀態碼')
  return { status, body: rest }
}

let selected: Transport | null = null

async function curlAvailable(): Promise<boolean> {
  try {
    const result = await os.execCommand('curl.exe --version')
    return result.exitCode === 0
  } catch {
    return false
  }
}

/** 首選傳輸在啟動時決定一次並固定 */
async function selectTransport(): Promise<Transport> {
  if (selected !== null) return selected
  const envs = await os.getEnvs()
  const preferred = pickTransport((name) => envs[name])
  selected = preferred === 'curl' && !(await curlAvailable()) ? 'net' : preferred
  return selected
}

export async function getText(url: string, timeoutSeconds = DEFAULT_TIMEOUT_SECONDS): Promise<HttpTextResponse> {
  const transport = await selectTransport()
  if (transport === 'curl') {
    const result = await os.execCommand(`curl.exe -s -i -m ${timeoutSeconds} "${url}"`)
    if (result.exitCode !== 0) throw new Error(`curl.exe 結束碼 ${result.exitCode}：${result.stdErr}`)
    return parseCurlOutput(result.stdOut)
  }

  // 框架的 timeout 單位是毫秒，但 6.10.0 的型別把它宣告成 boolean
  const options = {
    encodePath: true,
    keepAlive: false,
    timeout: timeoutSeconds * 1000,
  } as unknown as NetRequestOptions
  const response = await net.get(url, options)
  return { status: response.status, body: response.body }
}
