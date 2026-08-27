"use client"

import { useState } from "react"
import { MAP_ZONES, positionLabel, type PositionId } from "@/lib/constants"
import {
  MAP_EDGES,
  MAP_ROOMS,
  MAP_SIZE,
  QUEEN,
  ROOM,
  ZONE_COLORS,
  roomNumber,
  roomZone,
  zoneLabelAnchor,
  type MapRoom,
} from "@/lib/v3-map"
import { cn } from "@/lib/utils"

export type MapOccupant = {
  position: PositionId
  gameNick: string | null
}

function roomSize(room: MapRoom) {
  return room.kind === "queen" ? QUEEN : ROOM
}

function Crown({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <polygon
        points="0,-8 -7,4 7,4"
        fill="#f4d03f"
        stroke="#3a2a00"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </g>
  )
}

function numberColor(fill: string, isQueen: boolean) {
  if (isQueen) return "#fff"
  const hex = fill.replace("#", "")
  if (hex.length !== 6) return "#111"
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? "#111" : "#fff"
}

export function V3Map({
  roster,
}: {
  roster: MapOccupant[]
}) {
  const [selected, setSelected] = useState<PositionId | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const occupied = roster.filter((row) => row.gameNick)
  const occupiedCount = occupied.length
  const nickByPosition = new Map(
    roster.map((row) => [row.position, row.gameNick] as const)
  )
  const occupiedPositions = new Set(
    roster.filter((row) => row.gameNick).map((row) => row.position)
  )

  const byId = new Map(MAP_ROOMS.map((room) => [room.id, room]))

  const buckets = new Map<PositionId, { x: number; y: number; n: number }>()
  for (const room of MAP_ROOMS) {
    const zone = roomZone(room.id, occupiedPositions)
    if (!zone || !occupiedPositions.has(zone)) continue
    const bucket = buckets.get(zone) ?? { x: 0, y: 0, n: 0 }
    bucket.x += room.x
    bucket.y += room.y
    bucket.n += 1
    buckets.set(zone, bucket)
  }
  const labels = [...buckets.entries()].map(([position, bucket]) => {
    const pinned = zoneLabelAnchor(position)
    return {
      position,
      x: pinned?.x ?? bucket.x / bucket.n,
      y: pinned?.y ?? bucket.y / bucket.n - 36,
      nick: nickByPosition.get(position),
    }
  })

  return (
    <div className="flex flex-col gap-3">
      {occupiedCount === 0 ? (
        <p className="text-sm text-muted-foreground">Nikogo nie ma na slocie.</p>
      ) : occupiedPositions.has("R1_KORYTARZ") ? null : (
        <p className="text-sm text-muted-foreground">
          R1 korytarz puste — R1, R2 i R3 biorą większy teren.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-foreground/10">
        <svg
          viewBox={`80 20 ${MAP_SIZE.width - 80} ${MAP_SIZE.height - 20}`}
          className="h-auto w-full min-w-[52rem]"
          role="img"
          aria-label="Interaktywna mapa kokonów V3"
        >
          {MAP_EDGES.map(([a, b]) => {
            const ra = byId.get(a)
            const rb = byId.get(b)
            if (!ra || !rb) return null
            return (
              <line
                key={`${a}-${b}`}
                x1={ra.x}
                y1={ra.y}
                x2={rb.x}
                y2={rb.y}
                stroke="#6b6b6b"
                strokeWidth={10}
                strokeLinecap="round"
              />
            )
          })}

          {MAP_ROOMS.map((room) => {
            const zone = roomZone(room.id, occupiedPositions)
            const occupiedHere = zone ? occupiedPositions.has(zone) : false
            const nick = zone ? nickByPosition.get(zone) : null
            const size = roomSize(room)
            const fill = occupiedHere && zone ? ZONE_COLORS[zone] : "#f7f7f7"
            const isSelected = zone !== null && zone === selected
            const n = roomNumber(room.id)
            const fillColor = room.kind === "queen" ? "#c0392b" : fill
            const isRoomSelected = selectedRoom === room.id
            const label = [
              String(n),
              room.kind === "queen" ? "Królówka" : room.kind === "entrance" ? "Wejście" : "Kokon",
              zone ? positionLabel(zone) : null,
              nick,
            ]
              .filter(Boolean)
              .join(" · ")

            return (
              <g
                key={room.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelected(zone)
                  setSelectedRoom(room.id)
                }}
              >
                <title>{label}</title>
                {room.kind === "ring" ? (
                  <circle
                    cx={room.x}
                    cy={room.y}
                    r={size / 2 + 4}
                    fill="none"
                    stroke="#e67e22"
                    strokeWidth={4}
                  />
                ) : null}
                <rect
                  x={room.x - size / 2}
                  y={room.y - size / 2}
                  width={size}
                  height={size}
                  rx={4}
                  fill={fillColor}
                  stroke={isRoomSelected || isSelected ? "#111" : "#1a1a1a"}
                  strokeWidth={isRoomSelected ? 4 : isSelected ? 3 : 2.5}
                />
                {room.kind === "queen" ? (
                  <Crown x={room.x} y={room.y - size / 2 - 2} />
                ) : null}
                <text
                  x={room.x}
                  y={room.y + 6}
                  textAnchor="middle"
                  fontSize={n >= 10 ? 15 : 17}
                  fontWeight={800}
                  fill={numberColor(fillColor, room.kind === "queen")}
                  pointerEvents="none"
                >
                  {n}
                </text>
              </g>
            )
          })}

          <polygon
            points="1294,1005 1282,1028 1306,1028"
            fill="#2ecc71"
            stroke="#1e8449"
            strokeWidth="2"
          />
          <line
            x1={1294}
            y1={1005}
            x2={1294}
            y2={978}
            stroke="#2ecc71"
            strokeWidth={5}
            strokeLinecap="round"
          />

          {labels.map((label) =>
            label.nick ? (
              <g key={label.position}>
                <rect
                  x={label.x - 52}
                  y={label.y - 12}
                  width={104}
                  height={22}
                  rx={6}
                  fill="white"
                  fillOpacity={0.92}
                  stroke="#222"
                  strokeWidth={1}
                />
                <text
                  x={label.x}
                  y={label.y + 4}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="#111"
                >
                  {label.nick}
                </text>
              </g>
            ) : null
          )}
        </svg>
      </div>

      {selectedRoom ? (
        <p className="text-sm">
          Komnata <span className="font-medium">{roomNumber(selectedRoom)}</span>
          {selected ? ` · ${positionLabel(selected)}` : null}
          {selected && nickByPosition.get(selected)
            ? ` · ${nickByPosition.get(selected)}`
            : selected
              ? " · wolne"
              : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Kliknij komnatę.
        </p>
      )}

      <ul className="flex flex-wrap gap-2">
        {MAP_ZONES.map((zone) => {
          const nick = nickByPosition.get(zone.position)
          const active = occupiedPositions.has(zone.position)
          return (
            <li key={zone.position}>
              <button
                type="button"
                onClick={() => setSelected(zone.position)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1 text-sm ring-1 ring-foreground/15",
                  selected === zone.position && "ring-2 ring-foreground",
                  !active && "opacity-50"
                )}
              >
                <span
                  className="size-3 rounded-sm ring-1 ring-foreground/20"
                  style={{ backgroundColor: ZONE_COLORS[zone.position] }}
                />
                {positionLabel(zone.position)}
                <span className="text-muted-foreground">{nick ?? "—"}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
