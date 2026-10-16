/** 台股證券代號：4–6 位英數字，大小寫不拘 */
const CODE_PATTERN = /^[0-9A-Z]{4,6}$/i

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code)
}

export function isValidShares(shares: number): boolean {
  return Number.isInteger(shares) && shares > 0
}

export function isValidCost(cost: number): boolean {
  return Number.isFinite(cost) && cost > 0
}
