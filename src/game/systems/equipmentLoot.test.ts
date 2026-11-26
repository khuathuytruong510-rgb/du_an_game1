import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { claimMonsterDefeat, rollEquipmentRarity, tryGrantEquipmentDrop } from './equipmentLoot'
import { INVENTORY_CAPACITY, usePlayerStore } from '../../stores/player'

test('bosses have higher equipment-drop and rarity odds than normal monsters', () => {
  let created = 0
  assert.equal(tryGrantEquipmentDrop('slime', () => 0.379, () => ++created, () => true), true)
  assert.equal(tryGrantEquipmentDrop('slime', () => 0.38, () => ++created, () => true), false)
  assert.equal(tryGrantEquipmentDrop('boss', () => 0.949, () => ++created, () => true), true)
  assert.equal(tryGrantEquipmentDrop('boss', () => 0.95, () => ++created, () => true), false)
  assert.equal(created, 2)

  const rolls = Array.from({ length: 1000 }, (_, index) => (index + 0.5) / 1000)
  const rarerThanOrEqual = (kind: 'slime' | 'boss', rarity: 'Hiếm' | 'Sử thi' | 'Huyền thoại') =>
    rolls.filter(roll => {
      const result = rollEquipmentRarity(kind, roll)
      const order = ['Thường', 'Tốt', 'Hiếm', 'Sử thi', 'Huyền thoại']
      return order.indexOf(result) >= order.indexOf(rarity)
    }).length

  for (const rarity of ['Hiếm', 'Sử thi', 'Huyền thoại'] as const) {
    assert.ok(rarerThanOrEqual('boss', rarity) > rarerThanOrEqual('slime', rarity))
  }
})

test('equipment drops insert into inventory and fail cleanly when it is full', () => {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  const added = tryGrantEquipmentDrop(
    'slime',
    () => 0,
    () => player.createItem({
      name: 'Thường Kiếm',
      type: 'equipment',
      rarity: 'Thường',
      quantity: 1,
      slot: 'weapon',
      attackBonus: 1
    }),
    item => player.addItem(item)
  )
  assert.equal(added, true)
  assert.equal(player.inventory.length, 1)

  while (player.inventory.length < INVENTORY_CAPACITY) {
    player.addItem(player.createItem({
      name: `Equipment ${player.inventory.length}`,
      type: 'equipment',
      rarity: 'Thường',
      quantity: 1,
      slot: 'weapon',
      attackBonus: 1
    }))
  }
  const fullInventoryLength = player.inventory.length
  const overflowAdded = tryGrantEquipmentDrop(
    'boss',
    () => 0,
    () => player.createItem({
      name: 'Huyền thoại Kiếm',
      type: 'equipment',
      rarity: 'Huyền thoại',
      quantity: 1,
      slot: 'weapon',
      attackBonus: 10
    }),
    item => player.addItem(item)
  )
  assert.equal(overflowAdded, false)
  assert.equal(player.inventory.length, fullInventoryLength)
  assert.equal(player.inventory.some(item => item.name === 'Huyền thoại Kiếm'), false)
})

test('a monster defeat is claimed once per life, including around respawn', () => {
  const monster = { alive: true }
  assert.equal(claimMonsterDefeat(monster), true)
  assert.equal(claimMonsterDefeat(monster), false)

  monster.alive = true
  assert.equal(claimMonsterDefeat(monster), true)
  assert.equal(claimMonsterDefeat(monster), false)
})
