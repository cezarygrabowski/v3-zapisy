import { type PositionId } from "@/lib/constants"

export type RoomKind = "cocoon" | "queen" | "entrance" | "ring"

export type MapRoom = {
  id: string
  n: number
  x: number
  y: number
  kind: RoomKind
}

export const MAP_SIZE = { width: 2000, height: 1109 }
export const ROOM = 42
export const QUEEN = 54

export const MAP_ROOMS: MapRoom[] = [
  // cyan — R3
  { id: "c1", n: 32, x: 282, y: 78, kind: "cocoon" },
  { id: "c2", n: 31, x: 437, y: 78, kind: "cocoon" },
  { id: "c3", n: 30, x: 550, y: 79, kind: "cocoon" },
  { id: "c4", n: 29, x: 670, y: 81, kind: "cocoon" },
  { id: "c5", n: 34, x: 162, y: 174, kind: "cocoon" },
  { id: "c6", n: 33, x: 281, y: 174, kind: "cocoon" },
  { id: "c7", n: 36, x: 162, y: 268, kind: "cocoon" },
  { id: "c8", n: 35, x: 282, y: 269, kind: "cocoon" },

  // brown left — R2
  { id: "bl1", n: 28, x: 670, y: 190, kind: "cocoon" },
  { id: "bl2", n: 26, x: 670, y: 296, kind: "cocoon" },
  { id: "bl3", n: 20, x: 670, y: 412, kind: "cocoon" },
  { id: "bl4", n: 21, x: 670, y: 513, kind: "cocoon" },
  { id: "bl5", n: 24, x: 667, y: 611, kind: "cocoon" },
  { id: "bl6", n: 22, x: 542, y: 513, kind: "cocoon" },
  { id: "bl7", n: 23, x: 542, y: 612, kind: "cocoon" },
  { id: "bl8", n: 19, x: 842, y: 410, kind: "cocoon" },
  { id: "q1", n: 27, x: 507, y: 294, kind: "queen" },
  { id: "q2", n: 10, x: 849, y: 507, kind: "queen" },
  { id: "q3", n: 25, x: 397, y: 607, kind: "queen" },

  // yellow — R1
  { id: "y1", n: 8, x: 949, y: 410, kind: "cocoon" },
  { id: "y2", n: 6, x: 1059, y: 411, kind: "cocoon" },
  { id: "y3", n: 5, x: 1163, y: 411, kind: "cocoon" },
  { id: "y4", n: 9, x: 950, y: 510, kind: "cocoon" },
  { id: "y5", n: 7, x: 1059, y: 510, kind: "cocoon" },
  { id: "y6", n: 4, x: 1163, y: 774, kind: "cocoon" },
  { id: "y7", n: 3, x: 1293, y: 774, kind: "cocoon" },
  { id: "y8", n: 2, x: 1293, y: 856, kind: "cocoon" },

  // purple — R1 korytarz
  { id: "p1", n: 12, x: 835, y: 594, kind: "cocoon" },
  { id: "p2", n: 11, x: 951, y: 594, kind: "cocoon" },
  { id: "p3", n: 13, x: 835, y: 677, kind: "cocoon" },
  { id: "p4", n: 14, x: 951, y: 677, kind: "cocoon" },
  { id: "p5", n: 15, x: 951, y: 838, kind: "cocoon" },
  { id: "p6", n: 16, x: 1035, y: 839, kind: "cocoon" },
  { id: "p7", n: 18, x: 1110, y: 839, kind: "cocoon" },

  // pink — Prawo korytarz
  { id: "k1", n: 45, x: 1671, y: 509, kind: "cocoon" },
  { id: "k2", n: 43, x: 1672, y: 605, kind: "cocoon" },
  { id: "k3", n: 38, x: 1427, y: 694, kind: "cocoon" },
  { id: "k4", n: 39, x: 1518, y: 696, kind: "cocoon" },
  { id: "k5", n: 40, x: 1591, y: 696, kind: "cocoon" },
  { id: "k6", n: 41, x: 1672, y: 694, kind: "cocoon" },
  { id: "k7", n: 37, x: 1427, y: 774, kind: "cocoon" },

  // brown right — Prawo
  { id: "r1", n: 49, x: 1336, y: 323, kind: "queen" },
  { id: "br1", n: 48, x: 1452, y: 322, kind: "cocoon" },
  { id: "br2", n: 47, x: 1559, y: 322, kind: "cocoon" },
  { id: "br3", n: 50, x: 1668, y: 322, kind: "cocoon" },
  { id: "br4", n: 51, x: 1784, y: 326, kind: "cocoon" },
  { id: "br5", n: 52, x: 1671, y: 418, kind: "cocoon" },
  { id: "br6", n: 53, x: 1784, y: 418, kind: "cocoon" },
  { id: "br7", n: 46, x: 1559, y: 508, kind: "cocoon" },
  { id: "br8", n: 54, x: 1784, y: 509, kind: "cocoon" },

  // shared / landmarks
  { id: "w1", n: 17, x: 1038, y: 756, kind: "queen" },
  { id: "w2", n: 1, x: 1294, y: 948, kind: "entrance" },
  { id: "w3", n: 44, x: 1785, y: 606, kind: "queen" },
  { id: "w4", n: 42, x: 1673, y: 783, kind: "queen" },
]

export const MAP_EDGES: [string, string][] = [
  ["c1", "c2"],
  ["c2", "c3"],
  ["c3", "c4"],
  ["c1", "c6"],
  ["c5", "c6"],
  ["c5", "c7"],
  ["c6", "c8"],
  ["c7", "c8"],
  ["c4", "bl1"],
  ["bl1", "bl2"],
  ["bl2", "bl3"],
  ["bl3", "bl4"],
  ["bl4", "bl5"],
  ["q1", "bl2"],
  ["bl3", "bl8"],
  ["bl8", "y1"],
  ["bl6", "bl4"],
  ["bl6", "bl7"],
  ["q3", "bl7"],
  ["bl7", "bl5"],
  ["q2", "y4"],
  ["y1", "y2"],
  ["y2", "y3"],
  ["y1", "y4"],
  ["y2", "y5"],
  ["y4", "y5"],
  ["y3", "y6"],
  ["y6", "y7"],
  ["y7", "y8"],
  ["y8", "w2"],
  ["y4", "p2"],
  ["p1", "p2"],
  ["p1", "p3"],

  ["p3", "p4"],
  ["p4", "p5"],
  ["p5", "p6"],
  ["p6", "p7"],
  ["p6", "w1"],
  ["y7", "k7"],
  ["k7", "k3"],
  ["k3", "k4"],
  ["k4", "k5"],
  ["k5", "k6"],
  ["k6", "k2"],
  ["k2", "k1"],
  ["k6", "w4"],
  ["k2", "w3"],
  ["r1", "br1"],
  ["br1", "br2"],
  ["br2", "br3"],
  ["br3", "br4"],
  ["br3", "br5"],
  ["br4", "br6"],
  ["br5", "br6"],
  ["br2", "br7"],
  ["br7", "k1"],
  ["br6", "br8"],
  ["k1", "br8"],
]

const ZONE_6: Record<string, PositionId> = {
  c1: "R3",
  c2: "R3",
  c3: "R3",
  c4: "R3",
  c5: "R3",
  c6: "R3",
  c7: "R3",
  c8: "R3",
  bl1: "R2",
  bl2: "R2",
  bl3: "R2",
  bl4: "R2",
  bl5: "R2",
  bl6: "R2",
  bl7: "R2",
  bl8: "R2",
  q1: "R2",
  q2: "R2",
  q3: "R2",
  y1: "R1",
  y2: "R1",
  y3: "R1",
  y4: "R1",
  y5: "R1",
  y6: "R1",
  y7: "R1",
  y8: "R1",
  p1: "R1_KORYTARZ",
  p2: "R1_KORYTARZ",
  p3: "R1_KORYTARZ",
  p4: "R1_KORYTARZ",
  p5: "R1_KORYTARZ",
  p6: "R1_KORYTARZ",
  p7: "R1_KORYTARZ",
  w1: "R1_KORYTARZ",
  k1: "PRAWO_KORYTARZ",
  k2: "PRAWO_KORYTARZ",
  k3: "PRAWO_KORYTARZ",
  k4: "PRAWO_KORYTARZ",
  k5: "PRAWO_KORYTARZ",
  k6: "PRAWO_KORYTARZ",
  k7: "PRAWO_KORYTARZ",
  w3: "PRAWO_KORYTARZ",
  w4: "PRAWO_KORYTARZ",
  r1: "PRAWO",
  br1: "PRAWO",
  br2: "PRAWO",
  br3: "PRAWO",
  br4: "PRAWO",
  br5: "PRAWO",
  br6: "PRAWO",
  br7: "PRAWO",
  br8: "PRAWO",
}

export const MAP_ZONE_LAYOUTS: Partial<Record<number, Record<string, PositionId>>> = {
  6: ZONE_6,
}

const WHEN_R1_KORYTARZ_EMPTY: Record<PositionId, string[]> = {
  R1: ["y1", "y2", "y4", "y5", "p2", "p1", "p3", "p4", "p5", "p6", "p7"],
  R2: ["bl6", "bl4", "bl7", "bl5", "bl8", "y3", "y6", "y7", "y8", "bl3"],
  R3: ["c7", "c5", "c6", "c8", "c1", "c2", "c3", "c4", "bl1", "bl2"],
  R1_KORYTARZ: [],
  PRAWO: [],
  PRAWO_KORYTARZ: [],
}

const ZONE_LABEL_ANCHORS: Partial<
  Record<PositionId, { rooms: string[] } | { beside: string; dx: number; dy: number }>
> = {
  R3: { rooms: ["c5", "c6", "c7", "c8"] },
  R2: { rooms: ["bl6", "bl4", "bl7", "bl5"] },
  R1: { rooms: ["y1", "y2", "y4", "y5"] },
  R1_KORYTARZ: { beside: "w1", dx: 78, dy: 0 },
  PRAWO_KORYTARZ: { beside: "w4", dx: -78, dy: 0 },
  PRAWO: { rooms: ["br3", "br4", "br5", "br6"] },
}

export function zoneLabelAnchor(position: PositionId): { x: number; y: number } | null {
  const spec = ZONE_LABEL_ANCHORS[position]
  if (!spec) return null
  if ("beside" in spec) {
    const room = MAP_ROOMS.find((item) => item.id === spec.beside)
    if (!room) return null
    return { x: room.x + spec.dx, y: room.y + spec.dy }
  }
  const rooms = spec.rooms
    .map((id) => MAP_ROOMS.find((item) => item.id === id))
    .filter((room): room is MapRoom => Boolean(room))
  if (rooms.length === 0) return null
  return {
    x: rooms.reduce((sum, room) => sum + room.x, 0) / rooms.length,
    y: rooms.reduce((sum, room) => sum + room.y, 0) / rooms.length,
  }
}

export function layoutForOccupied(occupiedPositions: Set<PositionId>): Record<string, PositionId> {
  if (occupiedPositions.has("R1_KORYTARZ") || occupiedPositions.size === 0) {
    return ZONE_6
  }

  const layout: Record<string, PositionId> = {}
  for (const [id, position] of Object.entries(ZONE_6)) {
    if (position !== "R1_KORYTARZ") layout[id] = position
  }
  for (const [position, ids] of Object.entries(WHEN_R1_KORYTARZ_EMPTY) as [
    PositionId,
    string[],
  ][]) {
    for (const id of ids) {
      layout[id] = position
    }
  }
  return layout
}

export const ZONE_COLORS: Record<PositionId, string> = {
  R1_KORYTARZ: "#9B6BDB",
  R1: "#F4D03F",
  R2: "#C48A55",
  R3: "#9BB6BA",
  PRAWO: "#8B5A2B",
  PRAWO_KORYTARZ: "#F5B6C8",
}

export function roomZone(
  roomId: string,
  occupiedPositions: Set<PositionId>
): PositionId | null {
  return layoutForOccupied(occupiedPositions)[roomId] ?? null
}

export function roomNumber(roomId: string): number {
  return MAP_ROOMS.find((room) => room.id === roomId)?.n ?? 0
}
