<template>
  <main class="game-view">
    <div v-if="player.authLoading" class="session-banner">{{ player.accountStatus }}</div>
    <header class="top-hud">
      <div class="character-card"><div class="avatar">🍄</div><div><strong>Nấm Lùn</strong><span>Cấp {{ player.level }}</span></div></div>
      <div class="progress-card"><div class="progress-label"><span>EXP</span><span>{{ Math.floor(player.exp) }} / {{ expToNextLevel }}</span></div><div class="progress-track"><div class="progress-fill" :style="{ width: `${expProgress}%` }"></div></div></div>
      <div class="currency-card">🪙 {{ player.gold }} vàng</div>
      <nav class="game-nav"><RouterLink to="/inventory">Túi đồ</RouterLink><RouterLink to="/settings">Cài đặt</RouterLink></nav>
    </header>

    <section class="mission-card">
      <strong>🍄 HÀNH TRÌNH NẤM LÙN</strong>
      <span>Vượt qua ba chặng, gom xu, đánh quái và về đích!</span>
      <span class="keys-hint">A / D hoặc ← / → di chuyển · SPACE / W nhảy · J đánh · P tạm dừng</span>
    </section>

    <aside class="quest-tracker"><div class="quest-tracker-header"><strong>NHIỆM VỤ</strong><RouterLink to="/inventory">Chi tiết</RouterLink></div>
      <article v-for="quest in activeQuests" :key="quest.id" class="tracked-quest"><div class="tracked-quest-label"><span>{{ quest.title }}</span><strong>{{ quest.progress }} / {{ quest.required }}</strong></div>
        <div class="quest-progress-track"><div class="quest-progress-fill" :class="{ complete: quest.progress >= quest.required }" :style="{ width: `${Math.min(100, quest.progress / quest.required * 100)}%` }"></div></div>
        <small v-if="quest.progress >= quest.required">Hoàn thành · nhận thưởng trong túi đồ</small>
      </article><p v-if="activeQuests.length === 0" class="all-quests-complete">Đã nhận hết thưởng nhiệm vụ</p>
    </aside>

    <div v-if="player.lootMessage" class="loot-notice">{{ player.lootMessage }}</div>
    <div v-if="player.forgeOpen" class="forge-overlay" @click.self="player.closeForgePanel"><section ref="forgeDialog" class="forge-dialog" role="dialog" aria-modal="true" aria-labelledby="forge-dialog-title" tabindex="-1" @click.stop>
      <header class="forge-dialog-header"><div><span>THỢ RÈN · TÂN THỦ THÀNH</span><h2 id="forge-dialog-title">Lò cường hóa</h2></div><button ref="forgeCloseButton" class="forge-close" :disabled="player.forgeInProgress" @click="player.closeForgePanel">×</button></header>
      <p class="forge-gold">Vàng hiện có: {{ player.gold.toLocaleString('vi-VN') }}</p><p class="forge-rates">+0 → +1: 90% · 1.000 vàng<br />+1 → +2: 70% · 2.000 vàng<br />+2 → +3: 50% · 3.000 vàng</p>
      <p v-if="!player.accountEmail" class="forge-login-note">Đăng nhập để dùng lò rèn. <RouterLink to="/settings" @click="player.closeForgePanel">Mở Cài đặt</RouterLink></p>
      <div v-if="forgeWeapons.length" class="forge-weapons"><article v-for="weapon in forgeWeapons" :key="weapon.id" class="forge-weapon"><div class="forge-weapon-stats"><strong>{{ weapon.name }} +{{ weapon.enhanceLevel ?? 0 }}</strong><span>ATK {{ 10 + (weapon.attackBonus ?? 0) }}</span></div><button :disabled="!player.accountEmail || player.forgeInProgress || (weapon.enhanceLevel ?? 0) >= 3 || player.gold < enhancementCost(weapon.enhanceLevel ?? 0)" @click="enhanceFromForge(weapon.id)">{{ player.forgeInProgress ? 'Đang xử lý…' : (weapon.enhanceLevel ?? 0) >= 3 ? 'Đã đạt +3' : player.gold < enhancementCost(weapon.enhanceLevel ?? 0) ? 'Không đủ vàng' : `Cường hóa · ${enhancementCost(weapon.enhanceLevel ?? 0).toLocaleString('vi-VN')} vàng` }}</button></article></div>
      <p v-else class="forge-empty">Bạn chưa có vũ khí trong túi đồ.</p><p v-if="forgeFeedback" class="forge-result" :class="`forge-result-${forgeFeedbackState}`" role="status">{{ forgeFeedback }}</p>
    </section></div>

    <footer class="action-bar"><div class="desktop-hint">🍄 Chạm nút hoặc dùng bàn phím để chạy, nhảy và hạ quái!</div><button @click="emitGameEvent('platform:pause')">Ⅱ TẠM DỪNG</button></footer>
    <div class="touch-controls" aria-label="Điều khiển game">
      <div class="touch-move"><button aria-label="Đi sang trái" @pointerdown.prevent="move($event, 'left', true)" @pointerup="move($event, 'left', false)" @pointercancel="move($event, 'left', false)" @lostpointercapture="move($event, 'left', false)">◀</button><button aria-label="Đi sang phải" @pointerdown.prevent="move($event, 'right', true)" @pointerup="move($event, 'right', false)" @pointercancel="move($event, 'right', false)" @lostpointercapture="move($event, 'right', false)">▶</button></div>
      <div class="touch-actions"><button class="jump" aria-label="Nhảy" @pointerdown.prevent="move($event, 'jump', true)" @pointerup="move($event, 'jump', false)" @pointercancel="move($event, 'jump', false)" @lostpointercapture="move($event, 'jump', false)">⬆ NHẢY</button><button class="attack" aria-label="Đánh" @pointerdown.prevent="move($event, 'attack', true)" @pointerup="move($event, 'attack', false)" @pointercancel="move($event, 'attack', false)" @lostpointercapture="move($event, 'attack', false)">⚔ ĐÁNH</button></div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player'
import { emitGameEvent } from '../game/createGame'

const player = usePlayerStore()
const forgeFeedback = ref('')
const forgeFeedbackState = ref<'success' | 'error'>('success')
const forgeDialog = ref<HTMLElement | null>(null)
const forgeCloseButton = ref<HTMLButtonElement | null>(null)
const expToNextLevel = computed(() => player.expToNextLevel)
const expProgress = computed(() => expToNextLevel.value ? Math.min(100, player.exp / expToNextLevel.value * 100) : 0)
const activeQuests = computed(() => player.quests.filter(quest => !quest.claimed))
const forgeWeapons = computed(() => player.inventory.filter(item => item.type === 'equipment' && item.slot === 'weapon'))
const enhancementCost = (level: number) => [1000, 2000, 3000][level] ?? 3000
const move = (event: PointerEvent, action: 'left' | 'right' | 'jump' | 'attack', pressed: boolean) => {
  const button = event.currentTarget as HTMLButtonElement
  if (pressed && event.type === 'pointerdown') button.setPointerCapture(event.pointerId)
  emitGameEvent('platform:move', { action, pressed })
}
const onKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') player.closeForgePanel() }
watch(() => player.forgeOpen, async opened => { if (opened) { await nextTick(); forgeCloseButton.value?.focus() } })
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
window.addEventListener('keydown', onKeydown)
</script>

<style scoped>
.game-view{position:fixed;inset:0;z-index:2;pointer-events:none;color:#fff;font-family:Inter,"Segoe UI",Arial,sans-serif}.game-view button,.game-view a{pointer-events:auto}.top-hud{position:absolute;left:50%;top:12px;transform:translateX(-50%);width:min(900px,calc(100% - 32px));display:flex;align-items:center;gap:16px;padding:10px 14px;border:1px solid #ffffff66;border-radius:16px;background:#183f36df;box-shadow:0 5px 18px #253d3755;pointer-events:auto}.character-card{display:flex;align-items:center;gap:9px;min-width:120px}.avatar{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#f8e6b8;font-size:25px}.character-card strong,.character-card span{display:block}.character-card span{font-size:12px;color:#d6e8ca}.progress-card{flex:1;min-width:90px}.progress-label{display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px}.progress-track,.quest-progress-track{height:7px;border-radius:8px;background:#ffffff35;overflow:hidden}.progress-fill,.quest-progress-fill{height:100%;background:linear-gradient(90deg,#f6d44c,#ff9c40);border-radius:8px}.currency-card{white-space:nowrap;font-weight:700}.game-nav{display:flex;gap:7px}.game-nav a,.action-bar button{color:#fff;text-decoration:none;font-weight:700;background:#ffffff20;border:1px solid #ffffff55;border-radius:10px;padding:8px 10px}.mission-card{position:absolute;left:18px;top:92px;display:grid;gap:5px;padding:11px 14px;border-radius:12px;background:#24483ac9;font-size:13px;max-width:360px}.mission-card>strong{color:#ffe28a}.keys-hint{font-size:11px;color:#e6f3db}.quest-tracker{position:absolute;right:18px;top:96px;width:220px;padding:12px;background:#193c35d9;border:1px solid #ffffff3d;border-radius:12px}.quest-tracker-header,.tracked-quest-label{display:flex;justify-content:space-between;gap:8px}.quest-tracker-header{font-size:12px;margin-bottom:10px}.quest-tracker a{color:#ffe28a}.tracked-quest{margin:8px 0;font-size:11px}.quest-progress-track{margin-top:6px}.quest-progress-fill.complete{background:#6ce09b}.tracked-quest small{display:block;margin-top:4px;color:#9df0b2}.all-quests-complete{font-size:11px}.loot-notice,.session-banner{position:absolute;top:90px;left:50%;transform:translateX(-50%);padding:9px 14px;background:#714d27e8;border-radius:10px}.action-bar{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:min(950px,calc(100% - 32px));display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-radius:12px;background:#193d35db;pointer-events:auto}.desktop-hint{font-size:13px;color:#e2f2d9}.touch-controls{position:absolute;bottom:20px;left:0;right:0;display:flex;justify-content:space-between;padding:0 22px;pointer-events:none}.touch-move,.touch-actions{display:flex;gap:12px;pointer-events:auto}.touch-controls button{width:62px;height:58px;border:2px solid #ffffff8c;border-radius:18px;background:#245e4dd9;color:white;font-size:21px;font-weight:bold;touch-action:none;user-select:none}.touch-actions .jump,.touch-actions .attack{width:78px;font-size:12px}.touch-actions .attack{background:#a2473fe8}.forge-overlay{position:fixed;inset:0;display:grid;place-items:center;background:#101916b8;pointer-events:auto}.forge-dialog{width:min(520px,calc(100% - 28px));padding:22px;border-radius:18px;background:#fff5df;color:#49382f}.forge-dialog-header{display:flex;justify-content:space-between}.forge-close,.forge-weapon button{padding:9px;border:0;border-radius:9px;background:#579655;color:#fff}.forge-dialog h2{margin:5px 0}.forge-rates{line-height:1.7}.forge-weapon{display:flex;justify-content:space-between;gap:8px;margin:8px 0}.forge-weapon-stats span{display:block}.forge-result-success{color:#36804a}.forge-result-error{color:#b8473d}
@media(max-width:680px){.top-hud{top:8px;gap:7px;padding:8px;width:calc(100% - 16px)}.character-card{min-width:auto}.avatar{width:34px;height:34px}.progress-card{max-width:90px}.currency-card{font-size:12px}.game-nav{flex-direction:column;gap:4px}.game-nav a{padding:4px 7px;font-size:11px}.mission-card{top:85px;left:8px;max-width:calc(100% - 16px);font-size:11px}.keys-hint{display:none}.quest-tracker{display:none}.action-bar{bottom:90px;width:auto;right:10px;left:auto;transform:none;padding:0;background:transparent}.desktop-hint{display:none}.action-bar button{font-size:11px;padding:7px}.touch-controls{bottom:14px;padding:0 12px}.touch-controls button{width:54px;height:52px}.touch-actions .jump,.touch-actions .attack{width:68px}.loot-notice{top:143px;white-space:nowrap}}
</style>
