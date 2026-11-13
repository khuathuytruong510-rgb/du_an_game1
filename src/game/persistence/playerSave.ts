import type { EquipmentSlot, InventoryItem, ItemRarity } from '../../stores/player'

export interface PlayerSaveData {
  version: 1
  savedAt: string
  level: number
  exp: number
  gold: number
  hp: number
  mp: number
  inventory: InventoryItem[]
  equipment: Partial<Record<EquipmentSlot, InventoryItem>>
  quests: Array<{
    id: string
    progress: number
    claimed: boolean
  }>
}

export type LoadSaveResult =
  | { status: 'empty' }
  | { status: 'loaded'; data: PlayerSaveData }
  | { status: 'invalid'; message: string }

const SAVE_KEY = 'chien-gioi.player.v1'
const ITEM_RARITIES: ItemRarity[] = ['Thường', 'Tốt', 'Hiếm']
const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'armor']
const QUEST_IDS = ['slime-hunt', 'spirit-shards']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

const isInventoryItem = (value: unknown): value is InventoryItem => {
  if (!isRecord(value)) return false
  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.name !== 'string' ||
    value.name.length === 0 ||
    !['material', 'equipment', 'consumable'].includes(value.type as string) ||
    !ITEM_RARITIES.includes(value.rarity as ItemRarity) ||
    !isFiniteInRange(value.quantity, 1, 999) ||
    !Number.isInteger(value.quantity)
  ) {
    return false
  }

  if (value.type === 'equipment') {
    if (value.healAmount !== undefined) return false
    if (value.slot === 'weapon') {
      return isFiniteInRange(value.attackBonus, 0, 1000) &&
        (value.enhanceLevel === undefined ||
          isFiniteInRange(value.enhanceLevel, 0, 3) && Number.isInteger(value.enhanceLevel)) &&
        value.defenseBonus === undefined
    }
    if (value.slot === 'armor') {
      if (value.enhanceLevel !== undefined) return false
      return value.attackBonus === undefined
        ? isFiniteInRange(value.defenseBonus, 0, 1000)
        : isFiniteInRange(value.attackBonus, 0, 1000) && value.defenseBonus === undefined
    }
    return false
  }

  if (value.type === 'consumable') {
    return value.name === 'Thuốc hồi phục' &&
      isFiniteInRange(value.healAmount, 1, 200) &&
      Number.isInteger(value.healAmount) &&
      value.slot === undefined &&
      value.attackBonus === undefined &&
      value.defenseBonus === undefined &&
      value.enhanceLevel === undefined
  }

  return value.slot === undefined &&
    value.attackBonus === undefined &&
    value.defenseBonus === undefined &&
    value.enhanceLevel === undefined &&
    value.healAmount === undefined
}

const isEquipment = (value: unknown): value is PlayerSaveData['equipment'] => {
  if (!isRecord(value)) return false

  return Object.entries(value).every(([slot, item]) =>
    EQUIPMENT_SLOTS.includes(slot as EquipmentSlot) &&
    isInventoryItem(item) &&
    item.type === 'equipment' &&
    item.slot === slot
  )
}

export const isPlayerSaveData = (value: unknown): value is PlayerSaveData => {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.savedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.savedAt))
  ) return false
  if (
    !isFiniteInRange(value.level, 1, 30) ||
    !Number.isInteger(value.level) ||
    !isFiniteInRange(value.exp, 0, 100 * (value.level as number) ** 2 - 1) ||
    !isFiniteInRange(value.gold, 0, Number.MAX_SAFE_INTEGER) ||
    !Number.isInteger(value.gold) ||
    !isFiniteInRange(value.hp, 0, 200) ||
    !isFiniteInRange(value.mp, 0, 150) ||
    !Array.isArray(value.inventory) ||
    value.inventory.length > 20 ||
    !value.inventory.every(isInventoryItem) ||
    !isEquipment(value.equipment) ||
    !Array.isArray(value.quests)
  ) {
    return false
  }

  const items = [...value.inventory, ...Object.values(value.equipment)]
  if (new Set(items.map(item => item.id)).size !== items.length) return false

  if (
    value.quests.length !== QUEST_IDS.length ||
    !value.quests.every(quest =>
      isRecord(quest) &&
      QUEST_IDS.includes(quest.id as string) &&
      isFiniteInRange(quest.progress, 0, 3) &&
      Number.isInteger(quest.progress) &&
      typeof quest.claimed === 'boolean' &&
      (!quest.claimed || quest.progress === 3)
    ) ||
    new Set(value.quests.map(quest => isRecord(quest) ? quest.id : undefined)).size !== QUEST_IDS.length
  ) {
    return false
  }

  return true
}

export const loadPlayerSave = (): LoadSaveResult => {
  let serialized: string | null
  try {
    serialized = localStorage.getItem(SAVE_KEY)
  } catch {
    return { status: 'invalid', message: 'Trình duyệt không cho phép đọc dữ liệu đã lưu.' }
  }

  if (serialized === null) return { status: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return { status: 'invalid', message: 'Dữ liệu lưu bị hỏng; tiến trình hiện tại chưa bị ghi đè.' }
  }

  if (!isPlayerSaveData(parsed)) {
    return { status: 'invalid', message: 'Dữ liệu lưu không hợp lệ; tiến trình hiện tại chưa bị ghi đè.' }
  }

  return { status: 'loaded', data: parsed }
}

export const writePlayerSave = (data: PlayerSaveData): string | null => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    return null
  } catch {
    return 'Không thể lưu tiến trình. Hãy kiểm tra dung lượng lưu trữ của trình duyệt.'
  }
}

export const resetPlayerSave = (): string | null => {
  try {
    localStorage.removeItem(SAVE_KEY)
    return null
  } catch {
    return 'Không thể xóa dữ liệu lưu của trình duyệt.'
  }
}
