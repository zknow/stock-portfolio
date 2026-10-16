function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 本地日期，YYYY-MM-DD */
export function dateText(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 本地日期，YYYYMMDD。與 MIS 的 `d` 欄位同格式 */
export function dateKey(now: Date): string {
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}

/** 本地時間，HH:mm:ss */
export function timeText(now: Date): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export function timestampText(now: Date): string {
  return `${dateText(now)} ${timeText(now)}`
}

const TRADING_OPEN_MINUTES = 9 * 60
const TRADING_CLOSE_MINUTES = 13 * 60 + 30

/**
 * 台北時間 09:00–13:30、週一至週五。
 * 以系統本地時間判斷，假設執行環境為 +08:00。
 */
export function isTradingTime(now: Date): boolean {
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const minutes = now.getHours() * 60 + now.getMinutes()
  return minutes >= TRADING_OPEN_MINUTES && minutes < TRADING_CLOSE_MINUTES
}

/** 當日已過收盤時間。週末為 false。用於區分狀態列的「已收盤」與「非交易時段」 */
export function isAfterClose(now: Date): boolean {
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  return now.getHours() * 60 + now.getMinutes() >= TRADING_CLOSE_MINUTES
}
