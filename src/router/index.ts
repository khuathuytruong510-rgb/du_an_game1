import { createRouter, createWebHistory } from 'vue-router'
import { usePlayerStore } from '../stores/player'

const routes = [
  {
    path: '/',
    name: 'Game',
    component: () => import('../views/GameView.vue'),
    meta: { title: 'Chiênio Game - Auto Battle MVP' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { title: 'Cài đặt' }
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('../views/InventoryView.vue'),
    meta: { title: 'Túi đồ', requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async to => {
  const player = usePlayerStore()
  if (!to.meta.requiresAuth) return true

  if (!player.accountEmail) await player.loadAccount()
  if (player.accountEmail) return true

  return { path: '/settings', query: { redirect: to.fullPath } }
})

export default router