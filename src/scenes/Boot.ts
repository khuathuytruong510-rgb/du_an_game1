import Phaser from 'phaser'

export default class BootScene extends Phaser.Scene {
  preload() {
    // Tải assets ban đầu
    this.load.image('logo', '/assets/logo.png')
    this.load.audio('music', '/assets/music.mp3')
  }

  create() {
    // Chuyển sang scene Preload sau khi boot xong
    this.scene.start('Preload')
  }
}