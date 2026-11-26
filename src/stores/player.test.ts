import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import {
  getItemSellPrice,
  EQUIPMENT_SHOP,
  HEALING_POTION_PRICE,
  INVENTORY_CAPACITY,
  usePlayerStore
} from './player'
import { isPlayerSaveData } from '../game/persistence/playerSave'
import { gameApi } from '../game/persistence/gameApi'

const installLocalStorage = () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size
      }
    } satisfies Storage
  })

  return () => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
}

test('validates and persists character name and avatar', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const restoreLocalStorage = installLocalStorage()

  try {
    assert.equal(player.setPlayerProfile('A', 'hero-scout'), false)
    assert.equal(player.playerName, 'Nấm Lùn')

    assert.equal(player.setPlayerProfile('Chiến Binh Test', 'hero-scout'), true)
    assert.equal(player.playerName, 'Chiến Binh Test')
    assert.equal(player.playerAvatar, 'hero-scout')
    assert.equal(player.getSaveData().playerName, 'Chiến Binh Test')
  } finally {
    restoreLocalStorage()
  }
})

test('persists and restores the selected mount on the device', () => {
  setActivePinia(createPinia())
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const restoreLocalStorage = installLocalStorage()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: globalThis.localStorage }
  })

  try {
    const player = usePlayerStore()
    assert.equal(player.setMount('ice-dragon'), true)
    assert.equal(player.mountId, 'ice-dragon')

    setActivePinia(createPinia())
    const restoredPlayer = usePlayerStore()
    restoredPlayer.initializeGame()
    assert.equal(restoredPlayer.mountId, 'ice-dragon')

    assert.equal(restoredPlayer.setMount(null), true)
    assert.equal(restoredPlayer.mountId, null)
  } finally {
    restoreLocalStorage()
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('waits for the final remote save before logging out', async () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  player.accountEmail = 'player@example.com'

  const restoreLocalStorage = installLocalStorage()
  const originalSaveCharacter = gameApi.saveCharacter
  const originalLogout = gameApi.logout
  const calls: string[] = []
  let finishSave: (() => void) | undefined
  const saveGate = new Promise<void>(resolve => {
    finishSave = resolve
  })

  gameApi.saveCharacter = async () => {
    calls.push('save-started')
    await saveGate
    calls.push('save-finished')
    return { status: 'ok', savedAt: new Date().toISOString() }
  }
  gameApi.logout = async () => {
    calls.push('logout')
    return { status: 'ok' }
  }

  try {
    const logout = player.logout()
    await new Promise<void>(resolve => setImmediate(resolve))
    assert.deepEqual(calls, ['save-started'])

    finishSave?.()
    await logout

    assert.deepEqual(calls, ['save-started', 'save-finished', 'logout'])
    assert.equal(player.accountStatus, 'Đã đăng xuất · tiến trình đã lưu trên thiết bị và máy chủ')
  } finally {
    gameApi.saveCharacter = originalSaveCharacter
    gameApi.logout = originalLogout
    restoreLocalStorage()
  }
})

test('logs out after a failed remote save and reports that only the local copy was kept', async () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  player.accountEmail = 'player@example.com'

  const restoreLocalStorage = installLocalStorage()
  const originalSaveCharacter = gameApi.saveCharacter
  const originalLogout = gameApi.logout
  const calls: string[] = []
  gameApi.saveCharacter = async () => {
    calls.push('save')
    throw new Error('Máy chủ không khả dụng')
  }
  gameApi.logout = async () => {
    calls.push('logout')
    return { status: 'ok' }
  }

  try {
    await player.logout()

    assert.deepEqual(calls, ['save', 'logout'])
    assert.equal(player.accountEmail, null)
    assert.equal(player.accountStatus, 'Đã đăng xuất · tiến trình đã lưu trên thiết bị')
    assert.equal(player.accountStatusType, 'error')
  } finally {
    gameApi.saveCharacter = originalSaveCharacter
    gameApi.logout = originalLogout
    restoreLocalStorage()
  }
})

test('regenerates mana without exceeding the level-based maximum', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  player.mp = 48
  player.regenerateMp(3)
  assert.equal(player.mp, 50)

  player.level = 4
  assert.equal(player.maxMp, 65)
  player.mp = 64
  player.regenerateMp(10)
  assert.equal(player.mp, 65)
})

test('ignores invalid or non-positive mana regeneration', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  player.mp = 20
  player.regenerateMp(0)
  player.regenerateMp(-5)
  player.regenerateMp(Number.NaN)
  assert.equal(player.mp, 20)
})

test('leveling up restores the new health and mana limits and grants gold', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  player.hp = 20
  player.mp = 10
  player.gainExp(100)

  assert.equal(player.level, 2)
  assert.equal(player.exp, 0)
  assert.equal(player.maxHp, 110)
  assert.equal(player.maxMp, 55)
  assert.equal(player.hp, 110)
  assert.equal(player.mp, 55)
  assert.equal(player.gold, 10)
})

test('validates enhancement levels while keeping existing unenhanced saves compatible', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const weapon = player.createItem({
    name: 'Kiếm tập sự',
    type: 'equipment',
    rarity: 'Tốt',
    quantity: 1,
    slot: 'weapon',
    attackBonus: 4
  })
  player.addItem(weapon)

  const legacySave = player.getSaveData()
  assert.equal(isPlayerSaveData(legacySave), true)
  weapon.enhanceLevel = 3
  assert.equal(isPlayerSaveData(player.getSaveData()), true)

  weapon.enhanceLevel = 4
  assert.equal(isPlayerSaveData(player.getSaveData()), false)
})

test('opens and closes the forge panel without allowing close during enhancement', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  player.openForgePanel()
  assert.equal(player.forgeOpen, true)
  player.closeForgePanel()
  assert.equal(player.forgeOpen, false)

  player.openForgePanel()
  player.forgeInProgress = true
  player.closeForgePanel()
  assert.equal(player.forgeOpen, true)
  player.forgeInProgress = false
  player.closeForgePanel()
  assert.equal(player.forgeOpen, false)
})

test('tracks monster defeats and claims quest rewards once', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  assert.equal(player.claimQuest('slime-hunt'), false)
  assert.equal(player.autoMessage, 'Nhiệm vụ "Dọn bãi tập" chưa hoàn thành')

  player.recordMonsterDefeat()
  player.recordMonsterDefeat()
  player.recordMonsterDefeat()
  player.recordMonsterDefeat()

  const quest = player.quests.find(item => item.id === 'slime-hunt')
  assert.equal(quest?.progress, 3)
  assert.equal(player.claimQuest('slime-hunt'), true)
  assert.equal(player.claimQuest('slime-hunt'), false)
  assert.equal(player.autoMessage, 'Phần thưởng nhiệm vụ "Dọn bãi tập" đã được nhận')
  assert.equal(player.gold, 15)
  assert.equal(player.quests.find(item => item.id === 'slime-hunt')?.claimed, true)
})

test('reports attempts to claim unknown quests', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  assert.equal(player.claimQuest('unknown-quest'), false)
  assert.equal(player.autoMessage, 'Không tìm thấy nhiệm vụ')
})

test('tracks collected shards up to the quest requirement', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  player.addItem(player.createItem({
    name: 'Mảnh linh thạch',
    type: 'material',
    rarity: 'Thường',
    quantity: 2
  }))
  player.addItem(player.createItem({
    name: 'Mảnh linh thạch',
    type: 'material',
    rarity: 'Thường',
    quantity: 3
  }))

  assert.equal(player.inventory.length, 1)
  assert.equal(player.inventory[0]?.quantity, 5)
  assert.equal(player.quests.find(item => item.id === 'spirit-shards')?.progress, 3)
})

test('allows stackable loot when the inventory is full but rejects new slots', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  player.addItem(player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 1,
    healAmount: 50
  }))
  for (let index = 1; index < 20; index++) {
    player.addItem(player.createItem({
      name: `Món đồ ${index}`,
      type: 'equipment',
      rarity: 'Thường',
      quantity: 1,
      slot: 'weapon',
      attackBonus: 1
    }))
  }

  assert.equal(player.inventory.length, 20)
  assert.equal(player.addItem(player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 1,
    healAmount: 50
  })), true)
  assert.equal(player.inventory.length, 20)
  assert.equal(player.inventory[0]?.quantity, 2)

  assert.equal(player.addItem(player.createItem({
    name: 'Mảnh linh thạch',
    type: 'material',
    rarity: 'Thường',
    quantity: 1
  })), false)
  assert.equal(player.inventory.length, 20)
})

test('clamps incoming damage and restored health to the level-based maximum', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  player.hp = 5
  player.takeDamage(9)
  assert.equal(player.hp, 0)
  player.takeDamage(10)
  assert.equal(player.hp, 0)

  player.level = 3
  player.restoreHealth(60)
  assert.equal(player.hp, 60)
  player.restoreHealth(1000)
  assert.equal(player.hp, 120)
})

test('ignores invalid or non-positive health changes', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  player.takeDamage(0)
  player.takeDamage(Number.NaN)
  player.restoreHealth(-1)
  player.restoreHealth(Number.POSITIVE_INFINITY)
  assert.equal(player.hp, 100)
})

test('armor reduces incoming damage while weapon alone increases attack power', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const weapon = player.createItem({
    name: 'Kiếm tập sự',
    type: 'equipment',
    rarity: 'Tốt',
    quantity: 1,
    slot: 'weapon',
    attackBonus: 4
  })
  const armor = player.createItem({
    name: 'Giáp da tập sự',
    type: 'equipment',
    rarity: 'Tốt',
    quantity: 1,
    slot: 'armor',
    defenseBonus: 2
  })
  player.addItem(weapon)
  player.addItem(armor)

  assert.equal(player.equipItem(weapon.id), true)
  assert.equal(player.equipItem(armor.id), true)
  assert.equal(player.attackPower, 14)
  assert.equal(player.defensePower, 2)

  player.hp = 100
  assert.equal(player.takeDamage(8), 6)
  assert.equal(player.hp, 94)
  assert.equal(player.takeDamage(1), 1)
  assert.equal(player.hp, 93)
})

test('seven equipment slots stack stats and replacement preserves the old item', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const items = [
    player.createItem({ name: 'Kiếm', type: 'equipment', rarity: 'Hiếm', quantity: 1, slot: 'weapon', attackBonus: 8 }),
    player.createItem({ name: 'Mũ', type: 'equipment', rarity: 'Tốt', quantity: 1, slot: 'helmet', defenseBonus: 3 }),
    player.createItem({ name: 'Áo giáp', type: 'equipment', rarity: 'Sử thi', quantity: 1, slot: 'armor', defenseBonus: 5, hpBonus: 25 }),
    player.createItem({ name: 'Găng tay', type: 'equipment', rarity: 'Tốt', quantity: 1, slot: 'gloves', attackBonus: 4 }),
    player.createItem({ name: 'Giày', type: 'equipment', rarity: 'Hiếm', quantity: 1, slot: 'boots', attackSpeedBonus: 10, dodgeBonus: 0.08 }),
    player.createItem({ name: 'Nhẫn', type: 'equipment', rarity: 'Sử thi', quantity: 1, slot: 'ring', attackBonus: 3, criticalBonus: 0.12 }),
    player.createItem({ name: 'Dây chuyền', type: 'equipment', rarity: 'Huyền thoại', quantity: 1, slot: 'necklace', hpBonus: 40, mpBonus: 30 })
  ]
  for (const item of items) player.addItem(item)
  for (const item of items) assert.equal(player.equipItem(item.id), true)

  assert.equal(player.attackPower, 25)
  assert.equal(player.defensePower, 8)
  assert.equal(player.maxHp, 165)
  assert.equal(player.maxMp, 80)
  assert.equal(player.attackSpeed, 10)
  assert.ok(Math.abs(player.criticalChance - 0.22) < 0.0001)
  assert.ok(Math.abs(player.dodgeChance - 0.08) < 0.0001)

  const replacement = player.createItem({
    name: 'Kiếm thay thế',
    type: 'equipment',
    rarity: 'Huyền thoại',
    quantity: 1,
    slot: 'weapon',
    attackBonus: 20
  })
  player.addItem(replacement)
  assert.equal(player.equipItem(replacement.id), true)
  assert.equal(player.attackPower, 37)
  assert.equal(player.inventory.some(item => item.id === items[0].id), true)
})

test('equipping and unequipping persists equipment for the next game session', () => {
  setActivePinia(createPinia())
  const restoreLocalStorage = installLocalStorage()

  try {
    const player = usePlayerStore()
    player.initializeGame()
    const ring = player.createItem({
      name: 'Nhẫn lưu',
      type: 'equipment',
      rarity: 'Hiếm',
      quantity: 1,
      slot: 'ring',
      attackBonus: 4,
      criticalBonus: 0.05
    })
    player.addItem(ring)
    assert.equal(player.equipItem(ring.id), true)
    assert.ok(Math.abs(player.criticalChance - 0.15) < 0.0001)

    setActivePinia(createPinia())
    const restored = usePlayerStore()
    restored.initializeGame()
    assert.equal(restored.equipment.ring?.name, 'Nhẫn lưu')
    assert.ok(Math.abs(restored.criticalChance - 0.15) < 0.0001)

    assert.equal(restored.unequipItem('ring'), true)
    assert.equal(restored.equipment.ring, undefined)
    assert.equal(restored.inventory.some(item => item.name === 'Nhẫn lưu'), true)

    setActivePinia(createPinia())
    const restoredAgain = usePlayerStore()
    restoredAgain.initializeGame()
    assert.equal(restoredAgain.equipment.ring, undefined)
  } finally {
    restoreLocalStorage()
  }
})

test('keeps old armor saves working by treating their attack bonus as defense', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  player.equipment = {
    armor: {
      id: 'legacy-armor',
      name: 'Giáp da tập sự',
      type: 'equipment',
      rarity: 'Tốt',
      quantity: 1,
      slot: 'armor',
      attackBonus: 2
    }
  }

  assert.equal(player.attackPower, 10)
  assert.equal(player.defensePower, 2)
})

test('unequips gear into the inventory and preserves it when the inventory is full', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const weapon = player.createItem({
    name: 'Kiếm tập sự',
    type: 'equipment',
    rarity: 'Tốt',
    quantity: 1,
    slot: 'weapon',
    attackBonus: 4
  })
  player.equipment.weapon = weapon

  assert.equal(player.unequipItem('weapon'), true)
  assert.equal(player.equipment.weapon, undefined)
  assert.equal(player.inventory[0]?.id, weapon.id)
  assert.equal(player.attackPower, 10)

  player.equipment.weapon = weapon
  for (let index = player.inventory.length; index < INVENTORY_CAPACITY; index++) {
    player.addItem(player.createItem({
      name: `Món đồ ${index}`,
      type: 'equipment',
      rarity: 'Thường',
      quantity: 1,
      slot: 'weapon',
      attackBonus: 1
    }))
  }

  assert.equal(player.unequipItem('weapon'), false)
  assert.equal(player.equipment.weapon?.id, weapon.id)
  assert.equal(player.inventory.length, INVENTORY_CAPACITY)
  assert.match(player.autoMessage, /Túi đồ đã đầy/)
})

test('sells inventory items for gold and removes the entire stack', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const shards = player.createItem({
    name: 'Mảnh linh thạch',
    type: 'material',
    rarity: 'Thường',
    quantity: 3
  })
  const potion = player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 2,
    healAmount: 50
  })
  const weapon = player.createItem({
    name: 'Kiếm tập sự',
    type: 'equipment',
    rarity: 'Tốt',
    quantity: 1,
    slot: 'weapon',
    attackBonus: 4
  })
  player.addItem(shards)
  player.addItem(potion)
  player.addItem(weapon)

  assert.equal(getItemSellPrice(shards), 2)
  assert.equal(getItemSellPrice(potion), 3)
  assert.equal(getItemSellPrice(weapon), 13)
  assert.equal(player.sellItem(shards.id), true)
  assert.equal(player.sellItem(potion.id), true)
  assert.equal(player.sellItem(weapon.id), true)
  assert.equal(player.gold, 25)
  assert.equal(player.inventory.length, 0)
  assert.equal(player.sellItem(weapon.id), false)
  assert.match(player.autoMessage, /Không tìm thấy vật phẩm/)
})

test('sells part of a stack without removing the remaining items', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const potion = player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 3,
    healAmount: 50
  })
  player.addItem(potion)

  assert.equal(player.sellItem(potion.id, 1), true)
  assert.equal(player.gold, 3)
  assert.equal(player.inventory[0]?.quantity, 2)

  assert.equal(player.sellItem(potion.id, 3), false)
  assert.equal(player.gold, 3)
  assert.equal(player.inventory[0]?.quantity, 2)
  assert.equal(player.autoMessage, 'Số lượng bán không hợp lệ')
})

test('buys a healing potion with enough gold and stacks it when possible', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  player.gold = HEALING_POTION_PRICE * 2

  assert.equal(player.buyHealingPotion(), true)
  assert.equal(player.gold, HEALING_POTION_PRICE)
  assert.equal(player.inventory.length, 1)
  assert.equal(player.inventory[0]?.quantity, 1)

  assert.equal(player.buyHealingPotion(5), false)
  assert.equal(player.gold, HEALING_POTION_PRICE)
  assert.equal(player.inventory[0]?.quantity, 1)

  player.gold = HEALING_POTION_PRICE * 5
  assert.equal(player.buyHealingPotion(5), true)
  assert.equal(player.gold, 0)
  assert.equal(player.inventory.length, 1)
  assert.equal(player.inventory[0]?.quantity, 6)
})

test('rejects potion purchases without gold or inventory capacity without charging', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  assert.equal(player.buyHealingPotion(), false)
  assert.equal(player.gold, 0)
  assert.equal(player.inventory.length, 0)

  player.gold = HEALING_POTION_PRICE
  for (let index = 0; index < INVENTORY_CAPACITY; index++) {
    player.addItem(player.createItem({
      name: `Món đồ ${index}`,
      type: 'equipment',
      rarity: 'Thường',
      quantity: 1,
      slot: 'weapon',
      attackBonus: 1
    }))
  }

  assert.equal(player.buyHealingPotion(), false)
  assert.equal(player.gold, HEALING_POTION_PRICE)
  assert.equal(player.inventory.length, INVENTORY_CAPACITY)
})

test('rejects invalid quantities and purchases that would exceed the potion stack limit', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  player.gold = HEALING_POTION_PRICE * 1000
  const potion = player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 998,
    healAmount: 50
  })
  player.addItem(potion)

  assert.equal(player.buyHealingPotion(0), false)
  assert.equal(player.buyHealingPotion(2), false)
  assert.equal(player.gold, HEALING_POTION_PRICE * 1000)
  assert.equal(player.inventory[0]?.quantity, 998)

  assert.equal(player.buyHealingPotion(1), true)
  assert.equal(player.inventory[0]?.quantity, 999)
})

test('buys equipment with the correct bonus and keeps it unequipped in the inventory', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  player.gold = EQUIPMENT_SHOP.weapon.price + EQUIPMENT_SHOP.armor.price

  assert.equal(player.buyEquipment('weapon'), true)
  assert.equal(player.gold, EQUIPMENT_SHOP.armor.price)
  assert.equal(player.inventory[0]?.slot, 'weapon')
  assert.equal(player.inventory[0]?.attackBonus, EQUIPMENT_SHOP.weapon.bonus)
  assert.equal(player.equipment.weapon, undefined)

  assert.equal(player.buyEquipment('armor'), true)
  assert.equal(player.gold, 0)
  assert.equal(player.inventory[1]?.slot, 'armor')
  assert.equal(player.inventory[1]?.defenseBonus, EQUIPMENT_SHOP.armor.bonus)
})

test('rejects equipment purchases without enough gold or a free slot', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  assert.equal(player.buyEquipment('weapon'), false)
  assert.equal(player.gold, 0)
  assert.equal(player.inventory.length, 0)

  player.gold = EQUIPMENT_SHOP.weapon.price
  for (let index = 0; index < INVENTORY_CAPACITY; index++) {
    player.addItem(player.createItem({
      name: `Món đồ ${index}`,
      type: 'equipment',
      rarity: 'Thường',
      quantity: 1,
      slot: 'weapon',
      attackBonus: 1
    }))
  }

  assert.equal(player.buyEquipment('weapon'), false)
  assert.equal(player.gold, EQUIPMENT_SHOP.weapon.price)
  assert.equal(player.inventory.length, INVENTORY_CAPACITY)
})

test('uses a healing potion, restores up to max HP, and consumes one item', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const potion = player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 2,
    healAmount: 50
  })
  player.addItem(potion)
  player.hp = 80

  assert.equal(player.useItem(potion.id), true)
  assert.equal(player.hp, 100)
  assert.equal(player.inventory[0]?.quantity, 1)

  player.hp = 100
  assert.equal(player.useItem(potion.id), false)
  assert.equal(player.inventory[0]?.quantity, 1)
  assert.equal(player.autoMessage, 'HP đã đầy; hãy dùng thuốc sau khi bị thương')
})

test('consumes the last potion and rejects use while defeated', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const potion = player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 1,
    healAmount: 50
  })
  player.addItem(potion)
  player.hp = 0

  assert.equal(player.useItem(potion.id), false)
  assert.equal(player.inventory.length, 1)
  assert.equal(player.autoMessage, 'Không thể dùng thuốc khi đang gục ngã')

  player.hp = 20
  assert.equal(player.useItem(potion.id), true)
  assert.equal(player.hp, 70)
  assert.equal(player.inventory.length, 0)
})

test('uses the first healing potion from the battle action', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const firstPotion = player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 2,
    healAmount: 50
  })
  const secondPotion = player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 1,
    healAmount: 50
  })
  player.addItem(firstPotion)
  player.addItem(secondPotion)
  player.hp = 25
  player.autoBattle = true

  assert.equal(player.useHealingPotion(), true)
  assert.equal(player.hp, 75)
  assert.equal(player.inventory[0]?.quantity, 2)
  assert.equal(player.inventory.length, 1)
})

test('auto-use potion only when health is at or below the requested ratio', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const potion = player.createItem({
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 2,
    healAmount: 50
  })
  player.addItem(potion)
  player.hp = 36

  assert.equal(player.useHealingPotionIfHpAtOrBelow(0.35), false)
  assert.equal(player.hp, 36)
  assert.equal(player.inventory[0]?.quantity, 2)

  player.hp = 35
  assert.equal(player.useHealingPotionIfHpAtOrBelow(0.35), true)
  assert.equal(player.hp, 85)
  assert.equal(player.inventory[0]?.quantity, 1)
})

const assertCombatStateIsCleared = (player: ReturnType<typeof usePlayerStore>) => {
  assert.equal(player.currentTarget, null)
  assert.equal(player.currentTargetId, null)
  assert.equal(player.currentTargetHp, 0)
  assert.equal(player.currentTargetMaxHp, 0)
  assert.equal(player.currentTargetDistance, null)
  assert.equal(player.currentTargetInRange, false)
  assert.equal(player.attackCooldownRemaining, 0)
  assert.equal(player.skillCooldownRemaining, 0)
}

test('clears stale combat target and cooldown state when auto battle is toggled off', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  player.autoBattle = true
  player.autoState = 'ATTACK'
  player.currentTarget = 'Slime'
  player.currentTargetId = 'slime-1'
  player.currentTargetHp = 25
  player.currentTargetMaxHp = 40
  player.currentTargetDistance = 60
  player.currentTargetInRange = true
  player.attackCooldownRemaining = 3
  player.skillCooldownRemaining = 2

  player.setAutoBattle(false)
  assert.equal(player.autoBattle, false)
  assert.equal(player.autoState, 'IDLE')
  assertCombatStateIsCleared(player)

  player.setAutoBattle(false)
  assertCombatStateIsCleared(player)
})

test('clears stale combat state on restore save and new game', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()

  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => (storage.has(key) ? storage.get(key) ?? null : null),
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    },
    configurable: true
  })

  player.currentTarget = 'Boss'
  player.currentTargetId = 'boss-1'
  player.currentTargetHp = 90
  player.currentTargetMaxHp = 120
  player.currentTargetDistance = 15
  player.currentTargetInRange = true
  player.attackCooldownRemaining = 7
  player.skillCooldownRemaining = 4

  player.restoreSaveData({
    version: 1,
    savedAt: new Date().toISOString(),
    level: 1,
    exp: 0,
    gold: 0,
    hp: 100,
    mp: 50,
    inventory: [],
    equipment: {},
    quests: []
  })
  assertCombatStateIsCleared(player)

  player.currentTarget = 'Wraith'
  player.currentTargetId = 'wraith-2'
  player.currentTargetHp = 55
  player.currentTargetMaxHp = 80
  player.currentTargetDistance = 10
  player.currentTargetInRange = true
  player.attackCooldownRemaining = 5
  player.skillCooldownRemaining = 6
  player.autoBattle = true
  player.autoState = 'ATTACK'

  assert.equal(player.startNewGame(), true)
  assert.equal(player.autoBattle, false)
  assert.equal(player.autoState, 'IDLE')
  assertCombatStateIsCleared(player)
})
