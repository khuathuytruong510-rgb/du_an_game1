import Phaser from 'phaser'
import { usePlayerStore } from '../stores/player'
import { rollGoldReward } from '../game/systems/rewards'

type Platform = { x: number; y: number; width: number; height: number }
type Coin = { body: Phaser.GameObjects.Arc; shine: Phaser.GameObjects.Arc; taken: boolean }
type Foe = { body: Phaser.GameObjects.Container; min: number; max: number; direction: number; alive: boolean }

const WIDTH = 2600
const HEIGHT = 700
const PLAYER_SPEED = 260
const PLAYER_JUMP = 590

export default class WorldScene extends Phaser.Scene {
  private readonly store = usePlayerStore()
  private player!: Phaser.GameObjects.Container
  private playerGraphics!: Phaser.GameObjects.Graphics
  private platforms: Platform[] = []
  private readonly spikePositions = [475, 1090, 1330, 1675, 2210]
  private coins: Coin[] = []
  private foes: Foe[] = []
  private keys!: Record<'left' | 'right' | 'leftArrow' | 'rightArrow' | 'jump' | 'up' | 'attack' | 'pause', Phaser.Input.Keyboard.Key>
  private velocityY = 0
  private grounded = false
  private facing = 1
  private paused = true
  private ended = false
  private hearts = 3
  private score = 0
  private checkpoint = 110
  private jumpQueued = false
  private attackQueued = false
  private overlay!: Phaser.GameObjects.Container
  private overlayText!: Phaser.GameObjects.Text
  private overlayButtonLabel!: Phaser.GameObjects.Text
  private hud!: Phaser.GameObjects.Text
  private touchLeft = false
  private touchRight = false
  private touchJump = false
  private touchAttack = false
  private touchEvents = {
    left: (pressed: boolean) => { this.touchLeft = pressed },
    right: (pressed: boolean) => { this.touchRight = pressed },
    jump: (pressed: boolean) => { if (pressed) this.jumpQueued = true; this.touchJump = pressed },
    attack: (pressed: boolean) => { if (pressed) this.attackQueued = true; this.touchAttack = pressed }
  }

  constructor() { super({ key: 'World' }) }

  create() {
    const { width, height } = this.scale
    this.paused = true
    this.ended = false
    this.hearts = 3
    this.score = 0
    this.checkpoint = 110
    this.velocityY = 0
    this.grounded = false
    this.facing = 1
    this.jumpQueued = false
    this.attackQueued = false
    this.touchLeft = this.touchRight = this.touchJump = this.touchAttack = false
    this.coins = []
    this.foes = []
    this.cameras.main.setBackgroundColor('#8bd8ee')
    this.drawBackdrop(width, height)
    this.buildLevel()
    this.createHero()
    this.createCoins()
    this.createFoes()
    this.createHud(width)
    this.keys = this.input.keyboard!.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      leftArrow: Phaser.Input.Keyboard.KeyCodes.LEFT,
      rightArrow: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      up: Phaser.Input.Keyboard.KeyCodes.W,
      attack: Phaser.Input.Keyboard.KeyCodes.J,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC
    }) as typeof this.keys
    this.input.keyboard!.on('keydown-SPACE', this.queueJump, this)
    this.input.keyboard!.on('keydown-J', this.queueAttack, this)
    this.input.keyboard!.on('keydown-P', this.togglePause, this)
    this.game.events.on('platform:move', this.handleMove, this)
    this.game.events.on('platform:pause', this.togglePause, this)
    this.cameras.main.setBounds(0, 0, WIDTH, HEIGHT)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.12)
    this.createOverlay(width, height)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this)
  }

  update(_time: number, delta: number) {
    if (this.paused || this.ended) return
    const dt = Math.min(delta, 34) / 1000
    const left = this.keys.left.isDown || this.keys.leftArrow.isDown || this.touchLeft
    const right = this.keys.right.isDown || this.keys.rightArrow.isDown || this.touchRight
    const direction = Number(right) - Number(left)
    if (direction) this.facing = direction
    this.player.x = Phaser.Math.Clamp(this.player.x + direction * PLAYER_SPEED * dt, 25, WIDTH - 25)
    this.playerGraphics.setScale(this.facing, 1)
    if ((this.keys.jump.isDown || this.keys.up.isDown || this.touchJump) && this.grounded) this.jumpQueued = true
    if (this.jumpQueued && this.grounded) {
      this.velocityY = -PLAYER_JUMP
      this.grounded = false
    }
    this.jumpQueued = false
    this.velocityY = Math.min(this.velocityY + 1500 * dt, 850)
    const oldBottom = this.player.y + 27
    this.player.y += this.velocityY * dt
    this.grounded = false
    for (const platform of this.platforms) {
      const crosses = oldBottom <= platform.y && this.player.y + 27 >= platform.y
      const overlaps = this.player.x + 14 > platform.x && this.player.x - 14 < platform.x + platform.width
      if (this.velocityY >= 0 && crosses && overlaps) {
        this.player.y = platform.y - 27
        this.velocityY = 0
        this.grounded = true
      }
    }
    if (this.player.y > HEIGHT + 90) this.takeHit(true)
    if (this.attackQueued || this.keys.attack.isDown || this.touchAttack) this.attack()
    this.attackQueued = false
    this.updateCoins()
    this.updateFoes(dt)
    this.updateCheckpoint()
    if (this.player.x > WIDTH - 100 && this.player.y > 400) this.finish(true)
    this.hud.setText(`❤ ${'♥'.repeat(this.hearts)}${'♡'.repeat(3 - this.hearts)}     ★ ${this.score}     🪙 ${this.store.gold}     CHẶNG ${this.player.x < 850 ? '1' : this.player.x < 1650 ? '2' : '3'} / 3`)
  }

  private drawBackdrop(width: number, height: number) {
    const sky = this.add.graphics()
    sky.fillGradientStyle(0x8bd8ee, 0xd7f4d2, 0x8bd8ee, 0xd7f4d2, 1)
    sky.fillRect(0, 0, WIDTH, HEIGHT)
    sky.setScrollFactor(0.15)
    for (let x = 100; x < WIDTH; x += 440) {
      const hill = this.add.ellipse(x, 510, 570, 190, 0x76bd83).setDepth(-2).setScrollFactor(0.32)
      const tree = this.add.graphics().setDepth(-1).setScrollFactor(0.45)
      tree.fillStyle(0x557c55, 1); tree.fillRect(x + 165, 380, 20, 95)
      tree.fillStyle(0x428d63, 1); tree.fillCircle(x + 175, 375, 48)
      void hill
    }
    this.add.text(30, 20, 'NẤM LÙN TIẾN LÊN', { fontFamily: 'Arial', fontSize: '25px', fontStyle: 'bold', color: '#295b4c', stroke: '#efffc8', strokeThickness: 5 }).setScrollFactor(0).setDepth(20)
    void width; void height
  }

  private buildLevel() {
    this.platforms = [
      { x: 0, y: 590, width: 520, height: 110 }, { x: 610, y: 545, width: 230, height: 155 },
      { x: 920, y: 590, width: 500, height: 110 }, { x: 1500, y: 530, width: 260, height: 170 },
      { x: 1830, y: 590, width: 420, height: 110 }, { x: 2350, y: 550, width: 250, height: 150 },
      { x: 320, y: 445, width: 140, height: 24 }, { x: 1010, y: 435, width: 150, height: 24 },
      { x: 1235, y: 365, width: 120, height: 24 }, { x: 1940, y: 435, width: 135, height: 24 },
      { x: 2135, y: 370, width: 120, height: 24 }
    ]
    const g = this.add.graphics()
    for (const p of this.platforms) {
      g.fillStyle(0x754b35, 1); g.fillRoundedRect(p.x, p.y, p.width, p.height, 8)
      g.fillStyle(0x69b84f, 1); g.fillRoundedRect(p.x, p.y, p.width, Math.min(18, p.height), 8)
      g.fillStyle(0x8f6342, 0.75)
      for (let x = p.x + 16; x < p.x + p.width - 10; x += 45) g.fillCircle(x, p.y + 43, 3)
    }
    const spikes = this.add.graphics()
    for (const x of [475, 1090, 1330, 1675, 2210]) {
      const surface = this.platforms.find(platform => x >= platform.x && x < platform.x + platform.width)?.y ?? 590
      spikes.fillStyle(0xe9f1ce, 1)
      for (let i = 0; i < 4; i++) spikes.fillTriangle(x + i * 17, surface, x + 8 + i * 17, surface - 25, x + 17 + i * 17, surface)
    }
    for (const x of [1000, 1900, 2380]) {
      this.add.rectangle(x, 500, 5, 96, 0x614532)
      this.add.circle(x, 497, 8, 0xffdf67)
      this.add.text(x + 14, 474, '⚑', { fontSize: '26px' })
    }
    this.add.rectangle(WIDTH - 80, 497, 8, 105, 0x603c35).setOrigin(0.5, 0)
    this.add.circle(WIDTH - 80, 494, 11, 0xffdc5c)
    const sign = this.add.text(WIDTH - 150, 457, 'ĐÍCH', { fontSize: '20px', fontStyle: 'bold', color: '#fff4bf', backgroundColor: '#497b54', padding: { x: 8, y: 5 } }).setOrigin(0.5)
    this.add.container(0, 0, [sign]).setDepth(4)
  }

  private createHero() {
    this.playerGraphics = this.add.graphics()
    this.playerGraphics.fillStyle(0xf1c893, 1); this.playerGraphics.fillCircle(0, 7, 11)
    this.playerGraphics.fillStyle(0xe74c3c, 1); this.playerGraphics.fillEllipse(0, -7, 34, 20)
    this.playerGraphics.fillStyle(0xb82f35, 1); this.playerGraphics.fillEllipse(0, -16, 45, 13)
    this.playerGraphics.fillStyle(0x352d40, 1); this.playerGraphics.fillCircle(4, 5, 2)
    this.playerGraphics.fillStyle(0x4e7cda, 1); this.playerGraphics.fillRoundedRect(-10, 14, 20, 15, 4)
    this.playerGraphics.fillStyle(0x463b37, 1); this.playerGraphics.fillRoundedRect(-13, 25, 11, 5, 2); this.playerGraphics.fillRoundedRect(3, 25, 11, 5, 2)
    this.player = this.add.container(110, 563, [this.playerGraphics]).setDepth(5)
    this.add.text(110, 522, 'Nấm Lùn', { fontSize: '13px', fontStyle: 'bold', color: '#fff', stroke: '#326144', strokeThickness: 4 }).setOrigin(0.5).setDepth(6)
  }

  private createCoins() {
    for (const [x, y] of [[250, 515], [350, 400], [420, 400], [685, 470], [755, 470], [1000, 540], [1080, 390], [1275, 320], [1555, 480], [1625, 480], [1975, 390], [2165, 325], [2440, 500]] as number[][]) {
      const body = this.add.circle(x, y, 10, 0xffdf64).setStrokeStyle(3, 0xf8a92e).setDepth(3)
      const shine = this.add.circle(x, y, 4, 0xfff7b8).setDepth(4)
      this.coins.push({ body, shine, taken: false })
    }
  }

  private createFoes() {
    for (const x of [720, 1100, 1580, 2020, 2410]) {
      const platform = this.platforms.find(item => x >= item.x && x < item.x + item.width)!
      const body = this.add.container(x, platform.y - 18).setDepth(4)
      body.add(this.add.circle(0, 0, 18, 0x9b72c7).setStrokeStyle(3, 0xe5d7ff))
      body.add(this.add.circle(-6, -4, 3, 0xffffff)); body.add(this.add.circle(6, -4, 3, 0xffffff))
      this.foes.push({ body, min: Math.max(platform.x + 30, x - 60), max: Math.min(platform.x + platform.width - 30, x + 60), direction: 1, alive: true })
    }
  }

  private createHud(width: number) {
    this.hud = this.add.text(0, 20, '', { fontFamily: 'Arial', fontSize: '19px', fontStyle: 'bold', color: '#fff', stroke: '#315641', strokeThickness: 5 }).setScrollFactor(0).setDepth(30)
    this.hud.setPosition(width - 24, 22).setOrigin(1, 0)
    const hint = this.add.text(22, 61, 'A/D hoặc ←/→ di chuyển  ·  SPACE/W nhảy  ·  J đánh  ·  P tạm dừng', { fontSize: '14px', color: '#fff', stroke: '#315641', strokeThickness: 4 }).setScrollFactor(0).setDepth(30)
    void hint
  }

  private createOverlay(width: number, height: number) {
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x18354a, 0.7)
    const card = this.add.rectangle(width / 2, height / 2, 510, 275, 0xfff1d2, 0.98).setStrokeStyle(5, 0x81553c)
    const title = this.add.text(width / 2, height / 2 - 83, 'NẤM LÙN TIẾN LÊN', { fontSize: '38px', fontStyle: 'bold', color: '#408a53', stroke: '#fff', strokeThickness: 4 }).setOrigin(0.5)
    this.overlayText = this.add.text(width / 2, height / 2 - 17, 'Chạy qua ba chặng, gom xu và đánh bại quái vật.\nCẩn thận hố sâu và gai nhọn!', { fontSize: '17px', color: '#54453c', align: 'center', lineSpacing: 8 }).setOrigin(0.5)
    const button = this.add.rectangle(width / 2, height / 2 + 83, 210, 53, 0x60ae55).setStrokeStyle(3, 0x387043).setInteractive({ useHandCursor: true })
    this.overlayButtonLabel = this.add.text(width / 2, height / 2 + 83, 'BẮT ĐẦU  ▶', { fontSize: '21px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5)
    this.overlay = this.add.container(0, 0, [shade, card, title, this.overlayText, button, this.overlayButtonLabel]).setScrollFactor(0).setDepth(100)
    button.on('pointerdown', () => this.handleOverlayAction())
    this.overlayText.setText('Chạy qua ba chặng, gom xu và đánh bại quái vật.\nCẩn thận hố sâu và gai nhọn!')
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutOverlay, this)
  }

  private layoutOverlay = () => {
    if (!this.overlay?.active) return
    const width = this.scale.width; const height = this.scale.height
    for (const item of this.overlay.list) {
      if ('setPosition' in item && item instanceof Phaser.GameObjects.Rectangle) item.setPosition(width / 2, height / 2)
      else if ('setPosition' in item && item instanceof Phaser.GameObjects.Text) item.setPosition(width / 2, height / 2)
    }
    const [shade, card, title, text, button, label] = this.overlay.list as Phaser.GameObjects.GameObject[]
    ;(shade as Phaser.GameObjects.Rectangle).setSize(width, height)
    ;(card as Phaser.GameObjects.Rectangle).setSize(Math.min(510, width - 32), 275)
    ;(title as Phaser.GameObjects.Text).setY(height / 2 - 83)
    ;(text as Phaser.GameObjects.Text).setY(height / 2 - 17)
    ;(button as Phaser.GameObjects.Rectangle).setPosition(width / 2, height / 2 + 83)
    ;(label as Phaser.GameObjects.Text).setPosition(width / 2, height / 2 + 83)
  }

  private handleOverlayAction() {
    if (this.ended) { this.scene.restart(); return }
    this.paused = !this.paused
    this.overlay.setVisible(this.paused)
  }

  private togglePause = () => {
    if (this.ended) return
    this.paused = !this.paused
    this.overlay.setVisible(this.paused)
    this.overlayText.setText(this.paused ? 'Nghỉ một chút nhé!\nNhấn nút hoặc P để tiếp tục.' : '')
    this.overlayButtonLabel.setText(this.paused ? 'TIẾP TỤC  ▶' : 'BẮT ĐẦU  ▶')
  }

  private queueJump = () => { this.jumpQueued = true }
  private queueAttack = () => { this.attackQueued = true }
  private handleMove = (payload: { action: 'left' | 'right' | 'jump' | 'attack'; pressed: boolean }) => this.touchEvents[payload.action]?.(payload.pressed)

  private attack() {
    for (const foe of this.foes) {
      const targetDistance = foe.body.x - this.player.x
      if (!foe.alive || Math.abs(targetDistance) > 52 || Math.abs(foe.body.y - this.player.y) > 48 || targetDistance * this.facing < -8) continue
      if (this.velocityY > 60 && this.player.y < foe.body.y) this.velocityY = -330
      foe.alive = false
      this.tweens.add({ targets: foe.body, alpha: 0, scale: 1.7, duration: 180, onComplete: () => foe.body.destroy() })
      this.score += 100
      this.store.gainExp(12)
      this.store.gold += rollGoldReward(2, 6)
      this.store.recordMonsterDefeat()
      this.store.autoMessage = 'Quái vật đã bị đánh bại!'
    }
  }

  private updateCoins() {
    for (const coin of this.coins) {
      if (coin.taken || Phaser.Math.Distance.Between(this.player.x, this.player.y, coin.body.x, coin.body.y) > 32) continue
      coin.taken = true
      coin.body.destroy()
      coin.shine.destroy()
      this.score += 25
      this.store.gold += 1
      this.store.autoMessage = 'Nhặt được một đồng xu!'
    }
  }

  private updateFoes(dt: number) {
    for (const foe of this.foes) {
      if (!foe.alive) continue
      foe.body.x += foe.direction * 65 * dt
      if (foe.body.x < foe.min || foe.body.x > foe.max) foe.direction *= -1
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, foe.body.x, foe.body.y) < 34) {
        if (this.velocityY > 100 && this.player.y < foe.body.y - 8) {
          foe.alive = false; foe.body.destroy(); this.velocityY = -370
          this.score += 100; this.store.gainExp(12); this.store.recordMonsterDefeat()
        } else this.takeHit()
      }
    }
    for (const x of this.spikePositions) {
      const platform = this.platforms.find(item => x >= item.x && x <= item.x + item.width)
      if (!platform) continue
      const onGroundAtSpikes = Math.abs(this.player.x - x - 34) < 37 &&
        this.player.y + 26 > platform.y - 32 && this.player.y + 26 < platform.y + 12
      if (onGroundAtSpikes) this.takeHit()
    }
  }

  private updateCheckpoint() {
    for (const x of [1000, 1900, 2380]) if (this.player.x > x) this.checkpoint = x
  }

  private takeHit(fall = false) {
    if (this.time.now < (this.registry.get('invulnerableUntil') ?? 0)) return
    this.registry.set('invulnerableUntil', this.time.now + 1200)
    this.hearts -= 1
    this.velocityY = fall ? 0 : -260
    this.player.x = this.checkpoint
    this.player.y = 450
    this.store.autoMessage = `Bị thương! Còn ${this.hearts} tim.`
    this.cameras.main.shake(160, 0.008)
    if (this.hearts <= 0) this.finish(false)
  }

  private finish(won: boolean) {
    this.ended = true
    this.paused = true
    this.overlayText.setText(won
      ? `Bạn đã chinh phục cả ba chặng!\nĐiểm số: ${this.score}  ·  Vàng: ${this.store.gold}`
      : `Hết tim mất rồi!\nĐiểm số: ${this.score}  ·  Hãy thử lại nhé.`)
    this.overlayButtonLabel.setText('CHƠI LẠI  ↻')
    this.overlay.setVisible(true)
  }

  private shutdown() {
    this.game.events.off('platform:move', this.handleMove, this)
    this.game.events.off('platform:pause', this.togglePause, this)
    this.input.keyboard?.off('keydown-SPACE', this.queueJump, this)
    this.input.keyboard?.off('keydown-J', this.queueAttack, this)
    this.input.keyboard?.off('keydown-P', this.togglePause, this)
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutOverlay, this)
  }
}
