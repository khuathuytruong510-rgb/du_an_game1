<template>
  <main class="game-view">
    <div v-if="player.authLoading || (!player.accountEmail && player.accountStatus.includes('Đang'))" class="session-banner" role="status" aria-live="polite">
      {{ player.accountStatus }}
    </div>
    <header class="top-hud">
      <div class="character-card">
        <div class="avatar">戰</div>
        <div>
          <strong>Chiến Binh</strong>
          <span>Cấp {{ player.level }}</span>
        </div>
      </div>

      <div class="progress-card">
        <div class="progress-label">
          <span>EXP</span>
          <span>{{ Math.floor(player.exp) }} / {{ expToNextLevel }}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${expProgress}%` }"></div>
        </div>
      </div>

      <div class="currency-card">🪙 {{ player.gold }} vàng</div>

      <nav class="game-nav" aria-label="Điều hướng game">
        <RouterLink to="/inventory">Túi đồ</RouterLink>
        <RouterLink to="/settings">Cài đặt</RouterLink>
      </nav>
    </header>

    <section class="battle-panel">
      <div class="battle-heading">
        <span class="status-dot" :class="{ active: player.autoBattle }"></span>
        <strong>{{ player.autoBattle ? 'AUTO ĐANG BẬT' : 'AUTO ĐANG TẮT' }}</strong>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true">{{ player.autoMessage }}</p>
      <div class="target-selector">
        <button
          type="button"
          aria-label="Chọn quái trước"
          title="Chọn quái trước"
          @click="emitGameEvent('target:previous')"
        >‹</button>
        <span>
          Mục tiêu:
          <strong role="status" aria-live="polite" aria-atomic="true">
            {{ player.currentTarget ?? 'Chưa chọn' }}
          </strong>
        </span>
        <button
          type="button"
          aria-label="Chọn quái tiếp theo"
          title="Chọn quái tiếp theo"
          @click="emitGameEvent('target:next')"
        >›</button>
      </div>
      <button
        v-if="player.autoState === 'MOVE_TO_TARGET' && !player.autoBattle"
        class="approach-button"
        @click="emitGameEvent('target:approach:cancel')"
      >
        Dừng áp sát
      </button>
      <button
        v-else
        class="approach-button"
        :disabled="player.autoBattle || !player.currentTarget || player.currentTargetInRange"
        @click="emitGameEvent('target:approach')"
      >
        {{ player.currentTargetInRange ? 'Đã trong tầm đánh' : 'Áp sát mục tiêu' }}
      </button>
      <div v-if="player.currentTarget" class="target-line">
        <p
          class="target-range"
          :class="{ inRange: player.currentTargetInRange, outOfRange: !player.currentTargetInRange }"
        >
          {{
            player.currentTargetDistance === null
              ? 'Đang đo khoảng cách…'
              : `${player.currentTargetInRange ? 'Trong tầm đánh' : 'Ngoài tầm đánh'} · ${player.currentTargetDistance} px`
          }}
        </p>
        <div
          class="target-health-track"
          role="meter"
          :aria-label="`HP của ${player.currentTarget}: ${player.currentTargetHp} trên ${player.currentTargetMaxHp}`"
          :aria-valuenow="player.currentTargetHp"
          :aria-valuemin="0"
          :aria-valuemax="player.currentTargetMaxHp"
        >
          <div class="target-health-fill" :style="{ width: `${targetHpProgress}%` }"></div>
        </div>
        <small>{{ player.currentTargetHp }} / {{ player.currentTargetMaxHp }} HP</small>
      </div>
      <div class="resource-list">
        <div
          class="resource-meter health-meter"
          :class="{ critical: hpProgress <= 25 }"
          role="meter"
          :aria-label="`HP ${player.hp} trên ${player.maxHp}`"
          :aria-valuenow="player.hp"
          :aria-valuemin="0"
          :aria-valuemax="player.maxHp"
        >
          <div class="resource-meter-label">
            <span>HP</span>
            <strong>{{ player.hp }} / {{ player.maxHp }}</strong>
          </div>
          <div class="resource-track">
            <div class="resource-fill" :style="{ width: `${hpProgress}%` }"></div>
          </div>
        </div>
        <div
          class="resource-meter mana-meter"
          role="meter"
          :aria-label="`MP ${player.mp} trên ${player.maxMp}`"
          :aria-valuenow="player.mp"
          :aria-valuemin="0"
          :aria-valuemax="player.maxMp"
        >
          <div class="resource-meter-label">
            <span>MP</span>
            <strong>{{ player.mp }} / {{ player.maxMp }}</strong>
          </div>
          <div class="resource-track">
            <div class="resource-fill" :style="{ width: `${mpProgress}%` }"></div>
          </div>
        </div>
        <span>{{ player.autoState }}</span>
      </div>
    </section>

    <aside class="quest-tracker" aria-label="Theo dõi nhiệm vụ">
      <div class="quest-tracker-header">
        <strong>NHIỆM VỤ</strong>
        <RouterLink to="/inventory">Chi tiết</RouterLink>
      </div>
      <article v-for="quest in activeQuests" :key="quest.id" class="tracked-quest">
        <div class="tracked-quest-label">
          <span>{{ quest.title }}</span>
          <strong>{{ quest.progress }} / {{ quest.required }}</strong>
        </div>
        <div
          class="quest-progress-track"
          role="meter"
          :aria-label="`${quest.title}: ${quest.progress} trên ${quest.required}`"
          :aria-valuenow="quest.progress"
          :aria-valuemin="0"
          :aria-valuemax="quest.required"
        >
          <div
            class="quest-progress-fill"
            :class="{ complete: quest.progress >= quest.required }"
            :style="{ width: `${Math.min(100, quest.progress / quest.required * 100)}%` }"
          ></div>
        </div>
        <small v-if="quest.progress >= quest.required">Hoàn thành · nhận thưởng trong túi đồ</small>
      </article>
      <p v-if="activeQuests.length === 0" class="all-quests-complete">
        Đã nhận hết thưởng nhiệm vụ
      </p>
    </aside>

    <div v-if="player.lootMessage" class="loot-notice" role="status">
      {{ player.lootMessage }}
    </div>

    <div
      v-if="player.forgeOpen"
      class="forge-overlay"
      @click.self="player.closeForgePanel"
    >
      <section
        ref="forgeDialog"
        class="forge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forge-dialog-title"
        tabindex="-1"
        @click.stop
      >
        <header class="forge-dialog-header">
          <div>
            <span>THỢ RÈN · TÂN THỦ THÀNH</span>
            <h2 id="forge-dialog-title">Lò cường hóa</h2>
          </div>
          <button
            type="button"
            ref="forgeCloseButton"
            class="forge-close"
            aria-label="Đóng lò rèn"
            :disabled="player.forgeInProgress"
            @click="player.closeForgePanel"
          >×</button>
        </header>
        <p class="forge-gold">Vàng hiện có: {{ player.gold.toLocaleString('vi-VN') }}</p>
        <p class="forge-rates">
          +0 → +1: 90% · 1.000 vàng
          <br />
          +1 → +2: 70% · 2.000 vàng
          <br />
          +2 → +3: 50% · 3.000 vàng
        </p>
        <p v-if="!player.accountEmail" class="forge-login-note">
          Đăng nhập để dùng lò rèn.
          <RouterLink to="/settings" @click="player.closeForgePanel">Mở Cài đặt</RouterLink>
        </p>
        <div v-if="forgeWeapons.length" class="forge-weapons">
          <article v-for="weapon in forgeWeapons" :key="weapon.id" class="forge-weapon">
            <div class="forge-weapon-stats">
              <strong>{{ weapon.name }} +{{ weapon.enhanceLevel ?? 0 }}</strong>
              <span>ATK {{ 10 + (weapon.attackBonus ?? 0) }}</span>
            </div>
            <button
              type="button"
              :disabled="
                !player.accountEmail ||
                player.forgeInProgress ||
                (weapon.enhanceLevel ?? 0) >= 3 ||
                player.gold < enhancementCost(weapon.enhanceLevel ?? 0)
              "
              @click="enhanceFromForge(weapon.id)"
            >
              {{
                player.forgeInProgress
                  ? 'Đang xử lý…'
                  : (weapon.enhanceLevel ?? 0) >= 3
                    ? 'Đã đạt +3'
                    : player.gold < enhancementCost(weapon.enhanceLevel ?? 0)
                      ? 'Không đủ vàng'
                      : `Cường hóa · ${enhancementCost(weapon.enhanceLevel ?? 0).toLocaleString('vi-VN')} vàng`
              }}
            </button>
          </article>
        </div>
        <p v-else class="forge-empty">Bạn chưa có vũ khí trong túi đồ.</p>
        <p
          v-if="forgeFeedback"
          class="forge-result"
          :class="`forge-result-${forgeFeedbackState}`"
          role="status"
          aria-live="polite"
        >{{ forgeFeedback }}</p>
      </section>
    </div>

    <footer class="action-bar">
      <button
        class="auto-button"
        :class="{ enabled: player.autoBattle }"
        :aria-pressed="player.autoBattle"
        @click="toggleAuto"
      >
        {{ player.autoBattle ? 'TẮT AUTO' : 'BẬT AUTO' }}
      </button>
      <button
        class="attack-button"
        :disabled="
          player.autoBattle ||
          !player.currentTarget ||
          !player.currentTargetInRange ||
          player.attackCooldownRemaining > 0
        "
        @click="emitGameEvent('manual:attack')"
      >
        {{ player.attackCooldownRemaining > 0 ? `ĐÁNH · ${player.attackCooldownRemaining} GIÂY` : 'ĐÁNH MỤC TIÊU' }}
      </button>
      <button
        class="skill-button"
        :disabled="
          player.autoBattle ||
          !player.currentTarget ||
          !player.currentTargetInRange ||
          player.skillCooldownRemaining > 0 ||
          player.mp < 15
        "
        @click="emitGameEvent('manual:skill')"
      >
        {{
          player.skillCooldownRemaining > 0
            ? `KỸ NĂNG · ${player.skillCooldownRemaining} GIÂY`
            : player.mp < 15
              ? 'KỸ NĂNG · THIẾU MP'
              : 'KỸ NĂNG · Q · 15 MP'
        }}
      </button>
      <button
        class="potion-button"
        :disabled="!potionCount || player.hp <= 0 || player.hp >= player.maxHp"
        @click="useHealingPotion"
      >
        THUỐC · E · x{{ potionCount }}
      </button>
      <span class="control-hint">
        Di chuyển: WASD / phím mũi tên hoặc nút cảm ứng · Chọn quái: nhấp vào quái · Kỹ năng: Q · Hồi máu: E
      </span>
    </footer>
    <div class="touch-controls" aria-label="Điều khiển di chuyển">
      <button
        class="touch-up"
        aria-label="Di chuyển lên"
        :disabled="player.autoBattle || player.hp <= 0"
        @pointerdown.prevent="startTouchMovement($event, 'up')"
        @pointerup="stopTouchMovement($event, 'up')"
        @pointercancel="stopTouchMovement($event, 'up')"
        @lostpointercapture="stopTouchMovement($event, 'up')"
      >▲</button>
      <button
        class="touch-left"
        aria-label="Di chuyển sang trái"
        :disabled="player.autoBattle || player.hp <= 0"
        @pointerdown.prevent="startTouchMovement($event, 'left')"
        @pointerup="stopTouchMovement($event, 'left')"
        @pointercancel="stopTouchMovement($event, 'left')"
        @lostpointercapture="stopTouchMovement($event, 'left')"
      >◀</button>
      <button
        class="touch-right"
        aria-label="Di chuyển sang phải"
        :disabled="player.autoBattle || player.hp <= 0"
        @pointerdown.prevent="startTouchMovement($event, 'right')"
        @pointerup="stopTouchMovement($event, 'right')"
        @pointercancel="stopTouchMovement($event, 'right')"
        @lostpointercapture="stopTouchMovement($event, 'right')"
      >▶</button>
      <button
        class="touch-down"
        aria-label="Di chuyển xuống"
        :disabled="player.autoBattle || player.hp <= 0"
        @pointerdown.prevent="startTouchMovement($event, 'down')"
        @pointerup="stopTouchMovement($event, 'down')"
        @pointercancel="stopTouchMovement($event, 'down')"
        @lostpointercapture="stopTouchMovement($event, 'down')"
      >▼</button>
    </div>
    <div class="touch-action-controls" aria-label="Thao tác chiến đấu">
      <button
        class="auto-button"
        :class="{ enabled: player.autoBattle }"
        :aria-pressed="player.autoBattle"
        @click="toggleAuto"
      >
        {{ player.autoBattle ? 'TẮT AUTO' : 'BẬT AUTO' }}
      </button>
      <button
        class="attack-button"
        :disabled="
          player.autoBattle ||
          !player.currentTarget ||
          !player.currentTargetInRange ||
          player.attackCooldownRemaining > 0
        "
        @click="emitGameEvent('manual:attack')"
      >
        {{ attackButtonLabel }}
      </button>
      <button
        class="skill-button"
        :disabled="
          player.autoBattle ||
          !player.currentTarget ||
          !player.currentTargetInRange ||
          player.skillCooldownRemaining > 0 ||
          player.mp < 15
        "
        @click="emitGameEvent('manual:skill')"
      >
        {{ skillButtonLabel }}
      </button>
      <button
        class="potion-button"
        :disabled="!potionCount || player.hp <= 0 || player.hp >= player.maxHp"
        @click="useHealingPotion"
      >
        THUỐC · x{{ potionCount }}
      </button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player'
import { emitGameEvent, emitTouchMovement } from '../game/createGame'
import type { TouchDirection } from '../game/types'

const player = usePlayerStore()
const forgeFeedback = ref('')
const forgeFeedbackState = ref<'success' | 'failed' | 'error'>('success')
const forgeDialog = ref<HTMLElement | null>(null)
const forgeCloseButton = ref<HTMLButtonElement | null>(null)
const showAccountNotice = ref(false)
let accountNoticeTimer: ReturnType<typeof setTimeout> | undefined
let accountNoticeDelayTimer: ReturnType<typeof setTimeout> | undefined
let forgeOpener: HTMLElement | null = null
const activeQuests = computed(() => player.quests.filter(quest => !quest.claimed))
const forgeWeapons = computed(() =>
  player.inventory.filter(item => item.type === 'equipment' && item.slot === 'weapon')
)
watch(() => player.forgeOpen, isOpen => {
  if (isOpen) {
    forgeFeedback.value = ''
    forgeOpener = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    document.addEventListener('keydown', handleForgeDialogKeydown, true)
    void nextTick(() => {
      if (forgeCloseButton.value && !forgeCloseButton.value.disabled) {
        forgeCloseButton.value.focus()
      } else {
        forgeDialog.value?.focus()
      }
    })
    return
  }

  document.removeEventListener('keydown', handleForgeDialogKeydown, true)
  if (forgeOpener?.isConnected) forgeOpener.focus()
  forgeOpener = null
})
const handleForgeDialogKeydown = (event: KeyboardEvent) => {
  event.stopImmediatePropagation()
  if (event.key === 'Escape') {
    event.preventDefault()
    player.closeForgePanel()
    return
  }
  if (event.key !== 'Tab' || !forgeDialog.value) return

  const focusableElements = Array.from(forgeDialog.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(element => element.getAttribute('aria-hidden') !== 'true')

  if (focusableElements.length === 0) {
    event.preventDefault()
    forgeDialog.value.focus()
    return
  }

  const first = focusableElements[0]
  const last = focusableElements[focusableElements.length - 1]
  if (event.shiftKey && (document.activeElement === first || !forgeDialog.value.contains(document.activeElement))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (document.activeElement === last || !forgeDialog.value.contains(document.activeElement))) {
    event.preventDefault()
    first.focus()
  }
}
watch(
  [
    () => player.accountStatus,
    () => player.accountStatusType,
    () => player.authLoading,
    () => player.remoteSaveInProgress
  ],
  ([accountStatus, statusType, authLoading, remoteSaveInProgress]) => {
    clearTimeout(accountNoticeTimer)
    clearTimeout(accountNoticeDelayTimer)
    if (authLoading || (statusType === 'loading' && !remoteSaveInProgress)) {
      showAccountNotice.value = true
      return
    }

    if (remoteSaveInProgress) {
      accountNoticeDelayTimer = setTimeout(() => {
        showAccountNotice.value = true
      }, 350)
      return
    }

    if (statusType === 'success' && accountStatus.startsWith('Đã đồng bộ máy chủ')) {
      showAccountNotice.value = false
      return
    }

    showAccountNotice.value = statusType === 'success' || statusType === 'error'
    if (showAccountNotice.value) {
      accountNoticeTimer = setTimeout(() => {
        showAccountNotice.value = false
      }, 4000)
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  clearTimeout(accountNoticeTimer)
  clearTimeout(accountNoticeDelayTimer)
  document.removeEventListener('keydown', handleForgeDialogKeydown, true)
})
const expToNextLevel = computed(() => 100 * player.level * player.level)
const expProgress = computed(() => Math.min(100, player.exp / expToNextLevel.value * 100))
const hpProgress = computed(() => Math.min(100, player.hp / player.maxHp * 100))
const mpProgress = computed(() => Math.min(100, player.mp / player.maxMp * 100))
const targetHpProgress = computed(() => player.currentTargetMaxHp > 0
  ? Math.min(100, player.currentTargetHp / player.currentTargetMaxHp * 100)
  : 0)
const potionCount = computed(() => player.inventory
  .filter(item => item.type === 'consumable')
  .reduce((total, item) => total + item.quantity, 0))
const attackButtonLabel = computed(() => player.attackCooldownRemaining > 0
  ? `ĐÁNH · ${player.attackCooldownRemaining} GIÂY`
  : 'ĐÁNH MỤC TIÊU')
const skillButtonLabel = computed(() => {
  if (player.skillCooldownRemaining > 0) return `KỸ NĂNG · ${player.skillCooldownRemaining} GIÂY`
  if (player.mp < 15) return 'KỸ NĂNG · THIẾU MP'
  return 'KỸ NĂNG · Q · 15 MP'
})
const enhancementCost = (level: number) => [1000, 2000, 3000][level] ?? 0

const toggleAuto = () => {
  player.setAutoBattle(!player.autoBattle)
}

const useHealingPotion = () => {
  if (!player.useHealingPotion()) {
    player.autoMessage = 'Không có thuốc hồi phục hoặc HP đã đầy'
  }
}

const enhanceFromForge = async (itemId: string) => {
  const result = await player.enhanceWeapon(itemId)
  forgeFeedbackState.value = result
  forgeFeedback.value = player.autoMessage
}

const startTouchMovement = (event: PointerEvent, direction: TouchDirection) => {
  if (event.currentTarget instanceof HTMLButtonElement) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  emitTouchMovement(direction, true)
}

const stopTouchMovement = (_event: PointerEvent, direction: TouchDirection) => {
  emitTouchMovement(direction, false)
}
</script>

<style scoped>
.game-view {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  pointer-events: none;
}

.game-view :is(a, button, [tabindex]):focus-visible {
  outline: 3px solid #ffe28a;
  outline-offset: 3px;
  box-shadow: 0 0 0 2px #14243a;
}

.game-view button:disabled {
  cursor: not-allowed;
}

.session-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid rgba(94, 166, 255, 0.7);
  border-radius: 8px;
  background: rgba(32, 64, 86, 0.8);
  color: #dfeefb;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  pointer-events: auto;
}

.session-banner-loading {
  border-color: rgba(94, 166, 255, 0.7);
  background: rgba(32, 64, 86, 0.9);
  color: #dfeefb;
}

.session-banner-success {
  border-color: rgba(94, 188, 126, 0.8);
  background: rgba(30, 75, 52, 0.92);
  color: #dcf8e5;
}

.session-banner-error {
  border-color: rgba(225, 112, 99, 0.85);
  background: rgba(89, 42, 42, 0.94);
  color: #ffe2dd;
}

.session-banner-neutral {
  border-color: rgba(140, 153, 170, 0.7);
  background: rgba(48, 61, 77, 0.9);
  color: #d5dfe9;
}

.status-spinner {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: status-spin 0.8s linear infinite;
}

@keyframes status-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-spinner {
    animation: none;
  }
}

.top-hud,
.battle-panel,
.quest-tracker,
.action-bar {
  pointer-events: auto;
}

.touch-controls {
  display: none;
}

.touch-action-controls {
  display: none;
}

.top-hud {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 82px;
  padding: 12px clamp(14px, 3vw, 36px);
  background: linear-gradient(180deg, rgb(13 23 37 / 94%), rgb(13 23 37 / 72%));
  border-bottom: 1px solid rgb(233 205 145 / 24%);
  box-shadow: 0 8px 26px rgb(0 0 0 / 22%);
}

.character-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 154px;
}

.avatar {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  color: #ffe4ab;
  background: #654538;
  border: 2px solid #d5ad72;
  border-radius: 12px;
  font-size: 20px;
}

.character-card strong,
.character-card span {
  display: block;
}

.character-card span,
.progress-label {
  color: #c2c9d1;
  font-size: 12px;
}

.progress-card {
  width: min(230px, 24vw);
}

.progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.progress-track {
  height: 8px;
  overflow: hidden;
  background: #364251;
  border-radius: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #7a9ce2, #c0d5ff);
  transition: width 180ms ease;
}

.currency-card {
  color: #f0d48e;
  white-space: nowrap;
}

.game-nav {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.game-nav a,
.auto-button,
.attack-button,
.skill-button,
.potion-button {
  padding: 10px 14px;
  color: #f4ead5;
  text-decoration: none;
  background: #34445a;
  border: 1px solid rgb(231 212 176 / 28%);
  border-radius: 9px;
}

.game-nav a:hover,
.attack-button:not(:disabled):hover,
.skill-button:not(:disabled):hover,
.potion-button:not(:disabled):hover {
  background: #485d78;
}

.battle-panel {
  position: absolute;
  top: 100px;
  right: clamp(14px, 3vw, 36px);
  width: min(270px, calc(100vw - 28px));
  padding: 14px;
  background: rgb(15 27 42 / 88%);
  border: 1px solid rgb(231 212 176 / 26%);
  border-radius: 12px;
  box-shadow: 0 10px 28px rgb(0 0 0 / 22%);
}

.quest-tracker {
  position: absolute;
  top: 100px;
  left: clamp(14px, 3vw, 36px);
  width: min(250px, calc(100vw - 28px));
  padding: 13px;
  color: #f2ead8;
  background: rgb(15 27 42 / 88%);
  border: 1px solid rgb(231 212 176 / 26%);
  border-radius: 12px;
  box-shadow: 0 10px 28px rgb(0 0 0 / 22%);
}

.quest-tracker-header,
.tracked-quest-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.quest-tracker-header {
  margin-bottom: 12px;
  color: #e7d09f;
  font-size: 11px;
  letter-spacing: 0.06em;
}

.quest-tracker-header a {
  color: #c4d9f4;
  font-size: 11px;
  letter-spacing: normal;
  text-decoration: none;
}

.tracked-quest + .tracked-quest {
  margin-top: 12px;
}

.tracked-quest-label {
  margin-bottom: 5px;
  font-size: 12px;
}

.tracked-quest-label strong {
  flex: 0 0 auto;
  color: #c6d0dc;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.quest-progress-track {
  height: 7px;
  overflow: hidden;
  background: #364251;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 6px;
}

.quest-progress-fill {
  width: 0;
  height: 100%;
  background: linear-gradient(90deg, #ae8a4c, #e6ca78);
  border-radius: inherit;
  transition: width 180ms ease;
}

.quest-progress-fill.complete {
  background: linear-gradient(90deg, #398264, #81d8a1);
}

.tracked-quest small,
.all-quests-complete {
  display: block;
  margin: 5px 0 0;
  color: #a9d8b7;
  font-size: 10px;
}

.all-quests-complete {
  color: #b6c1ce;
}

.battle-heading,
.resource-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.battle-heading {
  font-size: 12px;
  letter-spacing: 0.06em;
}

.status-dot {
  width: 9px;
  height: 9px;
  background: #a4a9b0;
  border-radius: 50%;
}

.status-dot.active {
  background: #83dc8e;
  box-shadow: 0 0 10px rgb(131 220 142 / 70%);
}

.battle-panel p {
  margin: 10px 0;
  color: #d3dae2;
  font-size: 13px;
}

.target-line {
  margin-bottom: 10px;
  color: #e7d09f;
  font-size: 13px;
}

.target-range {
  margin: 0 0 6px;
  font-size: 11px;
}

.target-range.inRange {
  color: #a9d8b7;
}

.target-range.outOfRange {
  color: #f0ad8e;
}

.target-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 10px 0;
  color: #e7d09f;
  font-size: 13px;
}

.target-selector span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-selector button {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  color: #f4ead5;
  background: #34445a;
  border: 1px solid rgb(231 212 176 / 28%);
  border-radius: 8px;
}

.approach-button {
  width: 100%;
  margin: 0 0 10px;
  padding: 7px 10px;
  color: #e8f1fa;
  background: #3b5f7c;
  border: 1px solid #6f94b1;
  border-radius: 7px;
  font-size: 11px;
}

.approach-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.target-line small {
  display: block;
  margin-top: 4px;
  color: #c6d0dc;
  font-size: 11px;
  text-align: right;
}

.target-health-track {
  height: 7px;
  margin-top: 7px;
  overflow: hidden;
  background: #364251;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 6px;
}

.target-health-fill {
  width: 0;
  height: 100%;
  background: linear-gradient(90deg, #aa4747, #ed7770);
  border-radius: inherit;
  transition: width 180ms ease;
}

.resource-list {
  display: grid;
  gap: 9px;
}

.resource-meter-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  color: #c6d0dc;
  font-size: 11px;
}

.resource-meter-label strong {
  font-variant-numeric: tabular-nums;
}

.resource-track {
  height: 8px;
  overflow: hidden;
  background: #364251;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 6px;
}

.resource-fill {
  width: 0;
  height: 100%;
  border-radius: inherit;
  transition: width 180ms ease, background-color 180ms ease;
}

.health-meter .resource-fill {
  background: linear-gradient(90deg, #a94343, #ed7770);
}

.health-meter.critical .resource-fill {
  background: #ff554d;
  box-shadow: 0 0 10px rgb(255 85 77 / 70%);
  animation: critical-pulse 900ms ease-in-out infinite alternate;
}

.mana-meter .resource-fill {
  background: linear-gradient(90deg, #356caa, #68b7ed);
}

.resource-line {
  justify-content: space-between;
  color: #aeb9c6;
  font-size: 11px;
}

.resource-line > span {
  justify-self: end;
}

@keyframes critical-pulse {
  from { opacity: 0.72; }
  to { opacity: 1; }
}

.loot-notice {
  position: absolute;
  top: 100px;
  left: 50%;
  padding: 10px 16px;
  color: #ffe5a0;
  background: rgb(25 37 47 / 90%);
  border: 1px solid #c9a868;
  border-radius: 9px;
  transform: translateX(-50%);
}

.forge-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  padding: 18px;
  place-items: center;
  background: rgb(5 10 18 / 72%);
  pointer-events: auto;
}

.forge-dialog {
  width: min(460px, 100%);
  max-height: min(80vh, 640px);
  overflow: auto;
  padding: 20px;
  color: #f2ead8;
  background: linear-gradient(150deg, #293d54, #14243a 70%);
  border: 1px solid #c9a868;
  border-radius: 14px;
  box-shadow: 0 18px 56px rgb(0 0 0 / 55%);
  pointer-events: auto;
}

.forge-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.forge-dialog-header span {
  color: #e7d09f;
  font-size: 10px;
  letter-spacing: 0.1em;
}

.forge-dialog-header h2 {
  margin: 6px 0 0;
  font-size: 22px;
}

.forge-close {
  width: 36px;
  height: 36px;
  color: #f2ead8;
  background: #34445a;
  border: 1px solid rgb(231 212 176 / 35%);
  border-radius: 8px;
  font-size: 24px;
}

.forge-gold {
  margin: 18px 0 8px;
  color: #f0d48e;
  font-weight: 700;
}

.forge-rates,
.forge-login-note,
.forge-empty {
  color: #c6d0dc;
  font-size: 13px;
  line-height: 1.65;
}

.forge-login-note a {
  margin-left: 6px;
  color: #b6d6ff;
}

.forge-weapons {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.forge-weapon {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: rgb(8 18 30 / 48%);
  border: 1px solid rgb(231 212 176 / 20%);
  border-radius: 9px;
}

.forge-weapon-stats {
  display: grid;
  gap: 5px;
}

.forge-weapon-stats span {
  color: #c6d0dc;
  font-size: 12px;
}

.forge-weapon button {
  max-width: 190px;
  padding: 9px 11px;
  color: #fff0c4;
  background: #76552f;
  border: 1px solid #d5ad72;
  border-radius: 8px;
}

.forge-dialog button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.forge-result {
  margin: 16px 0 0;
  font-weight: 700;
}

.forge-result-success {
  color: #8de6a0;
}

.forge-result-failed,
.forge-result-error {
  color: #ff9a91;
}

.action-bar {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 190px));
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(0deg, rgb(13 23 37 / 94%), rgb(13 23 37 / 70%));
  border-top: 1px solid rgb(233 205 145 / 24%);
}

.action-bar .control-hint {
  grid-column: 1 / -1;
}

.auto-button {
  min-width: 130px;
  color: white;
  background: #8d4a3e;
  border-color: #c97862;
  font-weight: 700;
}

.auto-button.enabled {
  color: #e9ffe8;
  background: #35664b;
  border-color: #72b984;
}

.attack-button {
  min-width: 150px;
}

.skill-button {
  min-width: 145px;
  color: #fff0c4;
  background: #634b83;
  border: 1px solid #aa91d2;
  border-radius: 9px;
}

.potion-button {
  min-width: 130px;
  color: #ffe8dc;
  background: #8a5239;
  border: 1px solid #d08b61;
  border-radius: 9px;
}

.potion-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.skill-button:disabled,
.attack-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.control-hint {
  width: 100%;
  color: #aeb9c6;
  font-size: 11px;
  text-align: center;
}

@media (max-width: 700px) {
  .top-hud {
    gap: 10px;
    flex-wrap: wrap;
    padding:
      calc(10px + env(safe-area-inset-top))
      calc(12px + env(safe-area-inset-right))
      10px
      calc(12px + env(safe-area-inset-left));
  }

  .character-card {
    min-width: 120px;
  }

  .progress-card {
    order: 3;
    width: 100%;
  }

  .currency-card {
    font-size: 13px;
  }

  .battle-panel {
    top: 205px;
    right: calc(14px + env(safe-area-inset-right));
    width: min(240px, calc(50vw - 22px));
  }

  .quest-tracker {
    top: 205px;
    bottom: auto;
    left: calc(14px + env(safe-area-inset-left));
    width: min(240px, calc(50vw - 22px));
    padding: 10px;
  }

  .loot-notice {
    top: 205px;
    z-index: 4;
    max-width: calc(100vw - 32px);
    text-align: center;
  }

  .forge-overlay {
    padding:
      calc(12px + env(safe-area-inset-top))
      calc(12px + env(safe-area-inset-right))
      calc(12px + env(safe-area-inset-bottom))
      calc(12px + env(safe-area-inset-left));
  }

  .forge-dialog {
    max-height: 84vh;
    padding: 16px;
  }

  .forge-weapon {
    align-items: stretch;
    flex-direction: column;
  }

  .forge-weapon button {
    max-width: none;
    min-height: 44px;
  }

  .touch-controls {
    position: fixed;
    bottom: calc(12px + env(safe-area-inset-bottom));
    left: calc(14px + env(safe-area-inset-left));
    z-index: 3;
    display: grid;
    grid-template-areas:
      ". up ."
      "left . right"
      ". down .";
    grid-template-columns: repeat(3, 48px);
    grid-template-rows: repeat(3, 48px);
    gap: 4px;
    pointer-events: auto;
    touch-action: none;
    user-select: none;
  }

  .action-bar {
    display: none;
  }

  .touch-action-controls {
    position: fixed;
    right: calc(12px + env(safe-area-inset-right));
    bottom: calc(12px + env(safe-area-inset-bottom));
    z-index: 3;
    display: grid;
    width: 190px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    pointer-events: auto;
  }

  .touch-action-controls button {
    width: 100%;
    min-width: 0;
    min-height: 46px;
    margin: 0;
    padding: 6px 4px;
    font-size: 11px;
    touch-action: manipulation;
  }

  .control-hint {
    display: none;
  }

  .touch-controls button {
    display: grid;
    width: 48px;
    height: 48px;
    margin: 0;
    padding: 0;
    place-items: center;
    color: #f4ead5;
    background: rgb(37 55 76 / 88%);
    border: 1px solid rgb(231 212 176 / 50%);
    border-radius: 12px;
    box-shadow: 0 3px 8px rgb(0 0 0 / 35%);
    touch-action: none;
  }

  .touch-controls button:active:not(:disabled) {
    background: #52749b;
    transform: scale(0.94);
  }

  .touch-controls button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .touch-up {
    grid-area: up;
  }

  .touch-left {
    grid-area: left;
  }

  .touch-right {
    grid-area: right;
  }

  .touch-down {
    grid-area: down;
  }
}

@media (max-width: 380px) {
  .touch-controls {
    grid-template-columns: repeat(3, 42px);
    grid-template-rows: repeat(3, 42px);
  }

  .touch-controls button {
    width: 42px;
    height: 42px;
  }

  .touch-action-controls {
    width: 150px;
  }

  .touch-action-controls button {
    font-size: 10px;
  }
}
</style>
