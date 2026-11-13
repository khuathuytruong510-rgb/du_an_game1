import type { ServerCharacter } from './app.js'

export const ENHANCEMENT_COSTS = [1000, 2000, 3000] as const
export const ENHANCEMENT_SUCCESS_CHANCES = [90, 70, 50] as const

export interface EnhancedWeapon {
  [property: string]: unknown
  id: string
  name: string
  type: 'equipment'
  rarity: string
  quantity: number
  slot: 'weapon'
  attackBonus: number
  enhanceLevel: number
}

export interface EnhancementResponse {
  status: 'success' | 'failed'
  cost: number
  newLevel: number
  currentGold: number
  item: EnhancedWeapon
}

export type EnhancementError =
  | 'not-found'
  | 'not-weapon'
  | 'max-level'
  | 'stat-limit'
  | 'insufficient-gold'

export type EnhancementOperationResult =
  | { ok: true; character: ServerCharacter; response: EnhancementResponse }
  | { ok: false; error: EnhancementError }

export const enhanceWeapon = (
  character: ServerCharacter,
  inventoryId: string,
  roll: () => number
): EnhancementOperationResult => {
  const updatedCharacter = structuredClone(character)
  const item = updatedCharacter.inventory.find(candidate => candidate.id === inventoryId)
  if (!item) return { ok: false, error: 'not-found' }
  if (
    typeof item.id !== 'string' ||
    item.type !== 'equipment' ||
    item.slot !== 'weapon'
  ) {
    return { ok: false, error: 'not-weapon' }
  }

  if (
    typeof item.name !== 'string' ||
    typeof item.rarity !== 'string' ||
    typeof item.quantity !== 'number' ||
    typeof item.attackBonus !== 'number' ||
    !Number.isFinite(item.attackBonus) ||
    item.attackBonus < 0 ||
    item.attackBonus > 1000
  ) return { ok: false, error: 'not-weapon' }

  const attackBonus = item.attackBonus
  const level: unknown = item.enhanceLevel === undefined ? 0 : item.enhanceLevel
  if (
    typeof level !== 'number' ||
    !Number.isInteger(level) ||
    level < 0 ||
    level >= ENHANCEMENT_COSTS.length
  ) {
    return { ok: false, error: 'max-level' }
  }

  const cost = ENHANCEMENT_COSTS[level]
  if (updatedCharacter.gold < cost) return { ok: false, error: 'insufficient-gold' }

  const nextAttackBonus = Math.round((10 + attackBonus) * 1.1) - 10
  if (nextAttackBonus > 1000) return { ok: false, error: 'stat-limit' }
  const successChance = ENHANCEMENT_SUCCESS_CHANCES[level]
  const succeeded = roll() <= successChance
  const newLevel = level + Number(succeeded)
  const newAttackBonus = succeeded ? nextAttackBonus : attackBonus
  if (succeeded) {
    item.enhanceLevel = level + 1
    item.attackBonus = newAttackBonus
  }
  updatedCharacter.gold -= cost
  updatedCharacter.savedAt = new Date().toISOString()

  return {
    ok: true,
    character: updatedCharacter,
    response: {
      status: succeeded ? 'success' : 'failed',
      cost,
      newLevel,
      currentGold: updatedCharacter.gold,
      item: {
        ...item,
        id: item.id,
        name: item.name,
        type: 'equipment',
        rarity: item.rarity,
        quantity: item.quantity,
        slot: 'weapon',
        attackBonus: newAttackBonus,
        enhanceLevel: newLevel
      }
    }
  }
}
