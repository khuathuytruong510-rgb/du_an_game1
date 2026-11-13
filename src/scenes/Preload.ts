import Phaser from 'phaser'

export default class PreloadScene extends Phaser.Scene {
  preload() {
    // Tải sprite cho nhân vật - class Chiến binh
    this.load.spritesheet('player_chienbinh', '/assets/player_chienbinh.png', {
      frameWidth: 32,
      frameHeight: 48
    })
    
    // Sprite cho quái Slime
    this.load.spritesheet('slime', '/assets/slime.png', {
      frameWidth: 32,
      frameHeight: 32
    })
    
    // Sprite cho quái Goblin
    this.load.spritesheet('goblin', '/assets/goblin.png', {
      frameWidth: 32,
      frameHeight: 48
    })
    
    // Tải tilemap cho bản đồ
    this.load.tilemapTiledJSON('map', '/assets/map.json')
    this.load.image('terrain', '/assets/terrain.png')
    this.load.image('background', '/assets/background.png')
    
    // Tải hiệu ứng
    this.load.image('particle', '/assets/particle.png')
    this.load.audio('sfx_attack', '/assets/sfx_attack.mp3')
    this.load.audio('sfx_skill', '/assets/sfx_skill.mp3')
    this.load.audio('sfx_levelup', '/assets/sfx_levelup.mp3')
    this.load.audio('sfx_loot', '/assets/sfx_loot.mp3')
  }

  create() {
    // Chuyển sang scene World khi assets đã tải xong
    this.scene.start('World')
  }
}