import Phaser from 'phaser'
import { usePlayerStore } from '../stores/player'
import {
  AutoBattleSystem,
  type ApproachResult,
  type AutoState,
  type Monster
} from '../game/systems/AutoBattleSystem'
import { rollGoldReward } from '../game/systems/rewards'
import type { TouchDirection } from '../game/types'

interface MonsterView {
  data: Monster
  body: Phaser.GameObjects.Arc
  label: Phaser.GameObjects.Text
  healthBar: Phaser.GameObjects.Graphics
  selectionMarker: Phaser.GameObjects.Graphics
  color: number
  attackDamage: number
  attackCooldown: number
  nextAttackAt: number
  minGold: number
  maxGold: number
  respawnAt: number | null
}

const PLAYER_RESPAWN_DELAY = 3000
const MONSTER_ATTACK_RANGE = 86
const AUTO_POTION_COOLDOWN = 2000

export default class WorldScene extends Phaser.Scene {
  private readonly playerStore = usePlayerStore()
  private readonly playerPosition = { x: 120, y: 0 }
  private playerBody!: Phaser.GameObjects.Arc
  private playerLabel!: Phaser.GameObjects.Text
  private pointClickMarker!: Phaser.GameObjects.Graphics
  private blacksmithBody!: Phaser.GameObjects.Rectangle
  private blacksmithHead!: Phaser.GameObjects.Arc
  private blacksmithLabel!: Phaser.GameObjects.Text
  private autoBattle!: AutoBattleSystem
  private monsters: MonsterView[] = []
  private readonly touchDirections = new Set<TouchDirection>()
  private keys!: Record<
    'up' | 'down' | 'left' | 'right' | 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight',
    Phaser.Input.Keyboard.Key
  >
  private groundY = 0
  private worldWidth = 0
  private manaRegenElapsed = 0
  private cooldownUiElapsed = 0
  private nextAutoPotionAt = 0
  private manualApproachActive = false
  private manualApproachTargetId: string | null = null
  private pointClickDestination: number | null = null
  private playerRespawnAt: number | null = null
  private observedLevel = 1
  private shutdownHandled = false

  constructor() {
    super({ key: 'World' })
  }

  create() {
    this.shutdownHandled = false
    this.playerPosition.x = 120
    this.manaRegenElapsed = 0
    this.cooldownUiElapsed = 0
    this.nextAutoPotionAt = 0
    this.manualApproachActive = false
    this.manualApproachTargetId = null
    this.pointClickDestination = null
    this.playerRespawnAt = null
    this.touchDirections.clear()

    const { width, height } = this.scale
    this.worldWidth = Math.max(width * 2, 1600)
    this.groundY = height * 0.72
    this.drawWorld(height)
    this.createPlayer(height)
    this.createBlacksmith()
    this.observedLevel = this.playerStore.level
    this.createMonsters()
    this.setupInput()
    this.setupAutoBattle()

    this.cameras.main.setBounds(0, 0, this.worldWidth, height)
    this.cameras.main.startFollow(this.playerBody, true, 0.08, 0.08)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this)
    if (this.playerStore.hp <= 0) this.startPlayerRespawn()
  }

  update(_time: number, delta: number) {
    if (this.shutdownHandled) return

    if (this.playerRespawnAt !== null) {
      if (this.time.now >= this.playerRespawnAt) this.respawnPlayer()
    } else {
      if (this.manualApproachActive) {
        if (this.hasManualMovementInput()) {
          this.cancelManualApproach('Đã dừng áp sát · đang điều khiển thủ công')
          this.updateManualMovement(delta)
        } else if (this.playerStore.currentTargetId !== this.manualApproachTargetId) {
          this.cancelManualApproach('Đã dừng áp sát vì mục tiêu đã thay đổi')
        } else {
          const result = this.autoBattle.moveTowardSelectedTarget(delta)
          if (result !== 'moving') this.finishManualApproach(result)
        }
      } else {
        this.updateManualMovement(delta)
      }
      this.updateMonsterAttacks()
      this.autoBattle.update(delta, this.time.now)
      this.showLevelUpIfNeeded()
    }

    this.updateAutoPotion()
    this.manaRegenElapsed += Math.min(delta, 1000)
    if (this.manaRegenElapsed >= 3000) {
      const regenTicks = Math.floor(this.manaRegenElapsed / 3000)
      this.manaRegenElapsed %= 3000
      this.playerStore.regenerateMp(regenTicks * 3)
    }
    this.updateMonsterViews()
    this.playerLabel.setPosition(this.playerBody.x, this.playerBody.y - 42)
    this.cooldownUiElapsed += delta
    if (this.cooldownUiElapsed >= 100) {
      this.cooldownUiElapsed %= 100
      this.updateCooldownIndicators()
    }
  }

  private clearTargetStoreState() {
    this.playerStore.clearTargetState()
  }

  private updateTargetDistance() {
    const distance = this.autoBattle.getSelectedTargetDistance()
    if (distance === null) {
      this.autoBattle.clearSelectedTarget()
      this.clearTargetStoreState()
      return
    }

    if (this.playerStore.currentTargetId === null) {
      this.playerStore.currentTargetDistance = null
      this.playerStore.currentTargetInRange = false
      return
    }

    this.playerStore.currentTargetDistance = Math.round(distance)
    this.playerStore.currentTargetInRange = this.autoBattle.isSelectedTargetInRange()
  }

  private updateCooldownIndicators() {
    const attackSeconds = Math.ceil(this.autoBattle.getAttackCooldownRemaining(this.time.now) / 1000)
    const skillSeconds = Math.ceil(this.autoBattle.getSkillCooldownRemaining(this.time.now) / 1000)
    this.updateTargetDistance()
    if (this.playerStore.currentTargetId === null) {
      this.playerStore.attackCooldownRemaining = 0
      this.playerStore.skillCooldownRemaining = 0
      return
    }
    if (this.playerStore.attackCooldownRemaining !== attackSeconds) {
      this.playerStore.attackCooldownRemaining = attackSeconds
    }
    if (this.playerStore.skillCooldownRemaining !== skillSeconds) {
      this.playerStore.skillCooldownRemaining = skillSeconds
    }
  }

  private drawWorld(height: number) {
    this.cameras.main.setBackgroundColor('#14243a')

    const sky = this.add.graphics()
    sky.fillGradientStyle(0x14243a, 0x14243a, 0x263e58, 0x263e58, 1)
    sky.fillRect(0, 0, this.worldWidth, height)
    sky.setDepth(-10)

    const scenery = this.add.graphics()
    scenery.fillStyle(0x203b4b, 1)
    for (let x = 70; x < this.worldWidth; x += 210) {
      scenery.fillCircle(x, this.groundY - 94, 40)
      scenery.fillCircle(x + 35, this.groundY - 69, 28)
    }
    scenery.fillStyle(0x42604c, 1)
    scenery.fillRect(0, this.groundY + 10, this.worldWidth, height - this.groundY)
    scenery.lineStyle(3, 0x8c7954, 1)
    scenery.lineBetween(0, this.groundY + 10, this.worldWidth, this.groundY + 10)
    scenery.setDepth(-5)

    this.add.text(28, 112, 'TÂN THỦ THÀNH  ·  BÃI TẬP LUYỆN', {
      color: '#e5d7b4',
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(20)
  }

  private createPlayer(height: number) {
    this.playerPosition.y = this.groundY - 22
    this.playerBody = this.add.circle(this.playerPosition.x, this.playerPosition.y, 20, 0x5ca7ff)
      .setStrokeStyle(3, 0xd7e9ff)
      .setDepth(5)
    this.playerLabel = this.add.text(this.playerPosition.x, this.playerPosition.y - 42, 'Chiến Binh', {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      stroke: '#14243a',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(6)
    this.pointClickMarker = this.add.graphics().setDepth(2)

    this.playerBody.setInteractive({ useHandCursor: true })
    this.playerBody.on('pointerdown', () => {
      if (this.shutdownHandled) return
      this.playerStore.autoMessage = 'Nhân vật của bạn'
    })

    this.playerPosition.y = Math.min(this.playerPosition.y, height - 60)
  }

  private createBlacksmith() {
    const x = 245
    const y = this.groundY - 26
    this.blacksmithBody = this.add.rectangle(x, y, 34, 52, 0x9b5637)
      .setStrokeStyle(3, 0xf0c078)
      .setDepth(5)
    this.blacksmithHead = this.add.circle(x, y - 34, 15, 0xe7b27a)
      .setStrokeStyle(2, 0x4c3027)
      .setDepth(6)
    this.add.rectangle(x, y - 43, 35, 9, 0x4c3027).setDepth(7)
    this.blacksmithLabel = this.add.text(x, y - 69, 'Thợ rèn', {
      color: '#ffe2a6',
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      stroke: '#261b18',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(8)
    for (const part of [this.blacksmithBody, this.blacksmithHead, this.blacksmithLabel]) {
      part.setInteractive({ useHandCursor: true })
      part.on('pointerdown', this.handleBlacksmithClick, this)
    }
  }

  private createMonsters() {
    const definitions = [
      { id: 'slime-1', name: 'Slime', x: 390, hp: 40, exp: 12, damage: 5, cooldown: 1800, minGold: 2, maxGold: 5, color: 0x79d7a4 },
      { id: 'slime-2', name: 'Slime', x: 650, hp: 50, exp: 14, damage: 6, cooldown: 1700, minGold: 2, maxGold: 5, color: 0x79d7a4 },
      { id: 'wolf-1', name: 'Sói non', x: 920, hp: 65, exp: 18, damage: 8, cooldown: 1600, minGold: 5, maxGold: 9, color: 0xd1a16c },
      { id: 'wolf-2', name: 'Sói non', x: 1200, hp: 70, exp: 20, damage: 9, cooldown: 1500, minGold: 5, maxGold: 9, color: 0xd1a16c },
      { id: 'goblin-1', name: 'Goblin', x: 1470, hp: 90, exp: 25, damage: 11, cooldown: 1400, minGold: 8, maxGold: 14, color: 0xb9c36c }
    ]

    this.monsters = definitions.map(({ id, name, x, hp, exp, damage, cooldown, minGold, maxGold, color }) => {
      const data: Monster = {
        id,
        name,
        x,
        y: this.groundY - 18,
        hp,
        maxHp: hp,
        expValue: exp,
        isAlive: true
      }
      const body = this.add.circle(x, data.y, 17, color).setStrokeStyle(2, 0xf3e7c7).setDepth(4)
      const label = this.add.text(x, data.y - 34, name, {
        color: '#f5ebd2',
        fontFamily: 'Arial',
        fontSize: '13px',
        stroke: '#182331',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(6)
      const healthBar = this.add.graphics().setDepth(6)
      const selectionMarker = this.add.graphics().setDepth(3)

      body.setInteractive({ useHandCursor: true })
      body.on('pointerdown', () => {
        if (this.shutdownHandled || this.playerRespawnAt !== null || this.playerStore.hp <= 0) return
        this.autoBattle?.selectTarget(id)
        this.updateTargetDistance()
      })

      return {
        data,
        body,
        label,
        healthBar,
        selectionMarker,
        color,
        attackDamage: damage,
        attackCooldown: cooldown,
        nextAttackAt: 0,
        minGold,
        maxGold,
        respawnAt: null
      }
    })
  }

  private setupInput() {
    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
      arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
      arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT
    }) as Record<
      'up' | 'down' | 'left' | 'right' | 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight',
      Phaser.Input.Keyboard.Key
    >
    this.input.on('pointerdown', this.handlePointClick, this)
  }

  private setupAutoBattle() {
    this.autoBattle = new AutoBattleSystem(this.playerPosition, {
      onStatus: (state: AutoState, target, message) => {
        this.playerStore.autoState = state
        if (!target) {
          this.clearTargetStoreState()
        } else {
          this.playerStore.currentTarget = target.name
          this.playerStore.currentTargetId = target.id
          this.playerStore.currentTargetHp = target.hp
          this.playerStore.currentTargetMaxHp = target.maxHp
        }
        this.updateTargetDistance()
        this.playerStore.autoMessage = message
      },
      onMove: (x, y) => this.playerBody.setPosition(x, y),
      canAct: () => this.playerRespawnAt === null && this.playerStore.hp > 0,
      onUseSkill: mpCost => {
        if (this.playerStore.mp < mpCost) return false
        this.playerStore.mp -= mpCost
        return true
      },
      getAttackPower: () => this.playerStore.attackPower,
      onDamage: (monster, damage, critical) => {
        if (this.playerStore.currentTargetId === monster.id) {
          this.playerStore.currentTargetHp = monster.hp
        }
        const view = this.monsters.find(item => item.data.id === monster.id)
        if (view) {
          view.body.setFillStyle(0xffffff)
          this.tweens.add({
            targets: view.body,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 90,
            yoyo: true,
            onComplete: () => view.body.setFillStyle(view.color)
          })
        }
        const damageText = this.add.text(
          monster.x,
          monster.y - (critical ? 62 : 52),
          critical ? `BẠO KÍCH -${damage}` : `-${damage}`,
          {
          color: critical ? '#ff8b45' : '#ffe28a',
          fontFamily: 'Arial',
          fontSize: critical ? '18px' : '16px',
          fontStyle: 'bold',
          stroke: '#261b18',
          strokeThickness: 3
        }).setOrigin(0.5).setDepth(10)
        this.tweens.add({
          targets: damageText,
          y: damageText.y - 24,
          alpha: 0,
          duration: 600,
          onComplete: () => damageText.destroy()
        })
      },
      onDefeat: monster => this.onMonsterDefeated(monster),
      onWarning: message => {
        this.playerStore.autoMessage = message
      }
    })
    this.autoBattle.setMonsters(this.monsters.map(monster => monster.data))
    this.game.events.on('game:shutdown', this.shutdown, this)
    this.game.events.on('auto:toggle', this.handleAutoToggle, this)
    this.game.events.on('manual:attack', this.handleManualAttack, this)
    this.game.events.on('manual:skill', this.handleManualSkill, this)
    this.game.events.on('target:next', this.handleNextTarget, this)
    this.game.events.on('target:previous', this.handlePreviousTarget, this)
    this.game.events.on('target:approach', this.handleApproachTarget, this)
    this.game.events.on('target:approach:cancel', this.handleCancelApproach, this)
    this.game.events.on('move:touch', this.handleTouchMovement, this)
    this.input.keyboard?.on('keydown-Q', this.handleManualSkill, this)
    this.input.keyboard?.on('keydown-E', this.handleHealingPotion, this)

    if (this.playerStore.autoBattle) {
      this.autoBattle.toggleAuto(true)
    }
  }

  private getManualMovementDirection() {
    const horizontal =
      Number(this.keys.right.isDown || this.keys.arrowRight.isDown || this.touchDirections.has('right')) -
      Number(this.keys.left.isDown || this.keys.arrowLeft.isDown || this.touchDirections.has('left'))
    const vertical =
      Number(this.keys.down.isDown || this.keys.arrowDown.isDown || this.touchDirections.has('down')) -
      Number(this.keys.up.isDown || this.keys.arrowUp.isDown || this.touchDirections.has('up'))
    return { horizontal, vertical }
  }

  private hasManualMovementInput() {
    const { horizontal, vertical } = this.getManualMovementDirection()
    return horizontal !== 0 || vertical !== 0
  }

  private updateManualMovement(delta: number) {
    if (this.playerStore.autoBattle || this.playerRespawnAt !== null) return

    const { horizontal, vertical } = this.getManualMovementDirection()
    if (horizontal === 0 && vertical === 0) {
      if (this.pointClickDestination === null) return

      const distance = this.pointClickDestination - this.playerPosition.x
      const step = 220 * Math.min(delta, 1000) / 1000
      if (Math.abs(distance) <= step) {
        this.playerPosition.x = this.pointClickDestination
        this.pointClickDestination = null
        this.pointClickMarker.clear()
      } else {
        this.playerPosition.x += Math.sign(distance) * step
      }
      this.playerBody.setPosition(this.playerPosition.x, this.playerPosition.y)
      return
    }

    this.pointClickDestination = null
    this.pointClickMarker.clear()

    const length = Math.hypot(horizontal, vertical)
    const distance = 220 * Math.min(delta, 1000) / 1000 / length
    this.playerPosition.x = Phaser.Math.Clamp(this.playerPosition.x + horizontal * distance, 30, this.worldWidth - 30)
    this.playerPosition.y = Phaser.Math.Clamp(this.playerPosition.y + vertical * distance, 70, this.scale.height - 55)
    this.playerBody.setPosition(this.playerPosition.x, this.playerPosition.y)
  }

  private handlePointClick(pointer: Phaser.Input.Pointer) {
    if (
      this.shutdownHandled ||
      this.playerStore.autoBattle ||
      this.playerRespawnAt !== null ||
      this.playerStore.hp <= 0
    ) return

    const hitObjects = this.input.hitTestPointer(pointer)
    if (
      hitObjects.includes(this.playerBody) ||
      hitObjects.includes(this.blacksmithBody) ||
      hitObjects.includes(this.blacksmithHead) ||
      hitObjects.includes(this.blacksmithLabel) ||
      this.monsters.some(monster => hitObjects.includes(monster.body))
    ) return

    if (pointer.worldY < this.groundY - 55 || pointer.worldY > this.scale.height) return

    this.pointClickDestination = Phaser.Math.Clamp(pointer.worldX, 30, this.worldWidth - 30)
    this.drawPointClickMarker()
    this.playerStore.autoMessage = 'Đang di chuyển đến điểm đã chọn'
  }

  private drawPointClickMarker() {
    this.pointClickMarker.clear()
    if (this.pointClickDestination === null) return
    this.pointClickMarker.lineStyle(2, 0xffdf82, 0.9)
    this.pointClickMarker.strokeCircle(this.pointClickDestination, this.groundY - 18, 12)
    this.pointClickMarker.lineBetween(
      this.pointClickDestination,
      this.groundY - 6,
      this.pointClickDestination,
      this.groundY + 9
    )
  }

  private handleBlacksmithClick() {
    if (this.shutdownHandled || this.playerRespawnAt !== null || this.playerStore.hp <= 0) return
    this.pointClickDestination = null
    this.pointClickMarker.clear()
    this.playerStore.openForgePanel()
  }

  private handleTouchMovement(direction: TouchDirection, pressed: boolean) {
    if (pressed) {
      this.pointClickDestination = null
      this.pointClickMarker.clear()
      this.touchDirections.add(direction)
    } else {
      this.touchDirections.delete(direction)
    }
  }

  private showLevelUpIfNeeded() {
    if (this.playerStore.level <= this.observedLevel) return

    this.observedLevel = this.playerStore.level
    const levelText = this.add.text(
      this.playerPosition.x,
      this.playerPosition.y - 78,
      `THĂNG CẤP ${this.playerStore.level}!`,
      {
        color: '#ffe28a',
        fontFamily: 'Arial',
        fontSize: '22px',
        fontStyle: 'bold',
        stroke: '#392b18',
        strokeThickness: 5
      }
    ).setOrigin(0.5).setDepth(15)

    this.playerBody.setStrokeStyle(5, 0xffdf82)
    this.tweens.add({
      targets: [levelText, this.playerBody],
      y: '-=42',
      alpha: { from: 1, to: 0 },
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        levelText.destroy()
        this.playerBody.setStrokeStyle(3, 0xd7e9ff)
      }
    })
  }

  private updateMonsterViews() {
    for (const monster of this.monsters) {
      if (!monster.data.isAlive) {
        monster.selectionMarker.setVisible(false)
        if (monster.respawnAt !== null && this.time.now >= monster.respawnAt) {
          monster.data.isAlive = true
          monster.data.hp = monster.data.maxHp
          monster.respawnAt = null
        } else {
          continue
        }
      }

      monster.body.setVisible(true)
      monster.label.setVisible(true)
      const isSelected = monster.data.id === this.playerStore.currentTargetId
      monster.selectionMarker.clear()
      monster.selectionMarker.setVisible(isSelected)
      if (isSelected) {
        const color = this.autoBattle.isSelectedTargetInRange() ? 0x83dc8e : 0xffc45c
        monster.selectionMarker.lineStyle(3, color, 0.95)
        monster.selectionMarker.strokeCircle(monster.data.x, monster.data.y, 25)
      }
      monster.healthBar.clear()
      monster.healthBar.fillStyle(0x412c34, 1)
      monster.healthBar.fillRect(monster.data.x - 20, monster.data.y - 29, 40, 5)
      monster.healthBar.fillStyle(0x83dc8e, 1)
      monster.healthBar.fillRect(
        monster.data.x - 20,
        monster.data.y - 29,
        40 * (monster.data.hp / monster.data.maxHp),
        5
      )
    }
  }

  private updateMonsterAttacks() {
    for (const monster of this.monsters) {
      if (
        !monster.data.isAlive ||
        this.time.now < monster.nextAttackAt ||
        Phaser.Math.Distance.Between(
          this.playerPosition.x,
          this.playerPosition.y,
          monster.data.x,
          monster.data.y
        ) > MONSTER_ATTACK_RANGE
      ) continue

      monster.nextAttackAt = this.time.now + monster.attackCooldown
      const actualDamage = this.playerStore.takeDamage(monster.attackDamage)
      this.showDamageText(this.playerPosition.x, this.playerPosition.y - 42, `-${actualDamage}`, 0xff807b)
      this.playerBody.setFillStyle(0xff807b)
      this.tweens.add({
        targets: this.playerBody,
        scaleX: 1.16,
        scaleY: 1.16,
        duration: 110,
        yoyo: true,
        onComplete: () => this.playerBody.setFillStyle(0x5ca7ff)
      })

      if (this.playerStore.hp <= 0) {
        this.startPlayerRespawn()
        break
      }

    }
  }

  private updateAutoPotion() {
    if (
      this.playerRespawnAt === null &&
      this.playerStore.autoBattle &&
      this.time.now >= this.nextAutoPotionAt &&
      this.playerStore.useHealingPotionIfHpAtOrBelow(this.playerStore.autoPotionThreshold)
    ) {
      this.nextAutoPotionAt = this.time.now + AUTO_POTION_COOLDOWN
    }
  }

  private startPlayerRespawn() {
    if (this.playerRespawnAt !== null || this.playerStore.hp > 0) return

    this.playerRespawnAt = this.time.now + PLAYER_RESPAWN_DELAY
    this.pointClickDestination = null
    this.pointClickMarker.clear()
    this.manualApproachActive = false
    this.manualApproachTargetId = null
    this.autoBattle.toggleAuto(false)
    this.playerStore.setAutoBattle(false)
    this.clearTargetStoreState()
    this.touchDirections.clear()
    this.playerBody.setAlpha(0.35)
    this.playerStore.autoMessage = 'Bạn đã gục ngã · sẽ hồi sinh sau 3 giây'
  }

  private respawnPlayer() {
    this.playerRespawnAt = null
    this.manualApproachActive = false
    this.manualApproachTargetId = null
    this.playerPosition.x = 120
    this.playerPosition.y = this.groundY - 22
    this.playerBody.setPosition(this.playerPosition.x, this.playerPosition.y).setAlpha(1)
    this.playerStore.restoreHealth(Math.ceil(this.playerStore.maxHp / 2))
    this.clearTargetStoreState()
    this.autoBattle.toggleAuto(false)
    this.playerStore.setAutoBattle(false)
    for (const monster of this.monsters) {
      monster.nextAttackAt = this.time.now + monster.attackCooldown
    }
    this.playerStore.autoMessage = 'Đã hồi sinh tại điểm xuất phát · HP được hồi một nửa'
  }

  private showDamageText(x: number, y: number, text: string, color: number) {
    const damageText = this.add.text(x, y, text, {
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      stroke: '#261b18',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(10)
    this.tweens.add({
      targets: damageText,
      y: damageText.y - 24,
      alpha: 0,
      duration: 600,
      onComplete: () => damageText.destroy()
    })
  }

  private onMonsterDefeated(monster: Monster) {
    const view = this.monsters.find(item => item.data.id === monster.id)
    if (view) {
      view.body.setVisible(false)
      view.label.setVisible(false)
      view.healthBar.clear()
      view.selectionMarker.setVisible(false)
      view.respawnAt = this.time.now + 6000
    }

    if (this.playerStore.currentTargetId === monster.id) {
      this.clearTargetStoreState()
    }

    this.playerStore.gainExp(monster.expValue)
    const goldReward = view ? rollGoldReward(view.minGold, view.maxGold) : 0
    this.playerStore.gold += goldReward
    this.showDamageText(monster.x, monster.y - 72, `+${goldReward} vàng`, 0xf0d48e)
    this.playerStore.recordMonsterDefeat()
    this.rollLoot(monster)
  }

  private rollLoot(monster: Monster) {
    const roll = Math.random()
    const loot = roll < 0.08
      ? this.playerStore.createItem({
          name: 'Giáp da tập sự',
          type: 'equipment',
          rarity: 'Tốt',
          quantity: 1,
          slot: 'armor',
          defenseBonus: 2
        })
      : roll < 0.23
        ? this.playerStore.createItem({
          name: 'Kiếm tập sự',
          type: 'equipment',
          rarity: 'Tốt',
          quantity: 1,
          slot: 'weapon',
          attackBonus: 4
        })
        : roll < 0.38
          ? this.playerStore.createItem({
            name: 'Thuốc hồi phục',
            type: 'consumable',
            rarity: 'Thường',
            quantity: 1,
            healAmount: 50
          })
          : this.playerStore.createItem({
            name: 'Mảnh linh thạch',
            type: 'material',
            rarity: 'Thường',
            quantity: 1
          })

    if (this.playerStore.addItem(loot)) {
      this.playerStore.autoMessage = `${monster.name} rơi ${loot.name}`
    } else {
      this.playerStore.autoMessage = 'Túi đồ đã đầy; không thể nhặt vật phẩm'
    }
  }

  private handleAutoToggle(enabled: boolean) {
    this.cancelManualApproach()
    this.pointClickDestination = null
    this.pointClickMarker.clear()
    if (enabled && (this.playerRespawnAt !== null || this.playerStore.hp <= 0)) {
      this.autoBattle.toggleAuto(false)
      this.playerStore.setAutoBattle(false)
      this.playerStore.autoMessage = 'Bạn đã gục ngã · sẽ hồi sinh sau 3 giây'
      return
    }

    if (!enabled) {
      this.clearTargetStoreState()
      this.autoBattle.toggleAuto(false)
      return
    }

    this.touchDirections.clear()
    this.autoBattle.toggleAuto(true)
  }

  private handleManualAttack() {
    this.cancelManualApproach('Đã dừng áp sát')
    this.autoBattle.attackSelected(this.time.now)
  }

  private handleManualSkill() {
    this.cancelManualApproach('Đã dừng áp sát')
    this.autoBattle.castSkillSelected(this.time.now)
  }

  private handleApproachTarget() {
    if (this.playerRespawnAt !== null || this.playerStore.hp <= 0) return
    if (this.playerStore.autoBattle) return
    if (!this.playerStore.currentTargetId || this.playerStore.currentTargetInRange) {
      this.playerStore.autoMessage = this.playerStore.currentTargetId
        ? 'Mục tiêu đã trong tầm đánh'
        : 'Hãy chọn mục tiêu trước'
      return
    }

    this.pointClickDestination = null
    this.pointClickMarker.clear()
    this.manualApproachActive = true
    this.manualApproachTargetId = this.playerStore.currentTargetId
    this.playerStore.autoState = 'MOVE_TO_TARGET'
    this.playerStore.autoMessage = `Đang áp sát ${this.playerStore.currentTarget}`
  }

  private finishManualApproach(result: ApproachResult) {
    const message = result === 'arrived'
      ? 'Đã vào tầm đánh · hãy chọn đòn đánh hoặc kỹ năng'
      : 'Đã dừng áp sát vì mục tiêu không còn khả dụng'
    this.cancelManualApproach(message)
  }

  private cancelManualApproach(message?: string) {
    if (!this.manualApproachActive) return
    this.manualApproachActive = false
    this.manualApproachTargetId = null
    this.playerStore.autoState = 'IDLE'
    if (message) this.playerStore.autoMessage = message
  }

  private handleCancelApproach() {
    this.cancelManualApproach('Đã dừng áp sát')
  }

  private handleNextTarget() {
    if (this.playerRespawnAt !== null || this.playerStore.hp <= 0) return
    this.autoBattle.selectAdjacentTarget('next')
  }

  private handlePreviousTarget() {
    if (this.playerRespawnAt !== null || this.playerStore.hp <= 0) return
    this.autoBattle.selectAdjacentTarget('previous')
  }

  private handleHealingPotion() {
    if (this.playerStore.useHealingPotion()) return
    this.playerStore.autoMessage = 'Không có thuốc hồi phục hoặc HP đã đầy'
  }

  private shutdown() {
    if (this.shutdownHandled) return
    this.shutdownHandled = true

    this.tweens.killAll()
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
    this.events.off(Phaser.Scenes.Events.DESTROY, this.shutdown, this)
    this.game.events.off('game:shutdown', this.shutdown, this)
    this.game.events.off('auto:toggle', this.handleAutoToggle, this)
    this.game.events.off('manual:attack', this.handleManualAttack, this)
    this.game.events.off('manual:skill', this.handleManualSkill, this)
    this.game.events.off('target:next', this.handleNextTarget, this)
    this.game.events.off('target:previous', this.handlePreviousTarget, this)
    this.game.events.off('target:approach', this.handleApproachTarget, this)
    this.game.events.off('target:approach:cancel', this.handleCancelApproach, this)
    this.game.events.off('move:touch', this.handleTouchMovement, this)
    this.input.off('pointerdown', this.handlePointClick, this)
    this.playerBody.off('pointerdown')
    this.blacksmithBody.off('pointerdown', this.handleBlacksmithClick, this)
    this.blacksmithHead.off('pointerdown', this.handleBlacksmithClick, this)
    this.blacksmithLabel.off('pointerdown', this.handleBlacksmithClick, this)
    for (const monster of this.monsters) {
      monster.body.off('pointerdown')
    }
    this.touchDirections.clear()
    this.input.keyboard?.off('keydown-Q', this.handleManualSkill, this)
    this.input.keyboard?.off('keydown-E', this.handleHealingPotion, this)
    this.autoBattle?.dispose()
    this.manualApproachActive = false
    this.manualApproachTargetId = null
    this.pointClickDestination = null
    this.pointClickMarker.clear()
    this.playerRespawnAt = null
    this.playerStore.closeForgePanel()
    this.playerStore.autoState = 'IDLE'
    this.clearTargetStoreState()
    this.monsters = []
  }
}
