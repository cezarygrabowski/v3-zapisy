export type V3EnemyItem = {
  id: string
  name: string
  guild: string | null
  characterClass: string | null
  isInsideV3: boolean
  spottedAt: string | null
  spottedBy: string | null
  spotterNick?: string | null
  createdAt: string
}

export type QuickAddEnemyInput = {
  name: string
  guild?: string | null
  characterClass?: string | null
  markInside?: boolean
}

export type UpdateEnemyInput = {
  id: string
  name: string
  guild?: string | null
  characterClass?: string | null
}

