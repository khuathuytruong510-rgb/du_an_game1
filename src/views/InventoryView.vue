<template>
  <div class="inventory-view" :class="{ 'skills-mode': activeInventoryTab !== 'items' }">
      <header v-if="activeInventoryTab === 'items'" class="inventory-header">
      <div>
        <h1>Túi đồ</h1>
        <span>{{ playerStore.inventory.length }} / {{ INVENTORY_CAPACITY }} ô</span>
      </div>
        <div class="inventory-header-actions">
          <RouterLink class="skill-link" :to="{ path: '/inventory', query: { tab: 'skills' } }">Kỹ năng</RouterLink>
          <RouterLink class="back-link" to="/">Quay lại game</RouterLink>
        </div>
    </header>

    <main v-else-if="activeInventoryTab === 'skills'" class="skill-screen">
      <header class="skill-player-bar">
        <div class="skill-player">
          <img
            :src="playerStore.playerAvatar === 'hero-scout' ? '/assets/hero-scout.svg' : '/assets/hero-mushroom.svg'"
            :alt="playerStore.playerName"
          />
          <div>
            <strong>{{ playerStore.playerName }}</strong>
            <span>Cấp {{ playerStore.level }} · ATK {{ playerStore.attackPower }}</span>
          </div>
        </div>
        <strong class="skill-gold">🪙 {{ playerStore.gold.toLocaleString('vi-VN') }}</strong>
        <RouterLink class="skill-exit" to="/" aria-label="Quay lại game">×</RouterLink>
      </header>

      <div class="skill-ribbon"><span>✦</span><h1>Kỹ năng</h1><span>✦</span></div>

      <section class="skill-loadout" aria-label="Kỹ năng đang sử dụng">
        <div class="skill-loadout-heading">
          <button type="button" class="skill-preset" @click="skillMessage = 'Bộ kỹ năng chiến đấu'">
            Bộ kỹ năng <span>⌄</span>
          </button>
          <span>ĐANG DÙNG</span>
        </div>
        <div class="equipped-skills">
          <button
            v-for="(skill, index) in equippedSkills"
            :key="`equipped-${index}`"
            type="button"
            class="equipped-skill"
            :class="{ empty: !skill, selected: skill && selectedSkillId === skill.id }"
            :aria-label="skill ? `${skill.name}, cấp ${skill.level}` : 'Ô kỹ năng trống'"
            @click="skill && (selectedSkillId = skill.id)"
          >
            <template v-if="skill">
              <img :src="skill.icon" alt="" />
              <strong>Lv.{{ skill.level }}</strong>
            </template>
            <span v-else>＋</span>
          </button>
        </div>
      </section>

      <div class="skill-bonus">
        <strong>TỔNG HIỆU QUẢ:</strong>
        <span>ATK {{ playerStore.attackPower }} · DEF {{ playerStore.defensePower }} · HP {{ playerStore.maxHp }}</span>
      </div>

      <section class="skill-library" aria-label="Danh sách kỹ năng">
        <button
          v-for="skill in skills"
          :key="skill.id"
          type="button"
          class="skill-card"
          :class="[
            `rarity-${skill.rarity}`,
            { locked: !skill.owned, equipped: equippedSkillIds.includes(skill.id), selected: selectedSkillId === skill.id }
          ]"
          :aria-label="`${skill.name}, ${skill.owned ? `cấp ${skill.level}` : 'chưa mở khóa'}`"
          :aria-pressed="selectedSkillId === skill.id"
          @click="selectSkill(skill)"
        >
          <img :src="skill.icon" alt="" />
          <strong v-if="skill.owned">Lv.{{ skill.level }}</strong>
          <span v-if="equippedSkillIds.includes(skill.id)" class="skill-equipped-mark">✓</span>
          <span v-else-if="!skill.owned" class="skill-lock" aria-hidden="true">♟</span>
          <small v-if="skill.owned">{{ skill.progress }}</small>
        </button>
      </section>

      <div class="skill-actions">
        <button type="button" class="skill-action equip-action" @click="equipFirstSkills">Trang bị nhanh</button>
        <button
          type="button"
          class="skill-action upgrade-action"
          :disabled="!selectedSkill?.owned"
          @click="showSkillUpgrade"
        >
          Nâng kỹ năng
        </button>
      </div>
      <p class="skill-feedback" role="status" aria-live="polite">{{ skillMessage }}</p>

      <nav class="skill-category-tabs" aria-label="Danh mục nhân vật">
        <button type="button" @click="setInventoryTab('items')">Trang bị</button>
        <button type="button" class="active" aria-current="page">Kỹ năng</button>
      </nav>
      <nav class="skill-bottom-nav" aria-label="Điều hướng game">
        <button type="button" @click="router.push('/')">
          <span class="shortcut-icon exit-shortcut">×</span><strong>Thoát</strong>
        </button>
        <button type="button" @click="setInventoryTab('companions')">
          <span class="shortcut-icon"><img src="/assets/supplied/mushroom-companion.png" alt="" /></span><strong>Đồng Hành</strong>
        </button>
        <button type="button" @click="skillMessage = 'Phó bản chưa khả dụng trong bản thử nghiệm.'">
          <span class="shortcut-icon"><img src="/assets/item-sword.svg" alt="" /></span><strong>Phó Bản</strong>
        </button>
        <button type="button" @click="skillMessage = 'Gia viên chưa khả dụng trong bản thử nghiệm.'">
          <span class="shortcut-icon"><img src="/assets/supplied/mount-ice-dragon.png" alt="" /></span><strong>Gia Viên</strong>
        </button>
        <button type="button" @click="skillMessage = 'Gia tộc chưa khả dụng trong bản thử nghiệm.'">
          <span class="shortcut-icon"><img src="/assets/item-ring.svg" alt="" /></span><strong>Gia Tộc</strong>
        </button>
        <button type="button" @click="setInventoryTab('items')">
          <span class="shortcut-icon"><img src="/assets/boss-tiger.svg" alt="" /></span><strong>Tiệm</strong>
        </button>
      </nav>
    </main>

    <main v-else class="skill-screen companion-screen">
      <header class="skill-player-bar">
        <div class="skill-player">
          <img
            :src="playerStore.playerAvatar === 'hero-scout' ? '/assets/hero-scout.svg' : '/assets/hero-mushroom.svg'"
            :alt="playerStore.playerName"
          />
          <div>
            <strong>{{ playerStore.playerName }}</strong>
            <span>Cấp {{ playerStore.level }} · ATK {{ playerStore.attackPower }}</span>
          </div>
        </div>
        <strong class="skill-gold">🪙 {{ playerStore.gold.toLocaleString('vi-VN') }}</strong>
        <RouterLink class="skill-exit" to="/" aria-label="Quay lại game">×</RouterLink>
      </header>

      <div class="skill-ribbon"><span>✦</span><h1>Đồng hành</h1><span>✦</span></div>

      <section class="skill-loadout" aria-label="Đồng hành đang sử dụng">
        <div class="skill-loadout-heading">
          <button type="button" class="skill-preset" @click="companionMessage = 'Đội hình đồng hành hiện tại'">
            Đội hình một <span>⌄</span>
          </button>
          <span>ĐANG DÙNG</span>
        </div>
        <div class="equipped-skills">
          <button
            v-for="(companion, index) in equippedCompanions"
            :key="`equipped-companion-${index}`"
            type="button"
            class="equipped-skill companion-slot"
            :class="{ empty: !companion, selected: companion && selectedCompanionId === companion.id, locked: !companion && index === 4 }"
            :aria-label="companion ? `${companion.name}, cấp ${companion.level}` : index === 4 ? 'Ô đồng hành bị khóa' : 'Ô đồng hành trống'"
            @click="companion && (selectedCompanionId = companion.id)"
          >
            <template v-if="companion">
              <img :src="companion.icon" alt="" />
              <strong>Lv.{{ companion.level }}</strong>
            </template>
            <span v-else-if="index === 4" class="skill-lock" aria-hidden="true">♟</span>
            <span v-else>＋</span>
          </button>
        </div>
      </section>

      <div class="skill-bonus">
        <strong>TỔNG HIỆU QUẢ:</strong>
        <span>ATK {{ playerStore.attackPower }} · DEF {{ playerStore.defensePower }} · HP {{ playerStore.maxHp }}</span>
      </div>

      <section class="skill-library companion-library" aria-label="Bộ sưu tập đồng hành">
        <button
          v-for="companion in companions"
          :key="companion.id"
          type="button"
          class="skill-card companion-card"
          :class="[
            `rarity-${companion.rarity}`,
            { locked: !companion.owned, equipped: equippedCompanionIds.includes(companion.id), selected: selectedCompanionId === companion.id }
          ]"
          :aria-label="`${companion.name}, ${companion.owned ? `cấp ${companion.level}` : 'chưa mở khóa'}`"
          :aria-pressed="selectedCompanionId === companion.id"
          @click="toggleCompanion(companion)"
        >
          <img :src="companion.icon" alt="" />
          <strong v-if="companion.owned">Lv.{{ companion.level }}</strong>
          <span v-if="equippedCompanionIds.includes(companion.id)" class="skill-equipped-mark">✓</span>
          <span v-else-if="!companion.owned" class="skill-lock" aria-hidden="true">♟</span>
          <span v-else class="companion-add-mark">＋</span>
          <small v-if="companion.owned">{{ companion.progress }}</small>
        </button>
      </section>

      <div class="skill-actions">
        <button type="button" class="skill-action equip-action" @click="equipFirstCompanions">Đội hình nhanh</button>
        <button type="button" class="skill-action upgrade-action" @click="showCompanionUpgrade">Nâng cấp nhanh</button>
      </div>
      <p class="skill-feedback" role="status" aria-live="polite">{{ companionMessage }}</p>

      <nav class="skill-bottom-nav" aria-label="Điều hướng game">
        <button type="button" @click="router.push('/')">
          <span class="shortcut-icon exit-shortcut">×</span><strong>Đóng</strong>
        </button>
        <button type="button" class="active" aria-current="page">
          <span class="shortcut-icon"><img src="/assets/supplied/mushroom-companion.png" alt="" /></span><strong>Đồng Hành</strong>
        </button>
        <button type="button" @click="companionMessage = 'Phó bản chưa khả dụng trong bản thử nghiệm.'">
          <span class="shortcut-icon"><img src="/assets/item-sword.svg" alt="" /></span><strong>Phó Bản</strong>
        </button>
        <button type="button" @click="companionMessage = 'Gia viên chưa khả dụng trong bản thử nghiệm.'">
          <span class="shortcut-icon"><img src="/assets/supplied/mount-ice-dragon.png" alt="" /></span><strong>Gia Viên</strong>
        </button>
        <button type="button" @click="companionMessage = 'Gia tộc chưa khả dụng trong bản thử nghiệm.'">
          <span class="shortcut-icon"><img src="/assets/item-ring.svg" alt="" /></span><strong>Gia Tộc</strong>
        </button>
        <button type="button" @click="setInventoryTab('items')">
          <span class="shortcut-icon"><img src="/assets/boss-tiger.svg" alt="" /></span><strong>Tiệm</strong>
        </button>
      </nav>
    </main>

    <template v-if="activeInventoryTab === 'items'">
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
        ATK {{ playerStore.attackPower }} · DEF {{ playerStore.defensePower }} ·
        HP {{ playerStore.maxHp }} · MP {{ playerStore.maxMp }} ·
        Tốc đánh {{ playerStore.attackSpeed }} ·
        Chí mạng {{ Math.round(playerStore.criticalChance * 100) }}% ·
        Né tránh {{ Math.round(playerStore.dodgeChance * 100) }}%
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
          <img
            v-if="item.type === 'equipment'"
            class="inventory-item-image"
            :src="equipmentItemSprite(item)"
            :alt="item.name"
          />
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  EQUIPMENT_SLOTS,
  getItemSellPrice,
  EQUIPMENT_SHOP,
  HEALING_POTION_PRICE,
  INVENTORY_CAPACITY,
  usePlayerStore
} from '../stores/player'
import type { EquipmentSlot, InventoryItem } from '../stores/player'

const playerStore = usePlayerStore()
const route = useRoute()
const router = useRouter()
const forgeFeedback = ref('')
const forgeResult = ref<'success' | 'failed' | 'error'>('success')
const activeInventoryTab = computed(() => {
  if (route.query.tab === 'skills') return 'skills'
  if (route.query.tab === 'companions') return 'companions'
  return 'items'
})
const setInventoryTab = (tab: 'items' | 'skills' | 'companions') => {
  void router.replace({ query: { ...route.query, tab: tab === 'items' ? undefined : tab } })
}
type Skill = {
  id: string
  name: string
  icon: string
  level: number
  rarity: 'purple' | 'blue' | 'green'
  progress: string
  owned: boolean
}
const skills: Skill[] = [
  { id: 'blade-wave', name: 'Bão kiếm', icon: '/assets/effect-slash.svg', level: 20, rarity: 'purple', progress: '19/18', owned: true },
  { id: 'ice-guard', name: 'Khiên băng', icon: '/assets/item-helmet.svg', level: 20, rarity: 'blue', progress: '10/18', owned: true },
  { id: 'thorn-shot', name: 'Gai xanh', icon: '/assets/item-shard.svg', level: 19, rarity: 'purple', progress: '2/18', owned: true },
  { id: 'arcane-orb', name: 'Cầu ma pháp', icon: '/assets/effect-hit.svg', level: 13, rarity: 'green', progress: '6/15', owned: true },
  { id: 'shadow-step', name: 'Ảnh bộ', icon: '/assets/item-boots.svg', level: 12, rarity: 'green', progress: '16/15', owned: true },
  { id: 'mushroom-bomb', name: 'Nấm bùng nổ', icon: '/assets/hero-mushroom.svg', level: 13, rarity: 'green', progress: '15/15', owned: true },
  { id: 'moon-blade', name: 'Nguyệt trảm', icon: '/assets/item-sword.svg', level: 9, rarity: 'blue', progress: '7/15', owned: true },
  { id: 'sun-flare', name: 'Thái dương', icon: '/assets/effect-hit.svg', level: 8, rarity: 'blue', progress: '6/13', owned: true },
  { id: 'spirit-chain', name: 'Linh liên', icon: '/assets/item-necklace.svg', level: 8, rarity: 'purple', progress: '5/13', owned: true },
  { id: 'earth-wall', name: 'Thổ thuẫn', icon: '/assets/item-armor.svg', level: 6, rarity: 'purple', progress: '6/9', owned: true },
  { id: 'petal-storm', name: 'Hoa vũ', icon: '/assets/item-ring.svg', level: 3, rarity: 'blue', progress: '1/4', owned: true },
  { id: 'wind-dash', name: 'Phong hành', icon: '/assets/item-boots.svg', level: 3, rarity: 'purple', progress: '3/4', owned: true },
  { id: 'dragon-roar', name: 'Long ngâm', icon: '/assets/boss-tiger.svg', level: 0, rarity: 'green', progress: '0/1', owned: false },
  { id: 'star-fall', name: 'Tinh lạc', icon: '/assets/effect-hit.svg', level: 0, rarity: 'green', progress: '0/1', owned: false },
  { id: 'spirit-bloom', name: 'Linh hoa', icon: '/assets/item-shard.svg', level: 0, rarity: 'green', progress: '0/1', owned: false },
  { id: 'stone-fist', name: 'Thạch quyền', icon: '/assets/item-gloves.svg', level: 0, rarity: 'green', progress: '0/1', owned: false },
  { id: 'soul-link', name: 'Hồn liên', icon: '/assets/item-ring.svg', level: 0, rarity: 'purple', progress: '0/1', owned: false },
  { id: 'frost-lance', name: 'Băng thương', icon: '/assets/item-sword.svg', level: 0, rarity: 'blue', progress: '0/1', owned: false },
  { id: 'healing-light', name: 'Hồi quang', icon: '/assets/item-potion.svg', level: 0, rarity: 'green', progress: '0/1', owned: false },
  { id: 'wild-charge', name: 'Cuồng xung', icon: '/assets/wolf.svg', level: 0, rarity: 'purple', progress: '0/1', owned: false }
]
const equippedSkillIds = ref(['blade-wave', 'ice-guard', 'thorn-shot', 'arcane-orb', 'shadow-step'])
const selectedSkillId = ref('blade-wave')
const skillMessage = ref('')
const equippedSkills = computed(() =>
  Array.from({ length: 5 }, (_, index) =>
    skills.find(skill => skill.id === equippedSkillIds.value[index]) ?? null
  )
)
const selectedSkill = computed(() => skills.find(skill => skill.id === selectedSkillId.value) ?? null)
const selectSkill = (skill: Skill) => {
  if (!skill.owned) {
    skillMessage.value = `${skill.name} chưa được mở khóa.`
    return
  }
  selectedSkillId.value = skill.id
  skillMessage.value = `${skill.name} · Cấp ${skill.level}${equippedSkillIds.value.includes(skill.id) ? ' · Đang trang bị' : ''}`
}
const equipFirstSkills = () => {
  equippedSkillIds.value = skills.filter(skill => skill.owned).slice(0, 5).map(skill => skill.id)
  skillMessage.value = 'Đã trang bị nhanh 5 kỹ năng khả dụng.'
}
const showSkillUpgrade = () => {
  skillMessage.value = selectedSkill.value
    ? `Đã chọn ${selectedSkill.value.name}. Nâng cấp kỹ năng chưa khả dụng trong bản thử nghiệm.`
    : 'Hãy chọn một kỹ năng đã mở khóa.'
}
type Companion = {
  id: string
  name: string
  icon: string
  level: number
  rarity: Skill['rarity']
  progress: string
  owned: boolean
}
const companions: Companion[] = [
  { id: 'mushroom', name: 'Nấm hộ vệ', icon: '/assets/supplied/mushroom-companion.png', level: 16, rarity: 'purple', progress: '19/15', owned: true },
  { id: 'ember-fox', name: 'Hỏa hồ', icon: '/assets/goblin.svg', level: 16, rarity: 'blue', progress: '10/15', owned: true },
  { id: 'shell-turtle', name: 'Rùa đá', icon: '/assets/slime.svg', level: 15, rarity: 'purple', progress: '8/15', owned: true },
  { id: 'pink-slime', name: 'Slime hồng', icon: '/assets/item-potion.svg', level: 10, rarity: 'green', progress: '4/15', owned: true },
  { id: 'panda', name: 'Gấu trúc', icon: '/assets/supplied/mushroom-companion.png', level: 10, rarity: 'green', progress: '3/15', owned: true },
  { id: 'forest-cat', name: 'Mèo rừng', icon: '/assets/wolf.svg', level: 9, rarity: 'green', progress: '8/15', owned: true },
  { id: 'snow-cat', name: 'Miêu tuyết', icon: '/assets/hero-scout.svg', level: 3, rarity: 'blue', progress: '3/4', owned: true },
  { id: 'little-mushroom', name: 'Nấm con', icon: '/assets/hero-mushroom.svg', level: 4, rarity: 'green', progress: '3/5', owned: true },
  { id: 'green-drake', name: 'Tiểu long', icon: '/assets/supplied/mount-ice-dragon.png', level: 4, rarity: 'blue', progress: '0/5', owned: true },
  { id: 'red-scout', name: 'Thám báo', icon: '/assets/hero-scout.svg', level: 3, rarity: 'blue', progress: '1/4', owned: true },
  { id: 'pink-pig', name: 'Heo hồng', icon: '/assets/supplied/mushroom-companion.png', level: 4, rarity: 'blue', progress: '0/5', owned: true },
  { id: 'leaf-frog', name: 'Ếch lá', icon: '/assets/supplied/mount-mechanical-frog.png', level: 4, rarity: 'blue', progress: '0/5', owned: true },
  { id: 'golden-bird', name: 'Kim điểu', icon: '/assets/boss-tiger.svg', level: 4, rarity: 'blue', progress: '1/4', owned: true },
  { id: 'night-cat', name: 'Mèo đêm', icon: '/assets/item-ring.svg', level: 1, rarity: 'purple', progress: '1/2', owned: true },
  { id: 'river-spirit', name: 'Thủy linh', icon: '/assets/item-shard.svg', level: 7, rarity: 'purple', progress: '1/2', owned: true },
  { id: 'tiny-wolf', name: 'Sói con', icon: '/assets/wolf.svg', level: 1, rarity: 'purple', progress: '1/2', owned: true },
  { id: 'storm-eagle', name: 'Ưng bão', icon: '/assets/boss-tiger.svg', level: 0, rarity: 'blue', progress: '0/1', owned: false },
  { id: 'moon-rabbit', name: 'Thỏ nguyệt', icon: '/assets/item-shard.svg', level: 0, rarity: 'purple', progress: '0/1', owned: false },
  { id: 'crystal-drake', name: 'Long tinh thể', icon: '/assets/supplied/mount-ice-dragon.png', level: 0, rarity: 'blue', progress: '0/1', owned: false },
  { id: 'ancient-guardian', name: 'Cổ thú hộ vệ', icon: '/assets/boss-tiger.svg', level: 0, rarity: 'green', progress: '0/1', owned: false }
]
const equippedCompanionIds = ref(['mushroom', 'ember-fox', 'shell-turtle', 'pink-slime'])
const selectedCompanionId = ref('mushroom')
const companionMessage = ref('Bộ sưu tập minh họa; chưa lưu tiến trình.')
const equippedCompanions = computed(() =>
  Array.from({ length: 5 }, (_, index) =>
    companions.find(companion => companion.id === equippedCompanionIds.value[index]) ?? null
  )
)
const toggleCompanion = (companion: Companion) => {
  if (!companion.owned) {
    companionMessage.value = `${companion.name} chưa được mở khóa.`
    return
  }
  selectedCompanionId.value = companion.id
  const isEquipped = equippedCompanionIds.value.includes(companion.id)
  if (isEquipped) {
    equippedCompanionIds.value = equippedCompanionIds.value.filter(id => id !== companion.id)
    companionMessage.value = `Đã tháo ${companion.name} khỏi đội hình.`
    return
  }
  if (equippedCompanionIds.value.length >= 4) {
    companionMessage.value = 'Đội hình đã đủ 4 đồng hành. Hãy tháo một ô trước.'
    return
  }
  equippedCompanionIds.value = [...equippedCompanionIds.value, companion.id]
  companionMessage.value = `Đã thêm ${companion.name} vào đội hình.`
}
const equipFirstCompanions = () => {
  equippedCompanionIds.value = companions.filter(companion => companion.owned).slice(0, 4).map(companion => companion.id)
  companionMessage.value = 'Đã xếp nhanh 4 đồng hành khả dụng.'
}
const showCompanionUpgrade = () => {
  const companion = companions.find(item => item.id === selectedCompanionId.value)
  companionMessage.value = companion
    ? `Đã chọn ${companion.name}. Nâng cấp đồng hành chưa khả dụng trong bản thử nghiệm.`
    : 'Hãy chọn một đồng hành đã mở khóa.'
}
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
const equipmentSlots = EQUIPMENT_SLOTS
const equipmentBonus = (slot: EquipmentSlot) => {
  const item = playerStore.equipment[slot]
  if (!item) return 0
  return (item.attackBonus ?? 0) + (item.defenseBonus ?? 0) + (item.hpBonus ?? 0) + (item.mpBonus ?? 0)
}
const equipmentItemBonus = (item: Pick<InventoryItem, 'slot' | 'attackBonus' | 'defenseBonus'>) =>
  item.slot === 'weapon' ? item.attackBonus ?? 0 : item.defenseBonus ?? item.attackBonus ?? 0
const equipmentItemSprite = (item: InventoryItem) => {
  if (item.slot === 'weapon') return '/assets/item-sword.svg'
  if (item.slot === 'helmet') return '/assets/item-helmet.svg'
  if (item.slot === 'armor') return '/assets/item-armor.svg'
  if (item.slot === 'gloves') return '/assets/item-gloves.svg'
  if (item.slot === 'boots') return '/assets/item-boots.svg'
  if (item.slot === 'ring') return '/assets/item-ring.svg'
  if (item.slot === 'necklace') return '/assets/item-necklace.svg'
  return '/assets/item-shard.svg'
}
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
.inventory-view.skills-mode {
  display: flex;
  flex-direction: column;
  width: min(620px, 100%);
  height: 100dvh;
  min-height: 0;
  padding: 8px 10px 0;
  overflow: hidden;
  color: #fff1ca;
  background:
    linear-gradient(90deg, rgba(37, 21, 12, .68), transparent 7%, transparent 93%, rgba(37, 21, 12, .68)),
    repeating-linear-gradient(90deg, #67432b 0 42px, #704a2e 43px 45px, #5c3a26 46px 50px);
  box-shadow: inset 0 0 0 4px #9f7041, inset 0 0 0 7px #422b20;
}

.skill-screen {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  gap: 7px;
}

.skill-player-bar {
  display: flex;
  flex: 0 0 54px;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border: 2px solid #e8c77d;
  border-radius: 12px;
  background: linear-gradient(180deg, #70513a, #422d23);
  box-shadow: 0 3px 0 #342219, inset 0 0 0 2px rgba(255, 242, 205, .18);
}

.skill-player {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.skill-player img {
  width: 40px;
  height: 40px;
  padding: 2px;
  border: 2px solid #f3d37e;
  border-radius: 50%;
  background: #d3a66d;
  object-fit: contain;
}

.skill-player strong,
.skill-player span {
  display: block;
  overflow: hidden;
  max-width: 180px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-player strong { font-size: 13px; }
.skill-player span { color: #e4d3b2; font-size: 10px; }
.skill-gold { color: #ffe797; font-size: 12px; white-space: nowrap; }

.skill-exit {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 2px solid #f5d580;
  border-radius: 50%;
  background: linear-gradient(#ca654b, #853c32);
  color: #fff4d5;
  font-size: 26px;
  font-weight: 900;
  line-height: 1;
  text-decoration: none;
  box-shadow: 0 2px 0 #552d24;
}

.skill-ribbon {
  display: flex;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin: 0 12px;
  border: 3px solid #f1c776;
  border-radius: 12px;
  background: linear-gradient(180deg, #d86f4a, #9f3f32);
  box-shadow: 0 4px 0 #5f3023, inset 0 0 0 2px rgba(255, 232, 171, .26);
  color: #fff0a5;
  text-shadow: 0 2px 2px #7f3429;
}

.skill-ribbon h1 { margin: 0; font-size: 22px; }
.skill-ribbon span { color: #ffe7a0; font-size: 17px; }

.skill-loadout {
  flex: 0 0 auto;
  padding: 8px 10px;
  border: 3px solid #bd8a4c;
  border-radius: 13px;
  background: linear-gradient(180deg, #fff3d4, #ead3a2);
  box-shadow: inset 0 0 0 2px #fff9e6, 0 3px 0 #503222;
  color: #60442b;
}

.skill-loadout-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
}

.skill-loadout-heading > span {
  color: #77542f;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .08em;
}

.skill-preset {
  min-width: 150px;
  padding: 5px 12px;
  border: 2px solid #9a6a3d;
  border-radius: 16px;
  background: linear-gradient(#fff0cc, #d7b57b);
  color: #5e4028;
  font-weight: 900;
}

.skill-preset span { margin-left: 10px; }

.equipped-skills {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.equipped-skill {
  position: relative;
  display: grid;
  aspect-ratio: 1;
  min-width: 0;
  place-items: center;
  overflow: hidden;
  border: 2px solid #bb83d4;
  border-radius: 7px;
  background: linear-gradient(145deg, #9a3eaf, #542a82);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.28);
}

.equipped-skill img { width: 78%; height: 78%; object-fit: contain; }
.equipped-skill strong {
  position: absolute;
  right: 2px;
  bottom: 1px;
  left: 2px;
  color: white;
  font-size: 10px;
  text-align: center;
  text-shadow: 0 1px 3px #24152f;
}

.equipped-skill.empty {
  border-color: #bd9d6c;
  background: rgba(99, 69, 42, .14);
  color: #b48c59;
  font-size: 22px;
}

.equipped-skill.selected { outline: 2px solid #fff0a7; outline-offset: 1px; }

.skill-bonus {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 8px;
  border-top: 2px solid #d5ad70;
  border-bottom: 2px solid #d5ad70;
  background: rgba(65, 41, 27, .7);
  color: #ffe6aa;
  font-size: 11px;
  text-align: center;
}

.skill-bonus span { color: #80e77b; font-weight: 900; }

.skill-library {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-auto-rows: minmax(62px, 1fr);
  align-content: start;
  gap: 7px;
  min-height: 0;
  padding: 4px 5px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: #c59759 rgba(69, 43, 26, .35);
}

.skill-card {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 62px;
  place-items: center;
  overflow: hidden;
  border: 2px solid #deb1f0;
  border-radius: 8px;
  background: linear-gradient(145deg, #a04ec0, #592986);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.25), 0 2px 3px rgba(29, 17, 12, .38);
}

.skill-card img { width: 67%; height: 67%; object-fit: contain; }
.skill-card strong {
  position: absolute;
  bottom: 2px;
  left: 2px;
  color: #fff;
  font-size: 9px;
  text-shadow: 0 1px 3px #21131a;
}

.skill-card small {
  position: absolute;
  right: 2px;
  bottom: 2px;
  padding: 1px 3px;
  border-radius: 5px;
  background: rgba(34, 26, 19, .72);
  color: white;
  font-size: 8px;
}

.skill-card.rarity-blue { border-color: #94c6ff; background: linear-gradient(145deg, #548cd5, #304a88); }
.skill-card.rarity-green { border-color: #9cdec0; background: linear-gradient(145deg, #4ba584, #286a5b); }
.skill-card.equipped { box-shadow: inset 0 0 0 2px rgba(255,255,255,.28), 0 0 0 1px #76dd8b; }
.skill-card.selected { outline: 2px solid #ffe27d; outline-offset: 1px; }
.skill-card.locked { border-color: #9a8159; background: linear-gradient(145deg, #66502c, #382a1b); filter: saturate(.55); }
.skill-card.locked img { opacity: .38; filter: grayscale(1); }

.companion-screen .skill-loadout { padding-top: 6px; padding-bottom: 6px; }
.companion-screen .equipped-skills { gap: 7px; }
.companion-slot { border-color: #d3b174; background: linear-gradient(145deg, #f8e3b1, #bba06c); }
.companion-slot.locked { border-color: #bdb4a0; background: linear-gradient(145deg, #dedbd1, #8e887c); }
.companion-slot.locked .skill-lock { top: 50%; right: 50%; transform: translate(50%, -50%); }
.companion-card img { width: 75%; height: 75%; }
.companion-add-mark {
  position: absolute;
  top: 2px;
  right: 3px;
  display: grid;
  width: 17px;
  height: 17px;
  place-items: center;
  border: 1px solid #fff0b0;
  border-radius: 50%;
  background: #d9a13d;
  color: #fff;
  font-size: 14px;
  font-weight: 900;
}
.companion-screen .skill-library { gap: 8px; }
.companion-screen .skill-card.equipped { box-shadow: inset 0 0 0 2px rgba(255,255,255,.28), 0 0 0 1px #76dd8b; }
.companion-screen .skill-bottom-nav button.active .shortcut-icon {
  border-color: #fff0a5;
  box-shadow: 0 0 0 2px #ad7438, 0 2px 0 #34251d;
}

.skill-equipped-mark,
.skill-lock {
  position: absolute;
  top: 2px;
  right: 3px;
  display: grid;
  width: 17px;
  height: 17px;
  place-items: center;
  border: 1px solid #fff0b0;
  border-radius: 50%;
  background: #379d58;
  color: white;
  font-size: 11px;
  font-weight: 900;
}

.skill-lock {
  border-radius: 5px;
  background: #f3ead5;
  color: #4b3b27;
  font-size: 10px;
}

.skill-actions {
  display: flex;
  flex: 0 0 auto;
  justify-content: center;
  gap: 12px;
  padding: 2px 0;
}

.skill-action {
  min-width: 150px;
  padding: 9px 14px;
  border: 3px solid #e8ca85;
  border-radius: 23px;
  color: white;
  font-size: 14px;
  font-weight: 900;
  text-shadow: 0 2px 2px rgba(0,0,0,.4);
  box-shadow: 0 3px 0 #543b28, inset 0 0 0 2px rgba(255,255,255,.22);
}

.equip-action { background: linear-gradient(#5c9bd0, #315c93); }
.upgrade-action { background: linear-gradient(#85bd3b, #4a8529); }
.skill-action:disabled { filter: grayscale(.7); opacity: .65; }

.skill-feedback {
  flex: 0 0 17px;
  min-height: 17px;
  margin: 0;
  overflow: hidden;
  color: #ffe6aa;
  font-size: 10px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-category-tabs {
  display: grid;
  flex: 0 0 48px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 5px 12px 4px;
  border-top: 3px solid #c39554;
  background: linear-gradient(#583b29, #39271e);
}

.skill-category-tabs button {
  border: 2px solid #a87d4b;
  border-radius: 7px 7px 0 0;
  background: linear-gradient(#6f604d, #47382f);
  color: #eee0be;
  font-weight: 800;
}

.skill-category-tabs button.active {
  border-color: #edbd69;
  background: linear-gradient(#d67a42, #9d482e);
  color: #fff2c8;
}

.skill-bottom-nav {
  display: grid;
  flex: 0 0 72px;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: center;
  gap: 2px;
  margin: 0 -10px;
  padding: 3px 4px max(4px, env(safe-area-inset-bottom));
  border-top: 3px solid #bd8c4e;
  background: linear-gradient(180deg, #6e4a31, #3b291f);
  box-shadow: 0 -3px 10px rgba(31, 18, 12, .4);
}

.skill-bottom-nav button {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff0c8;
  font: inherit;
}

.shortcut-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  overflow: hidden;
  border: 2px solid #e5bf74;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 25%, #f8e3a8, #986842 70%);
  box-shadow: 0 2px 0 #34251d;
}

.shortcut-icon img { width: 34px; height: 34px; object-fit: contain; }
.exit-shortcut { background: linear-gradient(#d87658, #923e34); font-size: 30px; font-weight: 900; }
.skill-bottom-nav strong { overflow: hidden; max-width: 100%; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }

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

.inventory-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-link {
  padding: 10px 14px;
  border: 1px solid #d5ad70;
  border-radius: 7px;
  background: #81552e;
  color: #fff0bf;
  text-decoration: none;
  white-space: nowrap;
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
  grid-template-columns: repeat(7, minmax(82px, 1fr));
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

.inventory-item-image {
  width: 72px;
  height: 72px;
  margin: 0 auto;
  object-fit: contain;
  filter: drop-shadow(0 5px 4px rgba(0, 0, 0, .28));
}

.rarity-Tốt {
  border-color: #69b78a;
}

.rarity-Hiếm {
  border-color: #9c83d9;
}

.rarity-Sử\ thi {
  border-color: #d36bd2;
  box-shadow: inset 0 0 12px rgba(211,107,210,.22);
}

.rarity-Huyền\ thoại {
  border-color: #f1c75b;
  box-shadow: 0 0 12px rgba(241,199,91,.28);
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

  .inventory-view.skills-mode { padding: 7px 8px 0; }
  .skill-player-bar { flex-basis: 50px; }
  .skill-player img { width: 36px; height: 36px; }
  .skill-ribbon { flex-basis: 40px; margin-inline: 8px; }
  .skill-ribbon h1 { font-size: 20px; }
  .skill-loadout { padding: 6px 8px; }
  .equipped-skills { gap: 6px; }
  .skill-library { grid-auto-rows: minmax(58px, 1fr); gap: 6px; padding-inline: 2px; }
  .skill-card { min-height: 58px; }
  .skill-action { min-width: 0; flex: 1; padding: 8px 6px; font-size: 13px; }
  .skill-actions { gap: 9px; }
  .skill-bottom-nav { margin-inline: -8px; }
  .shortcut-icon { width: 34px; height: 34px; }
  .shortcut-icon img { width: 30px; height: 30px; }
  .skill-bottom-nav strong { font-size: 8px; }
}
</style>