<template>
  <div class="inventory-view">
    <header class="inventory-header">
      <div>
        <h1>Túi đồ</h1>
        <span>{{ playerStore.inventory.length }} / {{ INVENTORY_CAPACITY }} ô</span>
      </div>
      <RouterLink class="back-link" to="/">Quay lại game</RouterLink>
    </header>

    <section class="equipment-panel">
      <h2>Trang bị</h2>
      <div class="equipment-grid">
        <div v-for="slot in equipmentSlots" :key="slot.id" class="equipment-slot">
          <span>{{ slot.label }}</span>
          <strong>{{ playerStore.equipment[slot.id]?.name ?? 'Chưa trang bị' }}</strong>
          <small v-if="playerStore.equipment[slot.id]">
            +{{ equipmentBonus(slot.id) }} {{ slot.id === 'weapon' ? 'ATK' : 'DEF' }}
          </small>
          <button
            v-if="playerStore.equipment[slot.id]"
            :disabled="playerStore.inventory.length >= INVENTORY_CAPACITY"
            @click="playerStore.unequipItem(slot.id)"
          >
            {{ playerStore.inventory.length >= INVENTORY_CAPACITY ? 'Túi đồ đầy' : 'Tháo trang bị' }}
          </button>
        </div>
      </div>
      <p class="attack-stat">
        Sức tấn công: {{ playerStore.attackPower }} · Phòng thủ: {{ playerStore.defensePower }}
      </p>
    </section>

    <section class="inventory-panel">
      <h2>Vật phẩm</h2>
      <section class="forge-panel" aria-labelledby="forge-title">
        <h3 id="forge-title">Lò rèn</h3>
        <p>Chỉ cường hóa được vũ khí trong túi đồ. Thành công tăng ATK hiện tại 10%.</p>
        <p>Vàng hiện có: {{ playerStore.gold.toLocaleString('vi-VN') }}</p>
        <p>Tỷ lệ / phí: +0 → +1: 90% · 1.000 vàng; +1 → +2: 70% · 2.000 vàng; +2 → +3: 50% · 3.000 vàng.</p>
        <p v-if="!playerStore.accountEmail" class="forge-note">
          Đăng nhập trong Cài đặt để cường hóa bằng máy chủ.
        </p>
        <p v-if="forgeFeedback" class="forge-feedback" :class="`forge-${forgeResult}`" role="status">
          {{ forgeFeedback }}
        </p>
      </section>
      <div class="potion-shop">
        <div>
          <strong>Thuốc hồi phục</strong>
          <span>Hồi tối đa 50 HP · {{ HEALING_POTION_PRICE }} vàng</span>
        </div>
        <div class="potion-buy-actions">
          <button
            :disabled="!canBuyHealingPotion(1)"
            @click="playerStore.buyHealingPotion(1)"
          >
            {{ potionShopButtonLabel(1) }}
          </button>
          <button
            :disabled="!canBuyHealingPotion(5)"
            @click="playerStore.buyHealingPotion(5)"
          >
            {{ potionShopButtonLabel(5) }}
          </button>
        </div>
      </div>
      <div class="equipment-shop">
        <article v-for="slot in equipmentSlots" :key="slot.id" class="shop-item">
          <div>
            <strong>{{ EQUIPMENT_SHOP[slot.id].name }}</strong>
            <span>
              +{{ EQUIPMENT_SHOP[slot.id].bonus }} {{ slot.id === 'weapon' ? 'ATK' : 'DEF' }}
              · {{ EQUIPMENT_SHOP[slot.id].price }} vàng
            </span>
          </div>
          <button
            :disabled="!canBuyEquipment(slot.id)"
            @click="playerStore.buyEquipment(slot.id)"
          >
            {{ equipmentShopButtonLabel(slot.id) }}
          </button>
        </article>
      </div>
      <div v-if="playerStore.inventory.length === 0" class="empty">
        <p>Chưa có vật phẩm. Hãy đánh quái để nhận vật phẩm rơi.</p>
      </div>
      <div v-else class="inventory-grid">
        <article
          v-for="item in playerStore.inventory"
          :key="item.id"
          class="inventory-slot"
          :class="`rarity-${item.rarity}`"
        >
          <strong>{{ item.name }}</strong>
          <span>{{ item.rarity }} · x{{ item.quantity }}</span>
          <span v-if="item.type === 'equipment' && item.slot === 'weapon'">
            +{{ item.enhanceLevel ?? 0 }} · ATK {{ 10 + equipmentItemBonus(item) }}
          </span>
          <span v-else-if="item.type === 'equipment'">
            +{{ equipmentItemBonus(item) }} DEF
          </span>
          <button
            v-if="item.type === 'equipment' && item.slot === 'weapon'"
            :disabled="!playerStore.accountEmail || playerStore.forgeInProgress || (item.enhanceLevel ?? 0) >= 3 || playerStore.gold < enhancementCost(item)"
            @click="enhance(item.id)"
          >
            {{ playerStore.forgeInProgress ? 'Đang cường hóa…' : (item.enhanceLevel ?? 0) >= 3 ? 'Đã tối đa' : playerStore.gold < enhancementCost(item) ? 'Không đủ vàng' : 'Cường hóa' }}
          </button>
          <button v-if="item.type === 'equipment'" @click="playerStore.equipItem(item.id)">
            Trang bị
          </button>
          <button
            v-else-if="item.type === 'consumable'"
            :disabled="!canUseConsumable"
            @click="playerStore.useItem(item.id)"
          >
            {{ consumableButtonLabel(item.healAmount) }}
          </button>
          <button
            v-if="item.quantity > 1"
            class="sell-button"
            @click="playerStore.sellItem(item.id, 1)"
          >
            Bán 1 · {{ getItemSellPrice(item) }} vàng
          </button>
          <button class="sell-button" @click="playerStore.sellItem(item.id)">
            {{ item.quantity > 1 ? 'Bán tất cả' : 'Bán' }}
            · {{ getItemSellPrice(item) * item.quantity }} vàng
          </button>
        </article>
      </div>
      <p class="inventory-feedback" role="status">{{ playerStore.autoMessage }}</p>
    </section>

    <section class="quest-panel">
      <h2>Nhiệm vụ</h2>
      <article v-for="quest in playerStore.quests" :key="quest.id" class="quest-card">
        <div>
          <strong>{{ quest.title }}</strong>
          <p>{{ quest.description }}</p>
          <small>
            Tiến độ: {{ quest.progress }} / {{ quest.required }} · Thưởng:
            {{ quest.rewardExp }} EXP, {{ quest.rewardGold }} vàng
          </small>
        </div>
        <button
          :disabled="quest.claimed || quest.progress < quest.required"
          @click="playerStore.claimQuest(quest.id)"
        >
          {{ quest.claimed ? 'Đã nhận' : quest.progress >= quest.required ? 'Nhận thưởng' : 'Chưa hoàn thành' }}
        </button>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getItemSellPrice,
  EQUIPMENT_SHOP,
  HEALING_POTION_PRICE,
  INVENTORY_CAPACITY,
  usePlayerStore
} from '../stores/player'
import type { EquipmentSlot, InventoryItem } from '../stores/player'

const playerStore = usePlayerStore()
const forgeFeedback = ref('')
const forgeResult = ref<'success' | 'failed' | 'error'>('success')
const canUseConsumable = computed(() => playerStore.hp > 0 && playerStore.hp < playerStore.maxHp)
const canBuyHealingPotion = (quantity: number) => {
  const potionStack = playerStore.inventory.find(
    item => item.type === 'consumable' && item.name === 'Thuốc hồi phục'
  )
  const hasRoom = potionStack
    ? potionStack.quantity + quantity <= 999
    : playerStore.inventory.length < INVENTORY_CAPACITY
  return playerStore.gold >= HEALING_POTION_PRICE * quantity && hasRoom
}
const potionShopButtonLabel = (quantity: number) => {
  if (playerStore.gold < HEALING_POTION_PRICE * quantity) return 'Không đủ vàng'
  if (!canBuyHealingPotion(quantity)) return 'Túi / chồng đầy'
  return `Mua x${quantity}`
}
const canBuyEquipment = (slot: EquipmentSlot) =>
  playerStore.gold >= EQUIPMENT_SHOP[slot].price &&
  playerStore.inventory.length < INVENTORY_CAPACITY
const equipmentShopButtonLabel = (slot: EquipmentSlot) => {
  if (playerStore.gold < EQUIPMENT_SHOP[slot].price) return 'Không đủ vàng'
  if (playerStore.inventory.length >= INVENTORY_CAPACITY) return 'Túi đồ đầy'
  return 'Mua'
}
const equipmentSlots: { id: EquipmentSlot; label: string }[] = [
  { id: 'weapon', label: 'Vũ khí' },
  { id: 'armor', label: 'Giáp' }
]
const equipmentBonus = (slot: EquipmentSlot) => {
  const item = playerStore.equipment[slot]
  return slot === 'weapon' ? item?.attackBonus ?? 0 : item?.defenseBonus ?? item?.attackBonus ?? 0
}
const equipmentItemBonus = (item: Pick<InventoryItem, 'slot' | 'attackBonus' | 'defenseBonus'>) =>
  item.slot === 'weapon' ? item.attackBonus ?? 0 : item.defenseBonus ?? item.attackBonus ?? 0
const enhancementCost = (item: InventoryItem) => [1000, 2000, 3000][item.enhanceLevel ?? 0] ?? 0
const consumableButtonLabel = (healAmount?: number) => {
  if (playerStore.hp <= 0) return 'Không thể dùng khi gục'
  if (playerStore.hp >= playerStore.maxHp) return 'HP đã đầy'
  return `Dùng · hồi ${healAmount ?? 0} HP`
}
const enhance = async (itemId: string) => {
  forgeResult.value = await playerStore.enhanceWeapon(itemId)
  forgeFeedback.value = playerStore.autoMessage
}
</script>

<style>
.inventory-view {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding: 20px;
  width: min(760px, 100%);
  margin: 0 auto;
  color: #f2ead8;
  background: rgb(20 36 58 / 94%);
}

.inventory-header,
.quest-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.inventory-header h1 {
  margin: 0 0 4px;
}

.inventory-header span,
.equipment-slot span,
.inventory-slot span,
.inventory-slot small,
.quest-card small {
  color: #b6c1ce;
  font-size: 12px;
}

.equipment-panel,
.forge-panel,
.inventory-panel,
.quest-panel {
  margin-top: 24px;
}

.equipment-panel h2,
.forge-panel h3,
.inventory-panel h2,
.quest-panel h2 {
  margin-bottom: 12px;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.equipment-slot,
.quest-card,
.potion-shop {
  padding: 14px;
  background: #24364d;
  border: 1px solid #53677c;
  border-radius: 9px;
}

.equipment-shop {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
}

.shop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: #1d3046;
  border: 1px solid #53677c;
  border-radius: 8px;
}

.shop-item span {
  display: block;
  margin-top: 6px;
  color: #b6c1ce;
  font-size: 12px;
}

.forge-panel p {
  margin: 8px 0;
  color: #d3deeb;
}

.forge-note,
.forge-error,
.forge-failed {
  color: #ff9a91 !important;
}

.forge-success {
  color: #8de6a0 !important;
}

.shop-item button {
  width: auto;
  min-width: 120px;
}

.shop-item button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.equipment-slot span,
.equipment-slot strong,
.equipment-slot small {
  display: block;
}

.equipment-slot strong {
  margin: 8px 0 4px;
}

.attack-stat {
  color: #f0d48e;
  font-weight: 700;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #b6c1ce;
}

.inventory-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.inventory-slot {
  display: flex;
  min-width: 145px;
  flex: 1 1 145px;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  color: #f2ead8;
  background: #24364d;
  border: 1px solid #53677c;
  border-radius: 8px;
}

.rarity-Tốt {
  border-color: #69b78a;
}

.rarity-Hiếm {
  border-color: #9c83d9;
}

.inventory-slot button,
.equipment-slot button,
.potion-shop button,
.quest-card button {
  padding: 8px 10px;
  color: white;
  background: #426d98;
  border: 0;
  border-radius: 6px;
}

.inventory-slot button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.potion-shop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.potion-shop span {
  display: block;
  margin-top: 6px;
  color: #b6c1ce;
  font-size: 12px;
}

.potion-shop button {
  width: auto;
  min-width: 120px;
}

.potion-buy-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.potion-buy-actions button {
  margin-top: 0;
}

.potion-shop button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.inventory-slot .sell-button {
  background: #8d6a35;
}

.inventory-slot .sell-button:hover {
  background: #a77c3e;
}

.equipment-slot button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.inventory-feedback {
  min-height: 1.2em;
  color: #f0d48e;
}

.quest-card {
  margin: 10px 0;
}

.quest-card p {
  margin: 6px 0;
}

.quest-card button {
  min-width: 108px;
}

.back-link {
  padding: 10px 14px;
  color: #e5eef7;
  background: #34445a;
  border: 1px solid #53677c;
  border-radius: 7px;
  text-decoration: none;
  white-space: nowrap;
}

.back-link:hover {
  background: #485d78;
}

@media (max-width: 520px) {
  .inventory-header,
  .quest-card {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>