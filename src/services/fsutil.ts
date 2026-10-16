import { filesystem } from '@neutralinojs/lib'

/** `createDirectory` 在目錄已存在時回報 `NE_FS_DIRCRER`，必須視為成功 */
function isAlreadyExists(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return (error as { code?: unknown }).code === 'NE_FS_DIRCRER'
}

/** `writeFile` 不保證自動建立父目錄，寫入前一律先呼叫 */
export async function ensureDirectory(path: string): Promise<void> {
  try {
    await filesystem.createDirectory(path)
  } catch (error) {
    if (!isAlreadyExists(error)) throw error
  }
}
