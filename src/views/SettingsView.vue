<template>
  <div class="settings-view">
    <h2>Cài đặt Game</h2>
    <section class="account-panel">
      <h3>Tài khoản & đồng bộ</h3>
      <div
        class="account-banner"
        :class="`status-${playerStore.accountStatusType}`"
        role="status"
        aria-live="polite"
        :aria-busy="
          playerStore.authLoading ||
          playerStore.remoteSaveInProgress ||
          playerStore.accountStatusType === 'loading'
        "
      >
        <span
          v-if="
            playerStore.authLoading ||
            playerStore.remoteSaveInProgress ||
            playerStore.accountStatusType === 'loading'
          "
          class="status-spinner"
          aria-hidden="true"
        ></span>
        <span>{{ playerStore.accountStatus }}</span>
      </div>
      <template v-if="playerStore.accountEmail">
        <p>Đang dùng tài khoản {{ playerStore.accountEmail }}</p>
        <button class="cancel-button" :disabled="playerStore.authLoading" @click="playerStore.logout">
          {{ playerStore.authLoading ? 'Đang xử lý…' : 'Đăng xuất' }}
        </button>
      </template>
      <form v-else @submit.prevent="submitAccount">
        <label>
          Email
          <input
            v-model.trim="email"
            type="email"
            autocomplete="email"
            maxlength="254"
            required
            :disabled="playerStore.authLoading || submitting"
          />
        </label>
        <label>
          Mật khẩu
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            minlength="12"
            maxlength="128"
            required
            :disabled="playerStore.authLoading || submitting"
          />
          <small>Mật khẩu cần từ 12 ký tự.</small>
        </label>
        <div class="account-actions">
          <button type="submit" :disabled="playerStore.authLoading || submitting">
            {{ playerStore.authLoading || submitting ? 'Đang xử lý…' : 'Đăng nhập' }}
          </button>
          <button type="button" class="cancel-button" :disabled="playerStore.authLoading || submitting" @click="createAccount">
            Tạo tài khoản
          </button>
        </div>
      </form>
    </section>

    <div class="setting-item">
      <label>
        <input type="checkbox" v-model="autoBattle" />
        Bật Auto Battle
      </label>
    </div>
    <div class="setting-item">
      <label for="auto-potion-threshold">Tự dùng thuốc khi HP còn</label>
      <select id="auto-potion-threshold" v-model.number="autoPotionThreshold">
        <option :value="0.25">25% HP</option>
        <option :value="0.35">35% HP</option>
        <option :value="0.5">50% HP</option>
      </select>
      <small>Auto Battle sẽ dùng thuốc khi HP bằng hoặc thấp hơn ngưỡng này.</small>
    </div>
    <button @click="saveSettings">Lưu cài đặt</button>
    <p v-if="saved" role="status">Đã lưu cài đặt Auto Battle.</p>
    <p v-if="playerStore.settingsStatus" class="save-status" role="status">
      {{ playerStore.settingsStatus }}
    </p>
    <p class="save-status" role="status">{{ playerStore.saveStatus }}</p>
    <button class="reset-button" @click="showResetConfirm = true">Xóa tiến trình và chơi mới</button>
    <section v-if="showResetConfirm" class="reset-confirm" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
      <h3 id="reset-title">Xóa tiến trình?</h3>
      <p>Toàn bộ cấp độ, vật phẩm, trang bị và nhiệm vụ đã lưu trên thiết bị này sẽ bị xóa.</p>
      <div class="reset-actions">
        <button @click="confirmNewGame">Xóa và chơi mới</button>
        <button class="cancel-button" @click="showResetConfirm = false">Hủy</button>
      </div>
    </section>
    <RouterLink class="back-link" to="/">Quay lại game</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'

const playerStore = usePlayerStore()
const route = useRoute()
const router = useRouter()
const autoBattle = ref(playerStore.autoBattle)
const autoPotionThreshold = ref(playerStore.autoPotionThreshold)
const saved = ref(false)
const showResetConfirm = ref(false)
const email = ref('')
const password = ref('')
const submitting = ref(false)

const returnToRequestedRoute = async () => {
  const redirect = route.query.redirect
  if (
    playerStore.accountEmail &&
    typeof redirect === 'string' &&
    redirect.startsWith('/') &&
    !redirect.startsWith('//')
  ) {
    await router.replace(redirect)
  }
}

const submitAccount = async () => {
  submitting.value = true
  await playerStore.login(email.value, password.value)
  password.value = ''
  submitting.value = false
  await returnToRequestedRoute()
}

const createAccount = async () => {
  if (!email.value || password.value.length < 12) return
  submitting.value = true
  await playerStore.register(email.value, password.value)
  password.value = ''
  submitting.value = false
  await returnToRequestedRoute()
}

const saveSettings = () => {
  if (!playerStore.setAutoPotionThreshold(autoPotionThreshold.value)) {
    saved.value = false
    return
  }
  playerStore.setAutoBattle(autoBattle.value)
  playerStore.persistGame()
  saved.value = true
}

const confirmNewGame = () => {
  playerStore.startNewGame()
  autoBattle.value = false
  saved.value = false
  showResetConfirm.value = false
}
</script>

<style>
.settings-view {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding: 20px;
  max-width: 400px;
  margin: 0 auto;
  color: #f2ead8;
  background: rgb(20 36 58 / 94%);
}

.account-panel {
  padding: 14px;
  background: #24364d;
  border: 1px solid #53677c;
  border-radius: 9px;
}

.account-panel h3 {
  margin-top: 0;
}

.account-panel label {
  display: grid;
  gap: 6px;
  margin: 12px 0;
}

.account-panel input {
  width: 100%;
  padding: 10px;
  color: #172438;
  background: #f2ead8;
  border: 1px solid #738398;
  border-radius: 6px;
}

.account-panel small {
  color: #b6c1ce;
}

.account-actions {
  display: flex;
  gap: 10px;
}

.account-actions button {
  margin-top: 4px;
}

.cancel-button {
  background: #485d78;
}

.setting-item {
  margin: 15px 0;
}

.setting-item label {
  display: block;
  margin-bottom: 5px;
}

.setting-item input {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
}

button {
  width: 100%;
  padding: 10px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 10px;
}

button:hover {
  background: #36a46e;
}

.save-status {
  color: #b6c1ce;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.account-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 10px 0 14px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 7px;
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.status-loading {
  border-color: #6099c9;
  background: #233f58;
  color: #e2f2ff;
}

.status-success {
  border-color: #52966e;
  background: #203f34;
  color: #d8f6e2;
}

.status-error {
  border-color: #b9655b;
  background: #4a2d32;
  color: #ffe0dc;
}

.status-neutral {
  border-color: #657587;
  background: #303d4b;
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

.reset-button {
  background: #8d4a3e;
}

.reset-button:hover {
  background: #a75849;
}

.reset-confirm {
  position: fixed;
  inset: 50% auto auto 50%;
  z-index: 30;
  width: min(360px, calc(100vw - 32px));
  padding: 20px;
  background: #1b2b40;
  border: 1px solid #c97862;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgb(0 0 0 / 65%);
  transform: translate(-50%, -50%);
}

.reset-confirm h3 {
  margin-top: 0;
}

.reset-confirm p {
  color: #c4cfdb;
  line-height: 1.5;
}

.reset-actions {
  display: flex;
  gap: 10px;
}

.reset-actions .cancel-button {
  background: #485d78;
}

.back-link {
  display: block;
  margin-top: 20px;
  color: #c4d9f4;
  text-align: center;
}
</style>