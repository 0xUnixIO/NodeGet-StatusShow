import type { RpcClient } from './client'
import type { DynamicSummary, StaticData } from '../types'

export const listAgentUuids = (c: RpcClient) =>
  c.call<{ uuids?: string[] }>('nodeget-server_list_all_agent_uuid', {}).then(r => r?.uuids || [])

export const staticDataMulti = (c: RpcClient, uuids: string[], fields: string[]) =>
  c.call<StaticData[]>('agent_static_data_multi_last_query', { uuids, fields })

export const dynamicSummaryMulti = (c: RpcClient, uuids: string[], fields: string[]) =>
  c.call<DynamicSummary[]>('agent_dynamic_summary_multi_last_query', { uuids, fields })

export const querySummaryHistory = (
  c: RpcClient,
  uuid: string,
  from: number,
  to: number,
  fields: string[],
  limit?: number,
) =>
  c.call<DynamicSummary[]>('agent_query_dynamic_summary', {
    query: {
      fields,
      condition: [
        { uuid },
        { timestamp_from_to: [from, to] },
        ...(limit != null ? [{ limit }] : []),
      ],
    },
  })

export const kvGetMulti = (
  c: RpcClient,
  items: { namespace: string; key: string }[],
) => c.call<{ namespace: string; key: string; value: unknown }[]>('kv_get_multi_value', { namespace_key: items })

export interface TcpPingRow {
  uuid: string
  timestamp: number | null
  success: boolean | null
  task_event_result: { tcp_ping?: number } | null
  cron_source: string | null
}

// 全局轮询：查所有节点最近一段时间（用于 NodeCard 摘要）
export const queryTcpPings = (c: RpcClient, from: number, to: number, limit?: number) =>
  c.call<TcpPingRow[]>('task_query', {
    task_data_query: {
      condition: [
        { type: 'tcp_ping' },
        { timestamp_from_to: [from, to] },
        ...(limit != null ? [{ limit }] : []),
      ],
    },
  })

// 单节点历史：只查指定 uuid，limit 只作用于该节点（用于 NodeDetail 图表）
export const queryNodeTcpPings = (c: RpcClient, uuid: string, from: number, to: number, limit?: number) =>
  c.call<TcpPingRow[]>('task_query', {
    task_data_query: {
      condition: [
        { type: 'tcp_ping' },
        { uuid },
        { timestamp_from_to: [from, to] },
        ...(limit != null ? [{ limit }] : []),
      ],
    },
  })

