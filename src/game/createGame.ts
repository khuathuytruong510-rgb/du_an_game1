import Phaser from 'phaser'
import WorldScene from '../scenes/World'
import type { TouchDirection } from './types'
import { SingleFlight } from './singleFlight'

let game: Phaser.Game | null = null
let pendingDestroy: Promise<void> = Promise.resolve()
const gameCreation = new SingleFlight<Phaser.Game>()

const createGameInstance = async (
  parent: HTMLElement,
  shouldCreate: () => boolean
): Promise<Phaser.Game | null> => {
  await pendingDestroy
  if (!shouldCreate()) return null
  if (game) return game

  const activeGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#14243a',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: 1280,
      height: 720
    },
    scene: [WorldScene]
  })
  game = activeGame
  pendingDestroy = new Promise<void>(resolve => {
    activeGame.events.once(Phaser.Core.Events.DESTROY, () => {
      if (game === activeGame) game = null
      resolve()
    })
  })

  return new Promise<Phaser.Game | null>(resolve => {
    let removeSceneCreateListener: (() => void) | undefined
    let sceneReadinessHandled = false
    const onDestroy = () => {
      activeGame.events.off(Phaser.Core.Events.READY, onReady)
      removeSceneCreateListener?.()
      resolve(null)
    }
    const onSceneCreate = () => {
      activeGame.events.off(Phaser.Core.Events.DESTROY, onDestroy)
      removeSceneCreateListener = undefined
      if (game !== activeGame || !shouldCreate()) {
        if (game === activeGame) destroyGame()
        resolve(null)
        return
      }

      resolve(activeGame)
    }
    const onReady = () => {
      if (sceneReadinessHandled) return
      sceneReadinessHandled = true

      const sceneEvents = activeGame.scene.getScene('World').events
      sceneEvents.once(Phaser.Scenes.Events.CREATE, onSceneCreate)
      removeSceneCreateListener = () =>
        sceneEvents.off(Phaser.Scenes.Events.CREATE, onSceneCreate)
      if (activeGame.scene.isActive('World')) onSceneCreate()
    }

    activeGame.events.once(Phaser.Core.Events.DESTROY, onDestroy)
    activeGame.events.once(Phaser.Core.Events.READY, onReady)
    if (activeGame.isRunning) onReady()
  })
}

export const createGame = (
  parent: HTMLElement,
  shouldCreate: () => boolean = () => true
): Promise<Phaser.Game | null> => gameCreation.run(
  shouldCreate,
  () => game,
  () => createGameInstance(parent, shouldCreate)
)

export const getGame = (): Phaser.Game | null => game

export const emitTouchMovement = (direction: TouchDirection, pressed: boolean) => {
  game?.events.emit('move:touch', direction, pressed)
}

export const emitGameEvent = (
  event:
    | 'platform:move'
    | 'platform:pause'
    | 'auto:toggle'
    | 'manual:attack'
    | 'manual:skill'
    | 'target:next'
    | 'target:previous'
    | 'target:approach'
    | 'target:approach:cancel',
  payload?: unknown
) => {
  if (event === 'platform:pause') game?.events.emit(event)
  else game?.events.emit(event, payload)
}

export const destroyGame = () => {
  const activeGame = game
  game = null
  if (!activeGame) return

  activeGame.events.emit('game:shutdown')
  activeGame.destroy(true)
}
