import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseCurlOutput, pickTransport } from './http'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  execCommand: vi.fn(),
  getEnvs: vi.fn(),
}))

vi.mock('@neutralinojs/lib', () => ({
  net: { get: mocks.get },
  os: { execCommand: mocks.execCommand, getEnvs: mocks.getEnvs },
}))

const CURL_OK = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"a":1}'

async function freshHttp(): Promise<typeof import('./http')> {
  vi.resetModules()
  return import('./http')
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('pickTransport', () => {
  it('出現 proxy 環境變數時走 curl', () => {
    expect(pickTransport(() => 'http://proxy:3128')).toBe('curl')
    expect(pickTransport((name) => (name === 'http_proxy' ? 'http://proxy:3128' : undefined))).toBe('curl')
  })

  it('沒有 proxy 環境變數時走 net', () => {
    expect(pickTransport(() => undefined)).toBe('net')
    expect(pickTransport(() => '')).toBe('net')
  })
})

describe('parseCurlOutput', () => {
  it('第一行取狀態碼，空行之後為本文', () => {
    expect(parseCurlOutput(CURL_OK)).toEqual({ status: 200, body: '{"a":1}' })
  })

  it('走 proxy 的 HTTPS 會多一層 Connection established 標頭區塊，取最後一塊的狀態碼', () => {
    const output = [
      'HTTP/1.1 200 Connection established',
      '',
      'HTTP/1.1 200 OK',
      'Content-Type: application/json',
      '',
      '{"a":1}',
    ].join('\r\n')
    expect(parseCurlOutput(output)).toEqual({ status: 200, body: '{"a":1}' })
  })

  it('接受只有 LF 的輸出', () => {
    expect(parseCurlOutput('HTTP/1.1 500 Boom\nContent-Type: text/plain\n\nbad')).toEqual({
      status: 500,
      body: 'bad',
    })
  })

  it('沒有狀態碼時丟錯', () => {
    expect(() => parseCurlOutput('亂碼')).toThrow('狀態碼')
    expect(() => parseCurlOutput('200 OK\r\n\r\n{}')).toThrow('狀態碼')
  })

  it('標頭之後沒有本文時 body 為空字串', () => {
    expect(parseCurlOutput('HTTP/1.1 304 Not Modified\r\nETag: x\r\n\r\n')).toEqual({
      status: 304,
      body: '',
    })
  })
})

describe('getText', () => {
  it('無 proxy 時走 net.get 並帶上框架要求的選項', async () => {
    mocks.getEnvs.mockResolvedValue({})
    mocks.get.mockResolvedValue({ status: 200, body: '{"a":1}' })

    const { getText } = await freshHttp()
    await expect(getText('https://example.com/x')).resolves.toEqual({ status: 200, body: '{"a":1}' })
    expect(mocks.get).toHaveBeenCalledWith('https://example.com/x', {
      encodePath: true,
      keepAlive: false,
      timeout: 10000,
    })
    expect(mocks.execCommand).not.toHaveBeenCalled()
  })

  it('有 proxy 時走 curl.exe 並解析輸出', async () => {
    mocks.getEnvs.mockResolvedValue({ HTTPS_PROXY: 'http://proxy:3128' })
    mocks.execCommand.mockImplementation((command: string) =>
      command.includes('--version')
        ? Promise.resolve({ exitCode: 0, stdOut: 'curl 8.0.1', stdErr: '' })
        : Promise.resolve({ exitCode: 0, stdOut: CURL_OK, stdErr: '' }),
    )

    const { getText } = await freshHttp()
    await expect(getText('https://example.com/x', 7)).resolves.toEqual({ status: 200, body: '{"a":1}' })
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.execCommand).toHaveBeenCalledWith('curl.exe -s -i -m 7 "https://example.com/x"')
  })

  it('有 proxy 但取不到 curl.exe 時退回 net.get', async () => {
    mocks.getEnvs.mockResolvedValue({ HTTPS_PROXY: 'http://proxy:3128' })
    mocks.execCommand.mockResolvedValue({ exitCode: 1, stdOut: '', stdErr: '找不到' })
    mocks.get.mockResolvedValue({ status: 200, body: '{}' })

    const { getText } = await freshHttp()
    await expect(getText('https://example.com/x')).resolves.toEqual({ status: 200, body: '{}' })
    expect(mocks.get).toHaveBeenCalledOnce()
  })

  it('curl 非零結束碼時丟錯', async () => {
    mocks.getEnvs.mockResolvedValue({ HTTPS_PROXY: 'http://proxy:3128' })
    mocks.execCommand.mockImplementation((command: string) =>
      command.includes('--version')
        ? Promise.resolve({ exitCode: 0, stdOut: '', stdErr: '' })
        : Promise.resolve({ exitCode: 28, stdOut: '', stdErr: 'timed out' }),
    )

    const { getText } = await freshHttp()
    await expect(getText('https://example.com/x')).rejects.toThrow('curl.exe 結束碼 28')
  })
})
