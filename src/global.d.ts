declare module 'rpc-websockets' {
  type Listener = (...args: any[]) => void
  type GenerateRequestId = (method: string, params: object | unknown[]) => number | string
  interface ClientOptions {
    autoconnect?: boolean
    reconnect?: boolean
    reconnect_interval?: number
    max_reconnects?: number
  }
  export class Client {
    constructor(url: string, opts?: ClientOptions, generateRequestId?: GenerateRequestId)
    call(method: string, params?: any, timeout?: number): Promise<any>
    close(): void
    on(event: string, fn: Listener): void
    off(event: string, fn: Listener): void
    once(event: string, fn: Listener): void
  }
}
