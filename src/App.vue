<template>
  <div id="app">
    <div ref="gameHost" class="game-host"></div>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePlayerStore } from './stores/player'

const gameHost = ref<HTMLElement | null>(null)
const player = usePlayerStore()
const route = useRoute()
type GameModule = typeof import('./game/createGame')
let gameModule: GameModule | undefined
let stopSaving: (() => void) | undefined
let stopWatchingRoute: (() => void) | undefined
let remoteSaveTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false
let routeGeneration = 0

const scheduleRemoteSave = () => {
  clearTimeout(remoteSaveTimer)
  remoteSaveTimer = setTimeout(() => {
    remoteSaveTimer = undefined
    void player.persistRemoteGame()
  }, 1000)
}

watch(() => player.autoBattle, enabled => {
  gameModule?.emitGameEvent('auto:toggle', enabled)
})

onMounted(async () => {
  player.initializeGame()
  await player.loadAccount()
  if (disposed) return

  stopSaving = watch(
    () => JSON.stringify({ ...player.getSaveData(), savedAt: '' }),
    () => {
      player.persistGame()
      scheduleRemoteSave()
    },
    { flush: 'post' }
  )

  stopWatchingRoute = watch(
    () => route.path,
    async path => {
      const generation = ++routeGeneration
      if (path !== '/') {
        gameModule?.destroyGame()
        return
      }

      if (!gameHost.value) {
        throw new Error('Không tìm thấy vùng hiển thị game')
      }

      const loadedGameModule = await import('./game/createGame')
      const isCurrentRoute = () =>
        !disposed &&
        routeGeneration === generation &&
        route.path === '/'
      if (!isCurrentRoute()) return

      gameModule = loadedGameModule
      const createdGame = await loadedGameModule.createGame(gameHost.value, isCurrentRoute)
      if (!createdGame || !isCurrentRoute()) return
      if (player.autoBattle) loadedGameModule.emitGameEvent('auto:toggle', true)
    },
    { immediate: true }
  )
})

onBeforeUnmount(() => {
  disposed = true
  stopSaving?.()
  stopWatchingRoute?.()
  clearTimeout(remoteSaveTimer)
  gameModule?.destroyGame()
})
</script>

<style>
#app {
  min-height: 100vh;
}

.game-host {
  position: fixed;
  inset: 0;
  z-index: 0;
}
</style>