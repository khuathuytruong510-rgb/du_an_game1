import type { ItemRarity } from '../../stores/player'

export type EquipmentLootMonsterKind = 'slime' | 'wolf' | 'goblin' | 'boss'

const DROP_CHANCE: Record<EquipmentLootMonsterKind, number> = {
  slime: 0.38,
  wolf: 0.38,
  goblin: 0.38,
  boss: 0.95
}

export const rollEquipmentRarity = (
  monsterKind: EquipmentLootMonsterKind,
  roll: number
): ItemRarity => {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError('Random roll must be between 0 (inclusive) and 1 (exclusive).')
  }

  if (monsterKind === 'boss') {
    return roll < 0.15 ? 'Huyền thoại'
      : roll < 0.45 ? 'Sử thi'
        : roll < 0.75 ? 'Hiếm'
          : 'Tốt'
  }

  return roll < 0.05 ? 'Sử thi'
    : roll < 0.25 ? 'Hiếm'
      : roll < 0.55 ? 'Tốt'
        : 'Thường'
}

export const tryGrantEquipmentDrop = <Equipment>(
  monsterKind: EquipmentLootMonsterKind,
  random: () => number,
  createEquipment: () => Equipment,
  addItem: (equipment: Equipment) => boolean
): boolean => {
  const roll = random()
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError('Random roll must be between 0 (inclusive) and 1 (exclusive).')
  }
  if (roll >= DROP_CHANCE[monsterKind]) return false
  return addItem(createEquipment())
}

export const claimMonsterDefeat = (monster: { alive: boolean }): boolean => {
  if (!monster.alive) return false
  monster.alive = false
  return true
}
