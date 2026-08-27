export const SLOTS = [
  { id: "08:30", label: "08:30–11:30" },
  { id: "11:30", label: "11:30–14:30" },
  { id: "14:30", label: "14:30–17:30" },
  { id: "17:30", label: "17:30–20:30" },
] as const

export const POSITIONS = [
  { id: "R1", label: "R1" },
  { id: "R2", label: "R2" },
  { id: "R3", label: "R3" },
  { id: "PRAWO", label: "Prawo" },
  { id: "R1_KORYTARZ", label: "R1 korytarz" },
  { id: "PRAWO_KORYTARZ", label: "Prawo korytarz" },
] as const

export type SlotId = (typeof SLOTS)[number]["id"]
export type PositionId = (typeof POSITIONS)[number]["id"]
export type Playstyle = "pvp" | "pvm"

export const PVP_FEE_KK = 3
export const PVM_FEE_KK = 7

export const SLOT_IDS = SLOTS.map((s) => s.id) as [SlotId, ...SlotId[]]
export const POSITION_IDS = POSITIONS.map((p) => p.id) as [
  PositionId,
  ...PositionId[],
]

export function isSlotId(value: string): value is SlotId {
  return SLOT_IDS.includes(value as SlotId)
}

export function isPositionId(value: string): value is PositionId {
  return POSITION_IDS.includes(value as PositionId)
}

export function isPlaystyle(value: string): value is Playstyle {
  return value === "pvp" || value === "pvm"
}

export function feeForPlaystyle(playstyle: Playstyle): number {
  return playstyle === "pvp" ? PVP_FEE_KK : PVM_FEE_KK
}

export function slotLabel(id: SlotId): string {
  return SLOTS.find((s) => s.id === id)?.label ?? id
}

export function positionLabel(id: PositionId): string {
  return POSITIONS.find((p) => p.id === id)?.label ?? id
}

export function playstyleLabel(playstyle: Playstyle): string {
  return playstyle === "pvp" ? "PVP" : "PVM"
}

export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true"
}

export function envLeaderDiscordIds(): Set<string> {
  return new Set(
    (process.env.LEADER_DISCORD_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  )
}

export const MAP_ZONES: {
  position: PositionId
  color: string
  note: string
}[] = [
  { position: "R1_KORYTARZ", color: "#9B6BDB", note: "fiolet, środek-dół" },
  { position: "R1", color: "#F4D03F", note: "żółty, od wejścia w górę" },
  { position: "R2", color: "#C48A55", note: "brąz z koronami, lewo" },
  { position: "R3", color: "#9BB6BA", note: "seledyn, góra-lewo" },
  { position: "PRAWO", color: "#8B5A2B", note: "brąz, góra-prawo" },
  { position: "PRAWO_KORYTARZ", color: "#F5C6CE", note: "róż, prawo-dół" },
]
