import { POSITIONS, playstyleLabel, type Playstyle } from "@/lib/constants"
import type { KillStatsRow, StatsRow } from "@/lib/queries"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function StatsTable({
  rows,
  isLeader,
}: {
  rows: StatsRow[]
  isLeader: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Gracz</TableHead>
          <TableHead>Wejścia</TableHead>
          {POSITIONS.map((position) => (
            <TableHead key={position.id}>{position.label}</TableHead>
          ))}
          {isLeader ? <TableHead>Do zapłaty</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.userId}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium">{row.gameNick}</span>
                {row.playstyle ? (
                  <Badge variant="secondary">{playstyleLabel(row.playstyle as Playstyle)}</Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell>{row.entries}</TableCell>
            {POSITIONS.map((position) => (
              <TableCell key={position.id}>{row.byPosition[position.id]}</TableCell>
            ))}
            {isLeader ? <TableCell>{row.owedKk} kk</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function KillStatsTable({ rows }: { rows: KillStatsRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Gracz</TableHead>
          <TableHead>Królówki</TableHead>
          <TableHead>Baronki</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.userId}>
            <TableCell className="font-medium">{row.gameNick}</TableCell>
            <TableCell>{row.queens}</TableCell>
            <TableCell>{row.barons}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
