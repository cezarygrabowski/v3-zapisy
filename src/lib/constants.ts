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
  { id: "R2_R3_KORYTARZ", label: "R2 - R3 korytarz" },
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

export function positionLabel(id: string | null | undefined): string {
  if (!id) return ""
  const match = POSITIONS.find((p) => p.id === id)
  if (match) return match.label
  return id.replace(/_/g, " ")
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
  { position: "R1_KORYTARZ", color: "#9B6BDB", note: "środek-dół" },
  { position: "R1", color: "#F4D03F", note: "od wejścia w górę" },
  { position: "R2", color: "#C48A55", note: "lewo (z koronami)" },
  { position: "R3", color: "#9BB6BA", note: "góra-lewo" },
  { position: "R2_R3_KORYTARZ", color: "#06B6D4", note: "najsłabszy, nie bije kokonów (32–20)" },
  { position: "PRAWO", color: "#8B5A2B", note: "góra-prawo" },
  { position: "PRAWO_KORYTARZ", color: "#F5C6CE", note: "prawo-dół" },
]

export const ROLE_V3 = "V3"
export const PREDEFINED_ROLES = ["V3"] as const
export type PredefinedRole = (typeof PREDEFINED_ROLES)[number]
