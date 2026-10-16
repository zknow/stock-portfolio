import { filesystem } from '@neutralinojs/lib'
import { timestampText } from './clock'
import { ensureDirectory } from './fsutil'

export const LOG_DIR = 'logs'
export const LOG_PATH = 'logs/app.log'

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function formatLogLine(level: LogLevel, event: string, detail: string, now: Date): string {
  const suffix = detail === '' ? '' : ` ${detail}`
  return `${timestampText(now)} ${level} ${event}${suffix}\n`
}

/** 只記異常與狀態轉換。寫入失敗不得影響主流程 */
export async function log(level: LogLevel, event: string, detail: unknown = ''): Promise<void> {
  try {
    await ensureDirectory(LOG_DIR)
    const line = formatLogLine(level, event, detail === '' ? '' : errorText(detail), new Date())
    await filesystem.appendFile(LOG_PATH, line)
  } catch {
    return
  }
}
