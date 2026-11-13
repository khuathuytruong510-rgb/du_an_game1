import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  decodeClientMessage,
  decodeServerMessage,
  GAME_PROTOCOL_VERSION
} from './gameProtocol'

test('decodes supported client commands and strips unknown fields', () => {
  const decoded = decodeClientMessage({
    v: GAME_PROTOCOL_VERSION,
    type: 'attack',
    sequence: 3,
    targetId: 'slime-1',
    action: 'basic',
    damage: 999999
  })

  assert.deepEqual(decoded, {
    ok: true,
    message: {
      v: GAME_PROTOCOL_VERSION,
      type: 'attack',
      sequence: 3,
      targetId: 'slime-1',
      action: 'basic'
    }
  })
})

test('rejects unsupported protocol versions and malformed client input', () => {
  assert.deepEqual(decodeClientMessage({
    v: GAME_PROTOCOL_VERSION + 1,
    type: 'join',
    zoneId: 'training-ground',
    lastSequence: 0
  }), { ok: false, error: 'unsupported-version' })

  assert.deepEqual(decodeClientMessage({
    v: GAME_PROTOCOL_VERSION,
    type: 'input',
    sequence: -1,
    movement: { x: 2, y: 0 },
    autoBattle: true
  }), { ok: false, error: 'invalid-message' })

  assert.deepEqual(decodeClientMessage({
    v: GAME_PROTOCOL_VERSION,
    type: 'attack',
    sequence: 1,
    targetId: 'slime-1',
    action: 'server-decides-damage'
  }), { ok: false, error: 'invalid-message' })
})

test('validates versioned movement, NPC interaction, and target commands', () => {
  assert.equal(decodeClientMessage({
    v: GAME_PROTOCOL_VERSION,
    type: 'input',
    sequence: 1,
    movement: { x: -1, y: 1 },
    autoBattle: false
  }).ok, true)

  assert.equal(decodeClientMessage({
    v: GAME_PROTOCOL_VERSION,
    type: 'interact',
    sequence: 2,
    npcId: 'blacksmith'
  }).ok, true)

  assert.equal(decodeClientMessage({
    v: GAME_PROTOCOL_VERSION,
    type: 'select_target',
    sequence: 3,
    targetId: null
  }).ok, true)
})

test('decodes acknowledgements and server-side protocol errors', () => {
  assert.deepEqual(decodeServerMessage({
    v: GAME_PROTOCOL_VERSION,
    type: 'action_result',
    sequence: 4,
    action: 'attack',
    accepted: false,
    reason: 'cooldown'
  }), {
    ok: true,
    message: {
      v: GAME_PROTOCOL_VERSION,
      type: 'action_result',
      sequence: 4,
      action: 'attack',
      accepted: false,
      reason: 'cooldown'
    }
  })

  assert.deepEqual(decodeServerMessage({
    v: GAME_PROTOCOL_VERSION,
    type: 'error',
    code: 'rate_limited',
    requestSequence: 4
  }), {
    ok: true,
    message: {
      v: GAME_PROTOCOL_VERSION,
      type: 'error',
      code: 'rate_limited',
      requestSequence: 4
    }
  })
})

test('validates authoritative snapshots and rejects impossible monster state', () => {
  const snapshot = {
    v: GAME_PROTOCOL_VERSION,
    type: 'snapshot',
    serverSequence: 8,
    acknowledgedSequence: 5,
    serverTime: 12345,
    player: {
      x: 20,
      y: 30,
      level: 2,
      exp: 85,
      gold: 73,
      maxHp: 110,
      hp: 55,
      maxMp: 55,
      mp: 28
    },
    monsters: [{
      id: 'slime-1',
      name: 'Slime',
      x: 390,
      y: 400,
      hp: 20,
      maxHp: 40,
      isAlive: true
    }]
  }

  assert.equal(decodeServerMessage(snapshot).ok, true)
  assert.deepEqual(decodeServerMessage({
    ...snapshot,
    player: { ...snapshot.player, maxHp: 200 }
  }), { ok: false, error: 'invalid-message' })
  assert.deepEqual(decodeServerMessage({
    ...snapshot,
    monsters: [{ ...snapshot.monsters[0], hp: 0, isAlive: true }]
  }), { ok: false, error: 'invalid-message' })
})
