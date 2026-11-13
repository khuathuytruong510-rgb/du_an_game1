import { randomInt } from 'node:crypto'
import type { ServerCharacter } from './app.js'
import type {
  ClientMessage,
  GameZoneId,
  MonsterSnapshot,
  PlayerSnapshot,
  ServerMessage
} from '../shared/gameProtocol.js'

const TICK_RATE = 10
const TICK_MS = 1000 / TICK_RATE
const WORLD_WIDTH = 1600
const GROUND_Y = 518
const PLAYER_Y = GROUND_Y - 22
const PLAYER_SPEED = 220
const ATTACK_RANGE = 76
const AUTO_FARM_RADIUS = 380
const BASIC_COOLDOWN_MS = 850
const SKILL_COOLDOWN_MS = 4000
const SKILL_COST = 15
const MONSTER_ATTACK_RANGE = 86
const PLAYER_RESPAWN_MS = 3000
const MONSTER_RESPAWN_MS = 6000
const MAX_DELTA_MS = 250

interface SimulatedMonster extends MonsterSnapshot {
  expValue: number
  attackDamage: number
  attackCooldown: number
  minGold: number
  maxGold: number
  nextAttackAt: number
  respawnAt: number | null
}

export interface GameSimulationOptions {
  random?: () => number
  randomInteger?: (minInclusive: number, maxExclusive: number) => number
  now?: () => number
}

export type SimulationActionResult = {
  type: 'action_result'
  sequence: number
  action: 'attack' | 'skill' | 'use_item'
  accepted: boolean
  reason?: string
}

export class GameSimulation {
  readonly zoneId: GameZoneId
  private readonly random: () => number
  private readonly randomInteger: (minInclusive: number, maxExclusive: number) => number
  private readonly now: () => number
  private readonly player: PlayerSnapshot
  private readonly monsters: SimulatedMonster[]
  private readonly equippedWeaponBonus: number
  private readonly potionCounts = new Map<string, number>()
  private readonly potionHealAmounts = new Map<string, number>()
  private readonly armorDefense: number
  private selectedTargetId: string | null = null
  private movementX = 0
  private movementY = 0
  private autoBattle = false
  private nextBasicAt = 0
  private nextSkillAt = 0
  private playerRespawnAt: number | null = null
  private lastTickAt: number
  private manaRegenElapsed = 0

  constructor(
    zoneId: GameZoneId,
    character: ServerCharacter,
    options: GameSimulationOptions = {}
  ) {
    this.zoneId = zoneId
    this.random = options.random ?? Math.random
    this.randomInteger = options.randomInteger ?? randomInt
    this.now = options.now ?? Date.now
    this.lastTickAt = this.now()
    const level = character.level
    this.player = {
      x: 120,
      y: PLAYER_Y,
      level,
      exp: character.exp,
      gold: character.gold,
      maxHp: 100 + (level - 1) * 10,
      hp: Math.min(character.hp, 100 + (level - 1) * 10),
      maxMp: 50 + (level - 1) * 5,
      mp: Math.min(character.mp, 50 + (level - 1) * 5)
    }
    const weapon = character.equipment.weapon
    this.equippedWeaponBonus = weapon && typeof weapon.attackBonus === 'number'
      ? weapon.attackBonus
      : 0
    const armor = character.equipment.armor
    this.armorDefense = armor
      ? typeof armor.defenseBonus === 'number'
        ? armor.defenseBonus
        : typeof armor.attackBonus === 'number'
          ? armor.attackBonus
          : 0
      : 0

    for (const item of character.inventory) {
      if (
        item.type === 'consumable' &&
        item.name === 'Thuốc hồi phục' &&
        typeof item.id === 'string' &&
        Number.isInteger(item.quantity) &&
        (item.quantity as number) > 0
      ) {
        this.potionCounts.set(item.id, item.quantity as number)
        this.potionHealAmounts.set(
          item.id,
          typeof item.healAmount === 'number' ? item.healAmount : 50
        )
      }
    }

    this.monsters = [
      { id: 'slime-1', name: 'Slime', x: 390, y: GROUND_Y - 18, hp: 40, maxHp: 40, isAlive: true, expValue: 12, attackDamage: 5, attackCooldown: 1800, minGold: 2, maxGold: 5, nextAttackAt: 0, respawnAt: null },
      { id: 'slime-2', name: 'Slime', x: 650, y: GROUND_Y - 18, hp: 50, maxHp: 50, isAlive: true, expValue: 14, attackDamage: 6, attackCooldown: 1700, minGold: 2, maxGold: 5, nextAttackAt: 0, respawnAt: null },
      { id: 'wolf-1', name: 'Sói non', x: 920, y: GROUND_Y - 18, hp: 65, maxHp: 65, isAlive: true, expValue: 18, attackDamage: 8, attackCooldown: 1600, minGold: 5, maxGold: 9, nextAttackAt: 0, respawnAt: null },
      { id: 'wolf-2', name: 'Sói non', x: 1200, y: GROUND_Y - 18, hp: 70, maxHp: 70, isAlive: true, expValue: 20, attackDamage: 9, attackCooldown: 1500, minGold: 5, maxGold: 9, nextAttackAt: 0, respawnAt: null },
      { id: 'goblin-1', name: 'Goblin', x: 1470, y: GROUND_Y - 18, hp: 90, maxHp: 90, isAlive: true, expValue: 25, attackDamage: 11, attackCooldown: 1400, minGold: 8, maxGold: 14, nextAttackAt: 0, respawnAt: null }
    ]
  }

  handle(message: Exclude<ClientMessage, { type: 'join' }>): SimulationActionResult | null {
    if (message.type === 'input') {
      if (this.playerRespawnAt !== null || this.player.hp <= 0) {
        this.movementX = 0
        this.movementY = 0
        this.autoBattle = false
        return null
      }
      this.movementX = message.movement.x
      this.movementY = message.movement.y
      this.autoBattle = message.autoBattle
      return null
    }

    if (message.type === 'select_target') {
      const target = message.targetId === null
        ? null
        : this.monsters.find(monster => monster.id === message.targetId && monster.isAlive)
      this.selectedTargetId = target?.id ?? null
      return null
    }

    if (message.type === 'attack') {
      const action = message.action === 'skill' ? 'skill' : 'attack'
      if (this.playerRespawnAt !== null || this.player.hp <= 0) {
        return { type: 'action_result', sequence: message.sequence, action, accepted: false, reason: 'player_defeated' }
      }
      if (this.autoBattle) {
        return { type: 'action_result', sequence: message.sequence, action, accepted: false, reason: 'auto_battle_enabled' }
      }
      const target = this.monsters.find(monster => monster.id === message.targetId && monster.isAlive)
      if (!target) {
        return { type: 'action_result', sequence: message.sequence, action, accepted: false, reason: 'target_unavailable' }
      }
      if (this.distanceTo(target) > ATTACK_RANGE) {
        return { type: 'action_result', sequence: message.sequence, action, accepted: false, reason: 'target_out_of_range' }
      }

      const currentTime = this.now()
      if (message.action === 'skill') {
        if (currentTime < this.nextSkillAt) {
          return { type: 'action_result', sequence: message.sequence, action, accepted: false, reason: 'skill_cooldown' }
        }
        if (this.player.mp < SKILL_COST) {
          return { type: 'action_result', sequence: message.sequence, action, accepted: false, reason: 'insufficient_mp' }
        }
        this.player.mp -= SKILL_COST
        this.nextSkillAt = currentTime + SKILL_COOLDOWN_MS
        this.damageMonster(target, Math.floor((10 + this.equippedWeaponBonus) * 2))
      } else {
        if (currentTime < this.nextBasicAt) {
          return { type: 'action_result', sequence: message.sequence, action, accepted: false, reason: 'attack_cooldown' }
        }
        this.nextBasicAt = currentTime + BASIC_COOLDOWN_MS
        const critical = this.random() < 0.1
        this.damageMonster(
          target,
          Math.floor((10 + this.equippedWeaponBonus) * (critical ? 2 : 1))
        )
      }
      return { type: 'action_result', sequence: message.sequence, action, accepted: true }
    }

    if (message.type === 'use_item') {
      if (this.player.hp <= 0 || this.playerRespawnAt !== null) {
        return { type: 'action_result', sequence: message.sequence, action: 'use_item', accepted: false, reason: 'player_defeated' }
      }
      const quantity = this.potionCounts.get(message.itemId) ?? 0
      if (quantity <= 0 || this.player.hp >= this.player.maxHp) {
        return { type: 'action_result', sequence: message.sequence, action: 'use_item', accepted: false, reason: 'item_unavailable' }
      }
      const healAmount = this.potionHealAmounts.get(message.itemId) ?? 50
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount)
      if (quantity === 1) this.potionCounts.delete(message.itemId)
      else this.potionCounts.set(message.itemId, quantity - 1)
      return { type: 'action_result', sequence: message.sequence, action: 'use_item', accepted: true }
    }

    return null
  }

  tick(acknowledgedSequence = 0): ServerMessage {
    const now = this.now()
    const delta = Math.min(MAX_DELTA_MS, Math.max(0, now - this.lastTickAt))
    this.lastTickAt = now

    if (this.playerRespawnAt !== null) {
      if (now >= this.playerRespawnAt) this.respawn(now)
    } else {
      this.movePlayer(delta)
      if (this.autoBattle) this.updateAutoBattle(now, delta)
      this.updateMonsterAttacks(now)
      this.regenerateMana(delta)
    }
    this.updateMonsterRespawns(now)

    return this.snapshot(now, acknowledgedSequence)
  }

  snapshot(serverTime = this.now(), acknowledgedSequence = 0): ServerMessage {
    return {
      v: 1,
      type: 'snapshot',
      serverSequence: Math.max(0, Math.floor(serverTime / TICK_MS)),
      acknowledgedSequence,
      serverTime,
      player: { ...this.player },
      monsters: this.monsters.map(({ id, name, x, y, hp, maxHp, isAlive }) => ({
        id, name, x, y, hp, maxHp, isAlive
      }))
    }
  }

  private movePlayer(delta: number) {
    if (this.autoBattle || delta <= 0) return
    const length = Math.hypot(this.movementX, this.movementY)
    if (length === 0) return
    const distance = PLAYER_SPEED * delta / 1000 / length
    this.player.x = Math.min(WORLD_WIDTH - 30, Math.max(30, this.player.x + this.movementX * distance))
    this.player.y = Math.min(GROUND_Y - 5, Math.max(70, this.player.y + this.movementY * distance))
  }

  private updateAutoBattle(now: number, delta: number) {
    let target = this.monsters.find(monster => monster.id === this.selectedTargetId && monster.isAlive)
    if (!target || this.distanceTo(target) > AUTO_FARM_RADIUS) {
      target = this.monsters
        .filter(monster => monster.isAlive && this.distanceTo(monster) <= AUTO_FARM_RADIUS)
        .sort((left, right) => this.distanceTo(left) - this.distanceTo(right))[0]
      this.selectedTargetId = target?.id ?? null
    }
    if (!target) return

    const distance = this.distanceTo(target)
    if (distance > ATTACK_RANGE - 2) {
      const step = Math.min(190 * delta / 1000, distance - (ATTACK_RANGE - 2))
      const ratio = step / distance
      this.player.x += (target.x - this.player.x) * ratio
      this.player.y += (target.y - this.player.y) * ratio
      return
    }

    if (now < this.nextBasicAt) return
    if (this.player.mp >= SKILL_COST && now >= this.nextSkillAt) {
      this.player.mp -= SKILL_COST
      this.nextSkillAt = now + SKILL_COOLDOWN_MS
      this.damageMonster(target, Math.floor((10 + this.equippedWeaponBonus) * 2))
      return
    }
    this.nextBasicAt = now + BASIC_COOLDOWN_MS
    const critical = this.random() < 0.1
    this.damageMonster(
      target,
      Math.floor((10 + this.equippedWeaponBonus) * (critical ? 2 : 1))
    )
  }

  private updateMonsterAttacks(now: number) {
    if (this.player.hp <= 0) return
    for (const monster of this.monsters) {
      if (!monster.isAlive || now < monster.nextAttackAt || this.distanceTo(monster) > MONSTER_ATTACK_RANGE) continue
      monster.nextAttackAt = now + monster.attackCooldown
      const armor = this.getArmorDefense()
      this.player.hp = Math.max(0, this.player.hp - Math.max(1, monster.attackDamage - armor))
      if (this.player.hp === 0) {
        this.playerRespawnAt = now + PLAYER_RESPAWN_MS
        this.autoBattle = false
        this.movementX = 0
        this.movementY = 0
        break
      }
    }
  }

  private updateMonsterRespawns(now: number) {
    for (const monster of this.monsters) {
      if (monster.respawnAt === null || now < monster.respawnAt) continue
      monster.hp = monster.maxHp
      monster.isAlive = true
      monster.respawnAt = null
      monster.nextAttackAt = now + monster.attackCooldown
    }
  }

  private regenerateMana(delta: number) {
    if (delta <= 0 || this.player.mp >= this.player.maxMp) return
    this.manaRegenElapsed += delta
    const regenPoints = Math.floor(this.manaRegenElapsed / 1000)
    if (regenPoints === 0) return
    this.manaRegenElapsed %= 1000
    this.player.mp = Math.min(this.player.maxMp, this.player.mp + regenPoints)
  }

  private respawn(now: number) {
    this.playerRespawnAt = null
    this.player.x = 120
    this.player.y = PLAYER_Y
    this.player.hp = Math.ceil(this.player.maxHp / 2)
    this.nextBasicAt = now
    this.nextSkillAt = now
    this.selectedTargetId = null
    for (const monster of this.monsters) monster.nextAttackAt = now + monster.attackCooldown
  }

  private damageMonster(monster: SimulatedMonster, damage: number) {
    monster.hp = Math.max(0, monster.hp - damage)
    if (monster.hp !== 0) return
    monster.isAlive = false
    monster.respawnAt = this.now() + MONSTER_RESPAWN_MS
    if (this.selectedTargetId === monster.id) this.selectedTargetId = null
    this.player.gold += this.randomInteger(monster.minGold, monster.maxGold + 1)
    this.grantExperience(monster.expValue)
  }

  private grantExperience(amount: number) {
    this.player.exp += amount
    while (this.player.level < 30 && this.player.exp >= 100 * this.player.level ** 2) {
      this.player.exp -= 100 * this.player.level ** 2
      this.player.level += 1
      this.player.maxHp = 100 + (this.player.level - 1) * 10
      this.player.maxMp = 50 + (this.player.level - 1) * 5
      this.player.hp = this.player.maxHp
      this.player.mp = this.player.maxMp
      this.player.gold += 10
    }
    if (this.player.level >= 30) this.player.exp = 0
  }

  private getArmorDefense() {
    return this.armorDefense
  }

  private distanceTo(target: Pick<MonsterSnapshot, 'x' | 'y'>) {
    return Math.hypot(target.x - this.player.x, target.y - this.player.y)
  }
}
