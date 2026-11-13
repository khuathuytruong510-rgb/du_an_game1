import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ServerCharacter } from './app'
import { GameSimulation } from './gameSimulation'
import type { ClientMessage, ServerMessage } from '../shared/gameProtocol'

const makeCharacter = (overrides: Partial<ServerCharacter> = {}): ServerCharacter => ({
  version: 1,
  level: 1,
  exp: 0,
  gold: 0,
  hp: 100,
  mp: 50,
  inventory: [],
  equipment: {},
  quests: [
    { id: 'slime-hunt', progress: 0, claimed: false },
    { id: 'spirit-shards', progress: 0, claimed: false }
  ],
  savedAt: new Date(0).toISOString(),
  ...overrides
})

const send = (
  simulation: GameSimulation,
  message: Exclude<ClientMessage, { type: 'join' }>
) => simulation.handle(message)

const snapshot = (message: ServerMessage) => {
  assert.equal(message.type, 'snapshot')
  if (message.type !== 'snapshot') throw new Error('Expected authoritative snapshot')
  return message
}

test('only server input moves the player and snapshots reflect clamped movement', () => {
  let now = 1000
  const simulation = new GameSimulation('training-ground', makeCharacter(), { now: () => now })
  const initial = snapshot(simulation.tick())
  assert.equal(initial.player.x, 120)

  send(simulation, {
    v: 1,
    type: 'input',
    sequence: 1,
    movement: { x: 1, y: 0 },
    autoBattle: false
  })
  now += 100
  const moved = snapshot(simulation.tick())
  assert.equal(moved.player.x, 142)
  assert.equal(moved.player.y, 496)
})

test('validates server-side range and cooldown before applying basic attacks', () => {
  let now = 1000
  const simulation = new GameSimulation('training-ground', makeCharacter(), {
    now: () => now,
    random: () => 0.9
  })
  const rejected = send(simulation, {
    v: 1,
    type: 'attack',
    sequence: 1,
    targetId: 'slime-1',
    action: 'basic'
  })
  assert.deepEqual(rejected, {
    type: 'action_result',
    sequence: 1,
    action: 'attack',
    accepted: false,
    reason: 'target_out_of_range'
  })

  send(simulation, {
    v: 1,
    type: 'input',
    sequence: 2,
    movement: { x: 1, y: 0 },
    autoBattle: false
  })
  for (let index = 0; index < 4; index++) {
    now += 250
    simulation.tick()
  }
  const accepted = send(simulation, {
    v: 1,
    type: 'attack',
    sequence: 3,
    targetId: 'slime-1',
    action: 'basic'
  })
  assert.equal(accepted?.type, 'action_result')
  if (accepted?.type !== 'action_result') throw new Error('Expected attack acknowledgement')
  assert.equal(accepted.accepted, true)
  assert.equal(snapshot(simulation.tick()).monsters[0]?.hp, 30)

  now += 100
  const cooldown = send(simulation, {
    v: 1,
    type: 'attack',
    sequence: 4,
    targetId: 'slime-1',
    action: 'basic'
  })
  assert.deepEqual(cooldown, {
    type: 'action_result',
    sequence: 4,
    action: 'attack',
    accepted: false,
    reason: 'attack_cooldown'
  })
})

test('server decides skill cost, damage, gold and experience on monster defeat', () => {
  let now = 1000
  const simulation = new GameSimulation(
    'training-ground',
    makeCharacter({
      equipment: {
        weapon: {
          id: 'equipped-sword',
          name: 'Kiếm tập sự',
          type: 'equipment',
          rarity: 'Tốt',
          quantity: 1,
          slot: 'weapon',
          attackBonus: 4
        }
      }
    }),
    {
      now: () => now,
      random: () => 0.9,
      randomInteger: min => min
    }
  )

  send(simulation, {
    v: 1,
    type: 'input',
    sequence: 1,
    movement: { x: 1, y: 0 },
    autoBattle: false
  })
  for (let index = 0; index < 4; index++) {
    now += 250
    simulation.tick()
  }
  send(simulation, {
    v: 1,
    type: 'select_target',
    sequence: 2,
    targetId: 'slime-1'
  })

  const firstSkill = send(simulation, {
    v: 1,
    type: 'attack',
    sequence: 3,
    targetId: 'slime-1',
    action: 'skill'
  })
  assert.equal(firstSkill?.type, 'action_result')
  let state = snapshot(simulation.tick())
  assert.equal(state.player.mp, 35)
  assert.equal(state.monsters[0]?.hp, 12)

  const cooldownSkill = send(simulation, {
    v: 1,
    type: 'attack',
    sequence: 4,
    targetId: 'slime-1',
    action: 'skill'
  })
  assert.equal(cooldownSkill?.type, 'action_result')
  if (cooldownSkill?.type !== 'action_result') throw new Error('Expected skill acknowledgement')
  assert.equal(cooldownSkill.accepted, false)
  assert.equal(cooldownSkill.reason, 'skill_cooldown')

  now += 4000
  const killingSkill = send(simulation, {
    v: 1,
    type: 'attack',
    sequence: 5,
    targetId: 'slime-1',
    action: 'skill'
  })
  assert.equal(killingSkill?.type, 'action_result')
  state = snapshot(simulation.tick())
  assert.equal(state.monsters[0]?.hp, 0)
  assert.equal(state.monsters[0]?.isAlive, false)
  assert.equal(state.player.exp, 12)
  assert.equal(state.player.gold, 2)
})

test('auto battle selects, approaches and attacks using only server-owned state', () => {
  let now = 1000
  const simulation = new GameSimulation('training-ground', makeCharacter(), {
    now: () => now,
    random: () => 0.9
  })
  send(simulation, {
    v: 1,
    type: 'input',
    sequence: 1,
    movement: { x: 0, y: 0 },
    autoBattle: true
  })

  let state = snapshot(simulation.tick())
  for (let index = 0; index < 8; index++) {
    now += 250
    state = snapshot(simulation.tick())
  }
  assert.ok(state.player.x > 120)
  assert.ok(state.monsters[0]!.hp < state.monsters[0]!.maxHp)
})

test('consumes only owned potions and applies healing on the server', () => {
  let now = 1000
  const simulation = new GameSimulation('training-ground', makeCharacter({
    hp: 40,
    inventory: [{
      id: 'potion-1',
      name: 'Thuốc hồi phục',
      type: 'consumable',
      rarity: 'Thường',
      quantity: 1,
      healAmount: 50
    }]
  }), { now: () => now })

  assert.deepEqual(send(simulation, {
    v: 1,
    type: 'use_item',
    sequence: 1,
    itemId: 'other-potion'
  }), {
    type: 'action_result',
    sequence: 1,
    action: 'use_item',
    accepted: false,
    reason: 'item_unavailable'
  })

  const used = send(simulation, {
    v: 1,
    type: 'use_item',
    sequence: 2,
    itemId: 'potion-1'
  })
  assert.equal(used?.type, 'action_result')
  assert.equal(snapshot(simulation.tick()).player.hp, 90)
  assert.deepEqual(send(simulation, {
    v: 1,
    type: 'use_item',
    sequence: 3,
    itemId: 'potion-1'
  }), {
    type: 'action_result',
    sequence: 3,
    action: 'use_item',
    accepted: false,
    reason: 'item_unavailable'
  })
})
