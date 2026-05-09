import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { Progress } from './ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Flag } from './Flag'
import { StatusDot } from './StatusDot'
import { bytes, pct, relativeAge } from '../utils/format'
import { deriveUsage, displayName, distroLogo, virtLabel } from '../utils/derive'
import { cn, loadColor } from '../utils/cn'
import type { Node } from '../types'

interface Props {
  nodes: Node[]
  onOpen?: (uuid: string) => void
}

export function NodeTable({ nodes, onOpen }: Props) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>名称</TableHead>
            <TableHead className="w-12 text-center whitespace-nowrap">地区</TableHead>
            <TableHead>架构</TableHead>
            <TableHead>CPU</TableHead>
            <TableHead>内存</TableHead>
            <TableHead>磁盘</TableHead>
            <TableHead>下行</TableHead>
            <TableHead>上行</TableHead>
            <TableHead>更新</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.map(n => {
            const u = deriveUsage(n)
            const logo = distroLogo(n)
            const virt = virtLabel(n)
            return (
              <TableRow
                key={n.uuid}
                onClick={() => onOpen?.(n.uuid)}
                className={cn('cursor-pointer', !n.online && 'opacity-60')}
              >
                <TableCell>
                  <StatusDot online={n.online} />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2 min-w-0">
                    {logo && (
                      <img
                        src={logo}
                        alt=""
                        className="w-4 h-4 shrink-0 object-contain"
                        loading="lazy"
                      />
                    )}
                    <span className="truncate">{displayName(n)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {n.meta?.region ? (
                    <Flag code={n.meta.region} />
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {virt ? (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {virt}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <CellBar value={u.cpu} />
                </TableCell>
                <TableCell>
                  <CellBar
                    value={u.mem}
                    hint={u.memTotal ? `${bytes(u.memUsed)} / ${bytes(u.memTotal)}` : null}
                  />
                </TableCell>
                <TableCell>
                  <CellBar
                    value={u.disk}
                    hint={u.diskTotal ? `${bytes(u.diskUsed)} / ${bytes(u.diskTotal)}` : null}
                  />
                </TableCell>
                <TableCell className="font-mono">{bytes(u.netIn || 0)}/s</TableCell>
                <TableCell className="font-mono">{bytes(u.netOut || 0)}/s</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {relativeAge(u.ts)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

function CellBar({ value, hint }: { value: number | undefined; hint?: string | null }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]" title={hint || ''}>
      <Progress value={value} indicatorClassName={loadColor(value)} className="flex-1 h-1.5" />
      <span className="font-mono text-xs w-12 text-right">{pct(value)}</span>
    </div>
  )
}
