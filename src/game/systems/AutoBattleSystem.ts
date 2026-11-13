export type AutoState = 'IDLE' | 'SEARCH' | 'MOVE_TO_TARGET' | 'ATTACK' | 'CAST_SKILL'

export interface Monster {
  id: string
  name: string
  x: number
  y: number
  hp: number
  maxHp: number
  expValue: number
  isAlive: boolean
}

export type ApproachResult = 'moving' | 'arrived' | 'unavailable'

export interface AutoBattleConfig {
  farmRadius: number
  attackRadius: number
  moveSpeed: number
  attackCooldown: number
  skillCooldown: number
  skillMpCost: number
  criticalChance: number
}

interface PlayerPosition {
  x: number
  y: number
}

interface AutoBattleCallbacks {
  onStatus: (state: AutoState, target: Monster | null, message: string) => void
  onMove: (x: number, y: number) => void
  canAct: () => boolean
  onUseSkill: (mpCost: number) => boolean
  getAttackPower: () => number
  onDamage: (monster: Monster, damage: number, critical: boolean) => void
  onDefeat: (monster: Monster) => void
  onWarning: (message: string) => void
}

const defaultConfig: AutoBattleConfig = {
  farmRadius: 380,
  attackRadius: 76,
  moveSpeed: 190,
  attackCooldown: 850,
  skillCooldown: 4000,
  skillMpCost: 15,
  criticalChance: 0.1
}

export class AutoBattleSystem {
  private readonly config: AutoBattleConfig
  private readonly callbacks: AutoBattleCallbacks
  private readonly player: PlayerPosition
  private monsters: Monster[] = []
  private enabled = false
  private target: Monster | null = null
  private lastAttackAt = -Infinity
  private nextSkillAt = 0
  private lastStatus = ''
  private disposed = false

  constructor(
    player: PlayerPosition,
    callbacks: AutoBattleCallbacks,
    config: Partial<AutoBattleConfig> = {},
    private readonly random: () => number = Math.random
  ) {
    this.player = player
    this.callbacks = callbacks
    this.config = { ...defaultConfig, ...config }
  }

  setMonsters(monsters: Monster[]) {
    if (this.disposed) return

    this.monsters = [...monsters]
    if (this.target && (!this.monsters.includes(this.target) || !this.target.isAlive)) {
      this.clearTarget(this.enabled ? 'SEARCH' : 'IDLE', 'Mục tiêu không còn khả dụng')
    }
  }

  dispose() {
    this.disposed = true
    this.enabled = false
    this.target = null
    this.monsters = []
    this.resetCooldowns()
  }

  getAttackCooldownRemaining(now: number): number {
    return Math.max(0, this.config.attackCooldown - (now - this.lastAttackAt))
  }

  getSkillCooldownRemaining(now: number): number {
    return Math.max(0, this.nextSkillAt - now)
  }

  getSelectedTargetDistance(): number | null {
    const target = this.getValidTarget()
    return target ? this.distanceTo(target) : null
  }

  isSelectedTargetInRange(): boolean {
    const distance = this.getSelectedTargetDistance()
    return distance !== null && distance <= this.config.attackRadius
  }

  moveTowardSelectedTarget(delta: number): ApproachResult {
    if (this.disposed || this.enabled || !Number.isFinite(delta) || delta <= 0) {
      return 'unavailable'
    }
    const target = this.getValidTarget()
    if (!target) {
      this.clearSelectedTarget()
      return 'unavailable'
    }

    const distance = this.distanceTo(target)
    const stopDistance = Math.max(0, this.config.attackRadius - 2)
    if (distance <= stopDistance) return 'arrived'

    const step = Math.min(this.config.moveSpeed * delta / 1000, distance - stopDistance)
    const ratio = step / distance
    this.player.x += (target.x - this.player.x) * ratio
    this.player.y += (target.y - this.player.y) * ratio
    this.callbacks.onMove(this.player.x, this.player.y)

    return distance - step <= stopDistance ? 'arrived' : 'moving'
  }

  toggleAuto(enabled: boolean) {
    if (this.disposed) return
    if (enabled && this.enabled) return
    if (enabled && !this.callbacks.canAct()) {
      this.callbacks.onWarning('Không thể bật Auto khi đang gục ngã')
      return
    }

    this.enabled = enabled
    this.resetCooldowns()
    this.target = null
    if (!enabled) {
      this.callbacks.onMove(this.player.x, this.player.y)
      this.setStatus('IDLE', null, 'Auto đã tắt')
      return
    }

    this.setStatus('SEARCH', null, 'Đang tìm quái trong khu vực')
  }

  selectTarget(id: string) {
    if (this.disposed) return

    const monster = this.monsters.find(item => item.id === id && item.isAlive)
    if (!monster) return

    this.target = monster
    this.setStatus(this.enabled ? 'SEARCH' : 'IDLE', monster, `Mục tiêu: ${monster.name}`)
  }

  clearSelectedTarget() {
    if (this.disposed || !this.target) return
    this.clearTarget(this.enabled ? 'SEARCH' : 'IDLE', 'Mục tiêu không còn khả dụng')
  }

  selectAdjacentTarget(direction: 'next' | 'previous'): boolean {
    if (this.disposed) return false

    const aliveMonsters = this.monsters.filter(monster => monster.isAlive)
    if (aliveMonsters.length === 0) {
      this.callbacks.onWarning('Không có quái còn sống để chọn')
      return false
    }

    const currentIndex = aliveMonsters.findIndex(monster => monster.id === this.target?.id)
    const nextIndex = currentIndex < 0
      ? direction === 'next' ? 0 : aliveMonsters.length - 1
      : (currentIndex + (direction === 'next' ? 1 : -1) + aliveMonsters.length) % aliveMonsters.length
    const target = aliveMonsters[nextIndex]
    if (!target) return false

    this.selectTarget(target.id)
    return true
  }

  attackSelected(now: number): boolean {
    if (this.disposed) return false

    if (!this.callbacks.canAct()) {
      this.callbacks.onWarning('Không thể chiến đấu khi đang gục ngã')
      return false
    }

    if (this.enabled) {
      this.callbacks.onWarning('Hãy tắt Auto để đánh thủ công')
      return false
    }

    const target = this.getValidTarget()
    if (!target) {
      this.clearSelectedTarget()
      this.callbacks.onWarning('Hãy chọn một quái còn sống')
      return false
    }

    if (this.distanceTo(target) > this.config.attackRadius) {
      this.callbacks.onWarning('Mục tiêu ở quá xa. Hãy di chuyển lại gần.')
      return false
    }

    const attackCooldownRemaining = this.getAttackCooldownRemaining(now)
    if (attackCooldownRemaining > 0) {
      const secondsLeft = Math.ceil(attackCooldownRemaining / 1000)
      this.callbacks.onWarning(`Đòn đánh đang hồi chiêu (${secondsLeft} giây)`)
      return false
    }

    this.lastAttackAt = now
    this.damageTarget(target, this.callbacks.getAttackPower())
    return true
  }

  castSkillSelected(now: number): boolean {
    if (this.disposed) return false

    if (!this.callbacks.canAct()) {
      this.callbacks.onWarning('Không thể chiến đấu khi đang gục ngã')
      return false
    }

    if (this.enabled) {
      this.callbacks.onWarning('Hãy tắt Auto để dùng kỹ năng thủ công')
      return false
    }

    const target = this.getValidTarget()
    if (!target) {
      this.clearSelectedTarget()
      this.callbacks.onWarning('Hãy chọn một quái còn sống')
      return false
    }

    if (this.distanceTo(target) > this.config.attackRadius) {
      this.callbacks.onWarning('Mục tiêu ở quá xa. Hãy di chuyển lại gần.')
      return false
    }

    const skillCooldownRemaining = this.getSkillCooldownRemaining(now)
    if (skillCooldownRemaining > 0) {
      this.callbacks.onWarning(`Kỹ năng đang hồi chiêu (${Math.ceil(skillCooldownRemaining / 1000)} giây)`)
      return false
    }

    if (!this.callbacks.onUseSkill(this.config.skillMpCost)) {
      this.callbacks.onWarning(`Không đủ MP (cần ${this.config.skillMpCost} MP)`)
      return false
    }

    this.nextSkillAt = now + this.config.skillCooldown
    this.setStatus('CAST_SKILL', target, `Dùng kỹ năng lên ${target.name}`)
    this.damageTarget(target, this.callbacks.getAttackPower() * 2)
    return true
  }

  update(delta: number, now: number) {
    if (this.disposed || !this.enabled) return
    if (!this.callbacks.canAct()) return

    if (
      this.target &&
      (!this.monsters.includes(this.target) ||
        !this.target.isAlive ||
        this.distanceTo(this.target) > this.config.farmRadius)
    ) {
      this.clearTarget('SEARCH', 'Mục tiêu không còn khả dụng')
    }

    if (!this.target) {
      this.target = this.findNearestMonster()
      if (!this.target) {
        this.setStatus('SEARCH', null, 'Không có quái trong tầm farm')
        return
      }
      this.setStatus('SEARCH', this.target, `Đã chọn ${this.target.name}`)
    }

    const distance = this.distanceTo(this.target)
    if (distance > this.config.attackRadius) {
      this.setStatus('MOVE_TO_TARGET', this.target, `Đang tiến đến ${this.target.name}`)
      const stopDistance = Math.max(0, this.config.attackRadius - 2)
      const step = Math.min(this.config.moveSpeed * delta / 1000, distance - stopDistance)
      const ratio = step / distance
      this.player.x += (this.target.x - this.player.x) * ratio
      this.player.y += (this.target.y - this.player.y) * ratio
      this.callbacks.onMove(this.player.x, this.player.y)
      return
    }

    if (this.getAttackCooldownRemaining(now) > 0) {
      this.setStatus('ATTACK', this.target, `Đang chiến đấu: ${this.target.name}`)
      return
    }

    this.lastAttackAt = now
    const canCastSkill = now >= this.nextSkillAt && this.callbacks.onUseSkill(this.config.skillMpCost)
    this.setStatus(
      canCastSkill ? 'CAST_SKILL' : 'ATTACK',
      this.target,
      canCastSkill ? `Dùng kỹ năng lên ${this.target.name}` : `Đánh thường ${this.target.name}`
    )

    if (canCastSkill) {
      this.nextSkillAt = now + this.config.skillCooldown
      this.damageTarget(this.target, this.callbacks.getAttackPower() * 2)
    } else {
      this.damageTarget(this.target, this.callbacks.getAttackPower())
    }
  }

  private findNearestMonster(): Monster | null {
    let nearest: Monster | null = null
    let nearestDistance = this.config.farmRadius

    for (const monster of this.monsters) {
      if (!monster.isAlive) continue
      const distance = this.distanceTo(monster)
      if (distance <= nearestDistance) {
        nearest = monster
        nearestDistance = distance
      }
    }

    return nearest
  }

  private distanceTo(monster: Monster): number {
    return Math.hypot(monster.x - this.player.x, monster.y - this.player.y)
  }

  private getValidTarget(): Monster | null {
    return this.target?.isAlive && this.monsters.includes(this.target) ? this.target : null
  }

  private damageTarget(monster: Monster, damage: number) {
    if (
      this.disposed ||
      !monster.isAlive ||
      this.target !== monster ||
      !this.monsters.includes(monster)
    ) return

    const critical = this.random() < this.config.criticalChance
    const finalDamage = critical ? damage * 2 : damage
    monster.hp = Math.max(0, monster.hp - finalDamage)
    const defeated = monster.hp === 0
    if (defeated) {
      monster.isAlive = false
      this.target = null
      this.resetCooldowns()
    }
    this.callbacks.onDamage(monster, finalDamage, critical)
    if (defeated) {
      this.callbacks.onDefeat(monster)
      this.setStatus(this.enabled ? 'SEARCH' : 'IDLE', null, `${monster.name} đã bị đánh bại`)
    }
  }

  private clearTarget(state: AutoState, message: string) {
    this.target = null
    this.resetCooldowns()
    this.setStatus(state, null, message)
  }

  private resetCooldowns() {
    this.lastAttackAt = -Infinity
    this.nextSkillAt = 0
  }

  private setStatus(state: AutoState, target: Monster | null, message: string) {
    if (this.disposed) return

    const status = `${state}:${target?.id ?? ''}:${message}`
    if (status === this.lastStatus) return

    this.lastStatus = status
    this.callbacks.onStatus(state, target, message)
  }
}
