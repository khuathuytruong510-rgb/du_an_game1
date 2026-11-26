import Phaser from 'phaser'
import { usePlayerStore } from '../stores/player'
import { rollGoldReward } from '../game/systems/rewards'
import { claimMonsterDefeat, tryGrantEquipmentDrop } from '../game/systems/equipmentLoot'
import type { MountId } from '../game/persistence/gameSettings'

type MonsterKind = 'slime' | 'wolf' | 'goblin' | 'boss'

interface MonsterView {
  id: string
  kind: MonsterKind
  name: string
  container: Phaser.GameObjects.Container
  hpBar: Phaser.GameObjects.Graphics
  hp: number
  maxHp: number
  attack: number
  alive: boolean
  respawnAt: number
  x: number
}

const MONSTER_DATA: Record<MonsterKind, { name: string; hp: number; attack: number; color: number }> = {
  slime: { name: 'Slime lá', hp: 55, attack: 7, color: 0x58b95a },
  wolf: { name: 'Sói tuyết', hp: 85, attack: 10, color: 0x91b6cd },
  goblin: { name: 'Goblin', hp: 120, attack: 13, color: 0x78a96a },
  boss: { name: 'Bạch Hổ', hp: 240, attack: 18, color: 0xe9eef0 }
}

export default class WorldScene extends Phaser.Scene {
  private readonly store = usePlayerStore()
  private player!: Phaser.GameObjects.Container
  private companion!: Phaser.GameObjects.Image
  private mountSprite: Phaser.GameObjects.Image | null = null
  private playerShadow!: Phaser.GameObjects.Ellipse
  private playerHpBar!: Phaser.GameObjects.Graphics
  private monsters: MonsterView[] = []
  private selectedMonsterId: string | null = null
  private autoEnabled = false
  private autoElapsed = 0
  private monsterAttackElapsed = 0
  private attackCooldownUntil = 0
  private skillCooldownUntil = 0
  private playerRespawnAt = 0
  private paused = false

  constructor() {
    super({ key: 'World' })
  }

  create() {
    this.load.image('battlefield', '/assets/rpg-battlefield.svg')
    this.load.image('battlefield-supplied', '/assets/legend-package/battlefield-supplied.png')
    this.load.image('forest-road', '/assets/legend-of-mushroom/forest-road.png')
    this.load.image('mushroom-companion', '/assets/supplied/mushroom-companion.png')
    this.load.image('pumpkin-companion', '/assets/legend-package/monster-mushroom-supplied.png')
    this.load.image('mount-ice-dragon', '/assets/supplied/mount-ice-dragon.png')
    this.load.image('mount-mechanical-frog', '/assets/supplied/mount-mechanical-frog.png')
    this.load.image('hero', '/assets/hero-mushroom.svg')
    this.load.image('hero-scout', '/assets/hero-scout.svg')
    this.load.image('slime', '/assets/slime.svg')
    this.load.image('wolf', '/assets/wolf.svg')
    this.load.image('goblin', '/assets/goblin.svg')
    this.load.image('boss', '/assets/boss-tiger.svg')
    this.load.image('effect-slash', '/assets/effect-slash.svg')
    this.load.image('effect-hit', '/assets/effect-hit.svg')
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.buildBattleScene())
    this.load.start()
  }

  private buildBattleScene() {
    this.createBattlefield()
    this.createPlayer()
    this.createMonsters()
    this.registerEvents()
    this.paused = false
    this.autoEnabled = this.store.autoBattle
    this.playerRespawnAt = this.store.hp <= 0 ? this.time.now + 2500 : 0
  }

  update(_time: number, delta: number) {
    if (this.paused) return
    this.autoElapsed += Math.min(delta, 100)
    this.monsterAttackElapsed += Math.min(delta, 100)

    if (this.store.hp <= 0) {
      if (this.playerRespawnAt > 0 && this.time.now >= this.playerRespawnAt) {
        this.respawnPlayer()
      } else {
        return
      }
    }
    if (this.autoEnabled && this.autoElapsed >= 850) {
      this.autoElapsed = 0
      this.autoAttack(this.time.now)
    }
    if (this.monsterAttackElapsed >= 1900) {
      this.monsterAttackElapsed = 0
      const target = this.getLivingMonsters()[0]
      if (target) this.monsterAttack(target)
    }

    for (const monster of this.monsters) {
      if (!monster.alive && monster.respawnAt > 0 && this.time.now >= monster.respawnAt) {
        this.respawnMonster(monster)
      }
    }
  }

  private createBattlefield() {
    const width = this.scale.width
    const height = this.scale.height
    this.cameras.main.setBackgroundColor('#86d7c2')
    const battlefieldKey = this.textures.exists('battlefield-supplied') ? 'battlefield-supplied' : 'battlefield'
    const portrait = height > width * 1.25
    const battlefield = this.add.image(width / 2, height / 2, battlefieldKey)
    if (portrait) {
      battlefield.setDisplaySize(width, height)
    } else {
      battlefield.setDisplaySize(width, height)
    }
    battlefield.setDepth(-20)
    if (!portrait && this.textures.exists('forest-road')) {
      this.add.image(width / 2, height * 0.75, 'forest-road')
        .setDisplaySize(width, width * 510 / 2048)
        .setDepth(-19)
    }
  }

  private createPlayer() {
    const width = this.scale.width
    const portrait = this.scale.height > this.scale.width * 1.25
    const x = portrait ? width * 0.23 : Math.min(220, width * 0.18)
    const y = this.scale.height * (portrait ? 0.39 : 0.50)
    this.playerShadow = this.add.ellipse(x, y + (portrait ? 96 : 70), portrait ? 92 : 110, portrait ? 22 : 24, 0x1d582f, 0.42)
    const body = this.add.container(x, y)
    const hero = this.add.image(0, 0, this.store.playerAvatar === 'hero-scout' ? 'hero-scout' : 'hero')
      .setDisplaySize(portrait ? 160 : 190, portrait ? 190 : 220)
    const aura = this.add.ellipse(0, portrait ? 68 : 78, portrait ? 140 : 150, portrait ? 28 : 28, 0x79cced, 0.24)
      .setStrokeStyle(4, 0xcbefff, 0.72)
    body.add([aura, hero])
    body.setDepth(12)
    this.player = body
    this.applyMount(this.store.mountId)
    this.companion = this.add.image(x + (portrait ? 88 : 105), y + (portrait ? 24 : 24), 'pumpkin-companion')
      .setDisplaySize(portrait ? 84 : 100, portrait ? 84 : 100)
      .setDepth(13)

    this.add.text(x, y - (portrait ? 108 : 106), `${this.store.playerName} · Lv.${this.store.level}`, {
      fontFamily: 'Arial',
      fontSize: portrait ? '12px' : '15px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#24483f',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(13)
    this.playerHpBar = this.add.graphics().setDepth(14)
    this.drawPlayerHp()

    this.tweens.add({
      targets: body,
      y: y - 5,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    })
    this.tweens.add({
      targets: this.companion,
      y: this.companion.y - 7,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    })
  }

  private drawPlayerHp() {
    if (!this.player || !this.playerHpBar) return
    const x = this.player.x
    const portrait = this.scale.height > this.scale.width * 1.25
    const y = this.player.y - (portrait ? 102 : 82)
    this.playerHpBar.clear()
    this.playerHpBar.fillStyle(0x442f34, 1)
    this.playerHpBar.fillRoundedRect(x - 48, y, 96, 12, 6)
    this.playerHpBar.fillStyle(0x4ebc64, 1)
    this.playerHpBar.fillRoundedRect(x - 46, y + 2, 92 * (this.store.hp / this.store.maxHp), 8, 5)
  }

  private createMonsters() {
    const width = this.scale.width
    const portrait = this.scale.height > this.scale.width * 1.25
    const y = this.scale.height * (portrait ? 0.39 : 0.49)
    const positions = [
      { kind: 'slime' as const, x: width * 0.50 },
      { kind: 'wolf' as const, x: width * 0.65 },
      { kind: 'goblin' as const, x: width * 0.79 },
      { kind: 'boss' as const, x: width * 0.92 }
    ]

    for (const position of positions) {
      const data = MONSTER_DATA[position.kind]
      const container = this.add.container(position.x, y)
      const shadow = this.add.ellipse(0, 68, 100, 20, 0x24513a, 0.35)
      const displaySize = position.kind === 'boss'
        ? portrait ? { width: 165, height: 135 } : { width: 180, height: 150 }
        : position.kind === 'wolf'
          ? portrait ? { width: 145, height: 145 } : { width: 140, height: 140 }
          : position.kind === 'goblin'
            ? portrait ? { width: 145, height: 120 } : { width: 145, height: 118 }
            : portrait ? { width: 140, height: 125 } : { width: 135, height: 125 }
      const monster = this.add.image(0, 0, position.kind)
        .setDisplaySize(displaySize.width, displaySize.height)
      container.add(monster)
      container.add(shadow)
      container.setSize(140, 150).setInteractive({ useHandCursor: true })
      container.on('pointerdown', () => this.selectMonster(position.kind === 'boss' ? 'boss' : position.kind))
      container.setDepth(10)

      const hpBar = this.add.graphics().setDepth(11)
      const view: MonsterView = {
        id: position.kind,
        kind: position.kind,
        name: data.name,
        container,
        hpBar,
        hp: data.hp,
        maxHp: data.hp,
        attack: data.attack,
        alive: true,
        respawnAt: 0,
        x: position.x
      }
      this.monsters.push(view)
      this.drawMonsterHp(view)
      this.tweens.add({
        targets: container,
        y: y - 7,
        duration: 700 + positions.indexOf(position) * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      })
    }

    this.selectMonster('slime')
  }

  private drawMonsterHp(monster: MonsterView) {
    monster.hpBar.clear()
    if (!monster.alive) return
    const width = monster.kind === 'boss' ? 105 : 82
    const y = monster.container.y - (monster.kind === 'boss' ? 118 : 92)
    monster.hpBar.fillStyle(0x442f34, 1)
    monster.hpBar.fillRoundedRect(monster.container.x - width / 2, y, width, 13, 6)
    monster.hpBar.fillStyle(monster.kind === 'slime' ? 0x72c94e : 0xe25a55, 1)
    monster.hpBar.fillRoundedRect(monster.container.x - width / 2 + 2, y + 2, (width - 4) * (monster.hp / monster.maxHp), 9, 5)
  }

  private selectMonster(id: string) {
    const monster = this.monsters.find(candidate => candidate.id === id && candidate.alive)
    if (!monster) return
    this.selectedMonsterId = id
    this.store.currentTarget = monster.name
    this.store.currentTargetId = id
    this.store.currentTargetHp = monster.hp
    this.store.currentTargetMaxHp = monster.maxHp
    this.store.currentTargetInRange = true
  }

  private getLivingMonsters() {
    return this.monsters.filter(monster => monster.alive)
  }

  private cycleMonster(direction: 1 | -1) {
    const livingMonsters = this.getLivingMonsters()
    if (livingMonsters.length === 0) return

    const selectedIndex = livingMonsters.findIndex(monster => monster.id === this.selectedMonsterId)
    const startIndex = selectedIndex < 0 ? (direction > 0 ? -1 : 0) : selectedIndex
    const nextIndex = (startIndex + direction + livingMonsters.length) % livingMonsters.length
    this.selectMonster(livingMonsters[nextIndex].id)
  }

  private nextMonster = () => this.cycleMonster(1)
  private previousMonster = () => this.cycleMonster(-1)

  private registerEvents() {
    this.game.events.on('combat:attack', this.basicAttack, this)
    this.game.events.on('combat:skill', this.useSkill, this)
    this.game.events.on('combat:item', this.usePotion, this)
    this.game.events.on('combat:auto', this.toggleAuto, this)
    this.game.events.on('combat:target', this.selectMonster, this)
    this.game.events.on('target:next', this.nextMonster, this)
    this.game.events.on('target:previous', this.previousMonster, this)
    this.game.events.on('combat:pause', this.togglePause, this)
    this.game.events.on('combat:reset', this.resetBattle, this)
    this.game.events.on('mount:change', this.applyMount, this)
    this.game.events.on('auto:toggle', this.toggleAuto, this)
  }

  private applyMount = (mountId: MountId | null) => {
    this.mountSprite?.destroy()
    this.mountSprite = null
    if (!mountId) return

    const texture = mountId === 'ice-dragon' ? 'mount-ice-dragon' : 'mount-mechanical-frog'
    const portrait = this.scale.height > this.scale.width * 1.25
    const size = mountId === 'ice-dragon'
      ? portrait ? { width: 220, height: 220 } : { width: 170, height: 170 }
      : portrait ? { width: 220, height: 180 } : { width: 170, height: 139 }
    this.mountSprite = this.add.image(0, portrait ? 125 : 82, texture)
      .setDisplaySize(size.width, size.height)
    this.player.addAt(this.mountSprite, 1)
  }

  private basicAttack = () => {
    if (this.paused || this.time.now < this.attackCooldownUntil) return
    this.attackCooldownUntil = this.time.now + Math.max(300, 650 - this.store.attackSpeed * 12)
    this.performAttack(false)
  }

  private useSkill = () => {
    if (this.paused || this.time.now < this.skillCooldownUntil) return
    if (this.store.mp < 20) {
      this.store.autoMessage = 'Không đủ MP để dùng kỹ năng'
      return
    }
    this.skillCooldownUntil = this.time.now + 3500
    this.store.mp -= 20
    this.performAttack(true)
  }

  private usePotion = () => {
    if (this.store.useHealingPotion()) {
      this.store.autoMessage = 'Đã dùng thuốc hồi phục'
      this.drawPlayerHp()
      this.showFloat(this.player.x, this.player.y - 100, '+50 HP', '#72ef90')
    }
  }

  private toggleAuto = (enabled: boolean) => {
    this.autoEnabled = Boolean(enabled)
  }

  private togglePause = () => {
    this.paused = !this.paused
  }

  private resetBattle = () => {
    this.scene.restart()
  }

  private autoAttack(now: number) {
    if (now < this.attackCooldownUntil) return
    if (this.store.mp >= 20) {
      this.useSkill()
    } else {
      this.basicAttack()
    }
  }

  private performAttack(skill: boolean) {
    let monster = this.monsters.find(candidate =>
      candidate.id === this.selectedMonsterId && candidate.alive
    )
    if (!monster) {
      monster = this.getLivingMonsters()[0]
      if (monster) this.selectMonster(monster.id)
    }
    if (!monster) return

    const base = this.store.attackPower
    const critical = Math.random() < this.store.criticalChance
    const damage = (skill ? base * 2 : base + Phaser.Math.Between(-2, 4)) * (critical ? 2 : 1)
    monster.hp -= Math.max(1, damage)
    this.drawMonsterHp(monster)
    this.store.currentTargetHp = Math.max(0, monster.hp)

    this.showAttackEffect(monster, skill)
    if (skill) this.animateCompanionSkill(monster)
    if (monster.hp <= 0) this.defeatMonster(monster)
  }

  private animateCompanionSkill(monster: MonsterView) {
    const scaleX = this.companion.scaleX
    const scaleY = this.companion.scaleY
    this.tweens.add({
      targets: this.companion,
      x: monster.container.x - 100,
      scaleX: scaleX * 1.15,
      scaleY: scaleY * 1.15,
      duration: 260,
      yoyo: true,
      ease: 'Sine.InOut'
    })
  }

  private showAttackEffect(monster: MonsterView, skill: boolean) {
    const targetX = monster.container.x
    const targetY = monster.container.y

    this.tweens.add({
      targets: monster.container,
      angle: skill ? 8 : -6,
      yoyo: true,
      duration: 55,
      repeat: 1,
      ease: 'Quad.InOut'
    })

    if (skill) {
      const ring = this.add.image(targetX, targetY, 'effect-hit')
        .setDisplaySize(150, 150)
        .setAlpha(0.95)
        .setDepth(28)
      this.tweens.add({
        targets: ring,
        scale: 1.35,
        alpha: 0,
        duration: 300,
        onComplete: () => ring.destroy()
      })
      for (let i = 0; i < 8; i++) {
        const shard = this.add.star(targetX + Phaser.Math.Between(-40, 40), targetY + Phaser.Math.Between(-45, 45), 4, 4, 10, 0xc6f8ff)
        this.tweens.add({ targets: shard, scale: 0, alpha: 0, duration: 500, delay: i * 25, onComplete: () => shard.destroy() })
      }
    } else {
      const slash = this.add.image(targetX, targetY, 'effect-slash')
        .setDisplaySize(170, 170)
        .setDepth(28)
      this.tweens.add({
        targets: slash,
        x: targetX,
        y: targetY,
        scale: 1.8,
        alpha: 0,
        duration: 220,
        onComplete: () => slash.destroy()
      })
    }

    this.showFloat(targetX, targetY - 80, `-${skill ? this.store.attackPower * 2 : Math.max(1, this.store.attackPower)}`
      , skill ? '#65ddff' : '#ffe17a')
  }

  private showFloat(x: number, y: number, text: string, color: string) {
    const label = this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
      color,
      stroke: '#4b3342',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(30)
    this.tweens.add({
      targets: label,
      y: y - 55,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy()
    })
  }

  private defeatMonster(monster: MonsterView) {
    if (!claimMonsterDefeat(monster)) return
    monster.respawnAt = this.time.now + 5000
    monster.hpBar.clear()
    this.tweens.add({
      targets: monster.container,
      alpha: 0,
      scale: 0.2,
      y: monster.container.y + 35,
      duration: 420,
      onComplete: () => monster.container.setVisible(false)
    })

    const gold = rollGoldReward(monster.kind === 'boss' ? 30 : 5, monster.kind === 'boss' ? 50 : 12)
    this.store.gold += gold
    this.store.gainExp(monster.kind === 'boss' ? 60 : 18)
    this.store.recordMonsterDefeat()
    this.store.lootMessage = `${monster.name} bị đánh bại · +${gold} vàng`
    this.store.autoMessage = `${monster.name} bị đánh bại`
    this.showFloat(monster.container.x, monster.container.y - 100, 'K.O.', '#ffd36b')

    tryGrantEquipmentDrop(
      monster.kind,
      Math.random,
      () => this.store.createLootEquipment(monster.kind),
      item => this.store.addItem(item)
    )

    const living = this.getLivingMonsters()
    if (living[0]) this.selectMonster(living[0].id)
  }

  private respawnMonster(monster: MonsterView) {
    const data = MONSTER_DATA[monster.kind]
    monster.hp = data.hp
    monster.maxHp = data.hp
    monster.alive = true
    monster.respawnAt = 0
    monster.container.setVisible(true).setScale(1).setAlpha(1)
    this.drawMonsterHp(monster)
  }

  private monsterAttack(monster: MonsterView) {
    if (this.store.hp <= 0) return
    const dodged = Math.random() < this.store.dodgeChance
    this.animateMonsterAttack(monster, !dodged)
    if (dodged) {
      this.store.autoMessage = 'Né tránh thành công!'
      this.showFloat(this.player.x, this.player.y - 100, 'NÉ TRÁNH', '#78dcff')
      return
    }
    const damage = monster.attack
    const actual = this.store.takeDamage(damage)
    this.drawPlayerHp()
    this.showFloat(this.player.x, this.player.y - 100, `-${actual}`, '#ff6c70')
    this.cameras.main.shake(180, 0.006)
    this.store.autoMessage = `${monster.name} tấn công · -${actual} HP`

    if (this.store.hp <= 0) {
      this.autoEnabled = false
      this.store.autoBattle = false
      this.playerRespawnAt = this.time.now + 2500
      this.store.autoMessage = 'Đã bị đánh bại · đang hồi sinh'
    }
  }

  private animateMonsterAttack(monster: MonsterView, hitsPlayer: boolean) {
    this.tweens.add({
      targets: monster.container,
      x: Math.max(this.player.x + 120, monster.container.x - 30),
      duration: 130,
      yoyo: true,
      ease: 'Quad.In',
      onUpdate: () => this.drawMonsterHp(monster)
    })

    if (!hitsPlayer) return

    const impact = this.add.image(this.player.x + 18, this.player.y + 12, 'effect-slash')
      .setDisplaySize(105, 105)
      .setTint(0xff6873)
      .setAlpha(0.9)
      .setDepth(28)
    this.tweens.add({
      targets: impact,
      scale: 1.4,
      alpha: 0,
      duration: 240,
      onComplete: () => impact.destroy()
    })
    this.tweens.add({
      targets: this.player,
      alpha: 0.45,
      yoyo: true,
      repeat: 1,
      duration: 80
    })
  }

  private respawnPlayer() {
    this.playerRespawnAt = 0
    this.store.restoreHealth(Math.ceil(this.store.maxHp * 0.5))
    this.drawPlayerHp()
    this.showFloat(this.player.x, this.player.y - 100, 'HỒI SINH', '#78dcff')
    this.store.autoMessage = 'Đã hồi sinh · tiếp tục chiến đấu'
  }

  shutdown() {
    this.game.events.off('combat:attack', this.basicAttack, this)
    this.game.events.off('combat:skill', this.useSkill, this)
    this.game.events.off('combat:item', this.usePotion, this)
    this.game.events.off('combat:auto', this.toggleAuto, this)
    this.game.events.off('combat:target', this.selectMonster, this)
    this.game.events.off('target:next', this.nextMonster, this)
    this.game.events.off('target:previous', this.previousMonster, this)
    this.game.events.off('combat:pause', this.togglePause, this)
    this.game.events.off('combat:reset', this.resetBattle, this)
    this.game.events.off('auto:toggle', this.toggleAuto, this)
  }
}
