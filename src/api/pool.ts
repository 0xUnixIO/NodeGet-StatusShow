import { RpcClient } from './client'

export interface BackendToken {
  name: string
  backend_url: string
  token: string
}

export interface PoolEntry {
  name: string
  client: RpcClient
}

export class BackendPool {
  entries: PoolEntry[]

  constructor(tokens: BackendToken[]) {
    this.entries = tokens.map(t => ({
      name: t.name,
      client: new RpcClient(t.backend_url, t.token),
    }))
  }

  async fanout<T, A extends unknown[]>(
    method: (client: RpcClient, ...args: A) => Promise<T>,
    ...args: A
  ) {
    const settled = await Promise.allSettled(
      this.entries.map(e => method(e.client, ...args).then(rows => ({ source: e.name, rows }))),
    )
    const ok: { source: string; rows: T }[] = []
    const errors: { source: string; error: unknown }[] = []
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') ok.push(r.value)
      else errors.push({ source: this.entries[i].name, error: r.reason })
    })
    return { ok, errors }
  }

  close() {
    for (const e of this.entries) e.client.close()
  }
}
