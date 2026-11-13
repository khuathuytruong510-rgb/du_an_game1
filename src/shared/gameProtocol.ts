export const GAME_PROTOCOL_VERSION = 1 as const
export const GAME_ZONE_IDS = ['training-ground'] as const

export type GameZoneId = typeof GAME_ZONE_IDS[number]
export type MovementAxis = -1 | 0 | 1
export type CombatAction = 'basic' | 'skill'

interface ClientMessageBase {
  v: typeof GAME_PROTOCOL_VERSION
}

export type ClientMessage =
  | (ClientMessageBase & {
      type: 'join'
      zoneId: GameZoneId
      lastSequence: number
    })
  | (ClientMessageBase & {
      type: 'input'
      sequence: number
      movement: { x: MovementAxis; y: MovementAxis }
      autoBattle: boolean
    })
  | (ClientMessageBase & {
      type: 'select_target'
      sequence: number
      targetId: string | null
    })
  | (ClientMessageBase & {
      type: 'attack'
      sequence: number
      targetId: string
      action: CombatAction
    })
  | (ClientMessageBase & {
      type: 'use_item'
      sequence: number
      itemId: string
    })
  | (ClientMessageBase & {
      type: 'interact'
      sequence: number
      npcId: 'blacksmith'
    })

export interface PlayerSnapshot {
  x: number
  y: number
  level: number
  exp: number
  gold: number
  maxHp: number
  hp: number
  maxMp: number
  mp: number
}

export interface MonsterSnapshot {
  id: string
  name: string
  x: number
  y: number
  hp: number
  maxHp: number
  isAlive: boolean
}

interface ServerMessageBase {
  v: typeof GAME_PROTOCOL_VERSION
}

export type ServerMessage =
  | (ServerMessageBase & {
      type: 'joined'
      zoneId: GameZoneId
      serverTime: number
    })
  | (ServerMessageBase & {
      type: 'snapshot'
      serverSequence: number
      acknowledgedSequence: number
      serverTime: number
      player: PlayerSnapshot
      monsters: MonsterSnapshot[]
    })
  | (ServerMessageBase & {
      type: 'action_result'
      sequence: number
      action: 'attack' | 'skill' | 'use_item'
      accepted: boolean
      reason?: string
    })
  | (ServerMessageBase & {
      type: 'error'
      code:
        | 'invalid_message'
        | 'unsupported_version'
        | 'not_joined'
        | 'rate_limited'
        | 'gameplay_unavailable'
      requestSequence?: number
    })

type ActionResultAction = Extract<ServerMessage, { type: 'action_result' }>['action']
type ProtocolErrorCode = Extract<ServerMessage, { type: 'error' }>['code']

export type ProtocolDecodeError = 'invalid-message' | 'unsupported-version'

export type ProtocolDecodeResult<T> =
  | { ok: true; message: T }
  | { ok: false; error: ProtocolDecodeError }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSafeSequence = (value: unknown, allowZero = false): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  (allowZero ? value >= 0 : value > 0)

const isId = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maxLength

const isMovementAxis = (value: unknown): value is MovementAxis =>
  value === -1 || value === 0 || value === 1

const isZoneId = (value: unknown): value is GameZoneId =>
  value === 'training-ground'

const isCombatAction = (value: unknown): value is CombatAction =>
  value === 'basic' || value === 'skill'

const isActionResultAction = (value: unknown): value is ActionResultAction =>
  value === 'attack' || value === 'skill' || value === 'use_item'

const isProtocolErrorCode = (value: unknown): value is ProtocolErrorCode =>
  value === 'invalid_message' ||
  value === 'unsupported_version' ||
  value === 'not_joined' ||
  value === 'rate_limited' ||
  value === 'gameplay_unavailable'

const hasProtocolVersion = (
  value: Record<string, unknown>
): ProtocolDecodeResult<never> | null => {
  if (!Number.isInteger(value.v)) return { ok: false, error: 'invalid-message' }
  if (value.v !== GAME_PROTOCOL_VERSION) return { ok: false, error: 'unsupported-version' }
  return null
}

export const decodeClientMessage = (value: unknown): ProtocolDecodeResult<ClientMessage> => {
  if (!isRecord(value)) return { ok: false, error: 'invalid-message' }
  const versionError = hasProtocolVersion(value)
  if (versionError) return versionError

  if (value.type === 'join') {
    if (!isZoneId(value.zoneId) || !isSafeSequence(value.lastSequence, true)) {
      return { ok: false, error: 'invalid-message' }
    }
    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'join',
        zoneId: value.zoneId,
        lastSequence: value.lastSequence
      }
    }
  }

  if (!isSafeSequence(value.sequence)) return { ok: false, error: 'invalid-message' }

  if (value.type === 'input') {
    if (
      !isRecord(value.movement) ||
      !isMovementAxis(value.movement.x) ||
      !isMovementAxis(value.movement.y) ||
      typeof value.autoBattle !== 'boolean'
    ) return { ok: false, error: 'invalid-message' }

    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'input',
        sequence: value.sequence,
        movement: { x: value.movement.x, y: value.movement.y },
        autoBattle: value.autoBattle
      }
    }
  }

  if (value.type === 'select_target') {
    if (value.targetId !== null && !isId(value.targetId, 64)) {
      return { ok: false, error: 'invalid-message' }
    }
    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'select_target',
        sequence: value.sequence,
        targetId: value.targetId
      }
    }
  }

  if (value.type === 'attack') {
    if (!isId(value.targetId, 64) || !isCombatAction(value.action)) {
      return { ok: false, error: 'invalid-message' }
    }
    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'attack',
        sequence: value.sequence,
        targetId: value.targetId,
        action: value.action
      }
    }
  }

  if (value.type === 'use_item') {
    if (!isId(value.itemId, 128)) return { ok: false, error: 'invalid-message' }
    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'use_item',
        sequence: value.sequence,
        itemId: value.itemId
      }
    }
  }

  if (value.type === 'interact') {
    if (value.npcId !== 'blacksmith') return { ok: false, error: 'invalid-message' }
    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'interact',
        sequence: value.sequence,
        npcId: 'blacksmith'
      }
    }
  }

  return { ok: false, error: 'invalid-message' }
}

const isFiniteNumber = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

const isPlayerSnapshot = (value: unknown): value is PlayerSnapshot =>
  isRecord(value) &&
  isFiniteNumber(value.x, 0, 10000) &&
  isFiniteNumber(value.y, 0, 10000) &&
  isFiniteNumber(value.level, 1, 30) &&
  Number.isInteger(value.level) &&
  isFiniteNumber(value.exp, 0, 89999) &&
  Number.isSafeInteger(value.exp) &&
  value.exp < 100 * value.level ** 2 &&
  isFiniteNumber(value.gold, 0, Number.MAX_SAFE_INTEGER) &&
  Number.isSafeInteger(value.gold) &&
  isFiniteNumber(value.maxHp, 100, 390) &&
  Number.isInteger(value.maxHp) &&
  value.maxHp === 100 + (value.level - 1) * 10 &&
  isFiniteNumber(value.hp, 0, value.maxHp) &&
  Number.isInteger(value.hp) &&
  isFiniteNumber(value.maxMp, 50, 195) &&
  Number.isInteger(value.maxMp) &&
  value.maxMp === 50 + (value.level - 1) * 5 &&
  isFiniteNumber(value.mp, 0, value.maxMp) &&
  Number.isInteger(value.mp)

const isMonsterSnapshot = (value: unknown): value is MonsterSnapshot =>
  isRecord(value) &&
  isId(value.id, 64) &&
  isId(value.name, 64) &&
  isFiniteNumber(value.x, 0, 10000) &&
  isFiniteNumber(value.y, 0, 10000) &&
  isFiniteNumber(value.hp, 0, 100000) &&
  Number.isInteger(value.hp) &&
  isFiniteNumber(value.maxHp, 1, 100000) &&
  Number.isInteger(value.maxHp) &&
  value.hp <= value.maxHp &&
  typeof value.isAlive === 'boolean' &&
  value.isAlive === (value.hp > 0)

export const decodeServerMessage = (value: unknown): ProtocolDecodeResult<ServerMessage> => {
  if (!isRecord(value)) return { ok: false, error: 'invalid-message' }
  const versionError = hasProtocolVersion(value)
  if (versionError) return versionError

  if (value.type === 'joined') {
    if (
      !isZoneId(value.zoneId) ||
      !isFiniteNumber(value.serverTime, 0, Number.MAX_SAFE_INTEGER)
    ) return { ok: false, error: 'invalid-message' }
    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'joined',
        zoneId: value.zoneId,
        serverTime: value.serverTime
      }
    }
  }

  if (value.type === 'snapshot') {
    if (
      !isSafeSequence(value.serverSequence, true) ||
      !isSafeSequence(value.acknowledgedSequence, true) ||
      !isFiniteNumber(value.serverTime, 0, Number.MAX_SAFE_INTEGER) ||
      !isPlayerSnapshot(value.player) ||
      !Array.isArray(value.monsters) ||
      value.monsters.length > 128 ||
      !value.monsters.every(isMonsterSnapshot) ||
      new Set(value.monsters.map(monster => monster.id)).size !== value.monsters.length
    ) return { ok: false, error: 'invalid-message' }
    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'snapshot',
        serverSequence: value.serverSequence,
        acknowledgedSequence: value.acknowledgedSequence,
        serverTime: value.serverTime,
        player: value.player,
        monsters: value.monsters
      }
    }
  }

  if (value.type === 'action_result') {
    if (
      !isSafeSequence(value.sequence) ||
      !isActionResultAction(value.action) ||
      typeof value.accepted !== 'boolean' ||
      (value.reason !== undefined && !isId(value.reason, 128))
    ) return { ok: false, error: 'invalid-message' }
    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'action_result',
        sequence: value.sequence,
        action: value.action,
        accepted: value.accepted,
        ...(value.reason === undefined ? {} : { reason: value.reason })
      }
    }
  }

  if (value.type === 'error') {
    if (
      !isProtocolErrorCode(value.code) ||
      (value.requestSequence !== undefined && !isSafeSequence(value.requestSequence))
    ) return { ok: false, error: 'invalid-message' }
    return {
      ok: true,
      message: {
        v: GAME_PROTOCOL_VERSION,
        type: 'error',
        code: value.code,
        ...(value.requestSequence === undefined ? {} : { requestSequence: value.requestSequence })
      }
    }
  }

  return { ok: false, error: 'invalid-message' }
}
