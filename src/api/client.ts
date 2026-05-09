import { Client } from 'rpc-websockets'

const CONNECT_TIMEOUT_MS = 8000

let seq = 0
const nextRequestId = () =>
  `${++seq}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`

export class RpcClient {
  private token: string
  private client: Client
  opened: Promise<void>

  constructor(url: string, token: string) {
    this.token = token
    this.client = new Client(
      url,
      {
        autoconnect: true,
        reconnect: true,
        reconnect_interval: 2000,
        max_reconnects: Number.POSITIVE_INFINITY,
      },
      nextRequestId,
    )

    this.opened = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        this.client.off('open', onOpen)
        this.client.off('error', onError)
      }
      const onOpen = () => {
        cleanup()
        resolve()
      }
      const onError = (e: Error) => {
        cleanup()
        reject(new Error(`无法连接 ${url}: ${e?.message || 'WebSocket error'}`))
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`连接 ${url} 超时`))
      }, CONNECT_TIMEOUT_MS)
      this.client.once('open', onOpen)
      this.client.once('error', onError)
    })
  }

  async call<T = unknown>(method: string, params: Record<string, unknown> = {}, timeout = 10000) {
    await this.opened
    return this.client.call(method, { token: this.token, ...params }, timeout) as Promise<T>
  }

  close() {
    this.client.close()
  }
}
