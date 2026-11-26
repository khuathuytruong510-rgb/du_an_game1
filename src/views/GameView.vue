<template>
  <main class="game-view">
    <header class="battle-hud">
      <button type="button" class="player-identity" aria-label="Mở hồ sơ nhân vật" @click="openProfileDrawer">
        <img class="portrait" :src="avatarSource" :alt="player.playerName" />
        <div>
          <strong>{{ player.playerName }}</strong>
          <span>Cấp {{ player.level }}</span>
        </div>
      </button>

      <div class="header-bar">
        <div class="exp-label">
          <span>EXP</span>
          <strong>{{ player.exp }} / {{ expToNextLevel }}</strong>
        </div>
        <div class="exp-track"><div :style="{ width: `${expProgress}%` }"></div></div>
      </div>

      <div class="player-bars">
        <div class="hp-mini">
          <span>HP</span>
          <strong>{{ player.hp }} / {{ player.maxHp }}</strong>
        </div>
        <div class="mp-mini">
          <span>MP</span>
          <strong>{{ player.mp }} / {{ player.maxMp }}</strong>
        </div>
      </div>

      <div class="gold-pill">🪙 {{ player.gold }}</div>
      <nav class="top-nav" aria-label="Điều hướng">
        <RouterLink to="/inventory">TÚI ĐỒ</RouterLink>
        <button type="button" @click="openMountPanel">THÚ CƯỠI</button>
        <RouterLink to="/settings">CÀI ĐẶT</RouterLink>
      </nav>
      <div class="portrait-server-meta" aria-label="Máy chủ và thời gian">
        <strong>Khôi Thí VI 1-1</strong>
        <span>2026/11/15 · 15:48</span>
      </div>
      <nav class="portrait-hud-actions" aria-label="Tác vụ đầu trang">
        <RouterLink to="/inventory">TÚI ĐỒ</RouterLink>
        <button type="button" @click="openMountPanel">THÚ CƯỠI</button>
        <RouterLink to="/settings">CÀI ĐẶT</RouterLink>
      </nav>
    </header>

    <section class="combat-status">
      <button
        v-for="monster in monsterTargets"
        :key="monster.id"
        type="button"
        class="target-chip"
        :class="{ active: player.currentTargetId === monster.id }"
        @click="selectTarget(monster.id)"
      >
        <span class="target-portrait">
          <img :src="monster.portrait" alt="" />
        </span>
        <span>
          <strong>{{ monster.name }}</strong>
          <small>{{ monster.level }}</small>
        </span>
      </button>
    </section>

    <button type="button" class="portrait-battle-enter" @click="selectTarget('slime')">
      Nhập vào Chiến Trường
    </button>

    <aside class="portrait-left-actions" aria-label="Tác vụ nhanh">
      <button type="button" @click="openQuickPanel('Nhiệm vụ mùa giải')">
        <img src="/assets/item-shard.svg" alt="" />
        <strong>Nhiệm vụ mùa giải</strong>
      </button>
      <button type="button" @click="openQuickPanel('Lịch trình')">
        <img src="/assets/item-potion.svg" alt="" />
        <strong>Lịch trình</strong>
      </button>
      <button type="button" @click="openQuickPanel('Chiến Liên')">
        <img src="/assets/boss-tiger.svg" alt="" />
        <strong>Chiến Liên</strong>
      </button>
      <button type="button" @click="openQuickPanel('Điểm danh')">
        <img src="/assets/item-helmet.svg" alt="" />
        <strong>Điểm danh</strong>
      </button>
    </aside>

    <aside class="portrait-right-actions" aria-label="Sự kiện nhanh">
      <button type="button" @click="openQuickPanel('Quà nạp')">
        <img src="/assets/item-ring.svg" alt="" />
        <strong>Quà nạp</strong>
      </button>
      <button type="button" @click="openMountPanel">
        <img src="/assets/supplied/mount-mechanical-frog.png" alt="" />
        <strong>Thú Cưỡi</strong>
      </button>
      <button type="button" @click="goToInventory">
        <img src="/assets/item-sword.svg" alt="" />
        <strong>Cường Hóa</strong>
      </button>
      <button type="button" @click="openQuickPanel('Thông hành')">
        <img src="/assets/item-shard.svg" alt="" />
        <strong>Thông hành</strong>
      </button>
      <button type="button" @click="openQuickPanel('Sự kiện')">
        <img src="/assets/item-potion.svg" alt="" />
        <strong>Sự kiện</strong>
      </button>
    </aside>

    <section class="bottom-console" aria-label="Chiến đấu và trang bị">
      <div class="skill-row">
        <button type="button" class="auto-toggle" :class="{ active: player.autoBattle }" @click="toggleAuto">
          <span>AUTO</span>
          <strong>{{ player.autoBattle ? 'ON' : 'OFF' }}</strong>
        </button>
        <button type="button" class="skill-orb target-cycle" aria-label="Mục tiêu trước" @click="emitGameEvent('target:previous')">
          <span class="orb-icon">‹</span>
          <small>Trước</small>
        </button>
        <button type="button" class="skill-orb attack" aria-label="Tấn công thường" @click="attack">
          <span class="orb-icon">⚔</span>
          <small>Đánh</small>
        </button>
        <button type="button" class="skill-orb" :disabled="player.mp < 20" aria-label="Kỹ năng chém bão" @click="useSkill">
          <span class="orb-icon skill-blue">✦</span>
          <small>20 MP</small>
        </button>
        <button type="button" class="skill-orb" :disabled="potionCount <= 0" aria-label="Dùng thuốc hồi phục" @click="usePotion">
          <span class="orb-icon potion">♥</span>
          <small>x{{ potionCount }}</small>
        </button>
        <button type="button" class="skill-orb target-cycle" aria-label="Mục tiêu tiếp theo" @click="emitGameEvent('target:next')">
          <span class="orb-icon">›</span>
          <small>Sau</small>
        </button>
        <button type="button" class="skill-orb" aria-label="Chơi lại" @click="resetBattle">
          <span class="orb-icon reset">↻</span>
          <small>Reset</small>
        </button>
      </div>

      <div class="inventory-strip">
        <div class="strip-tabs" role="tablist" aria-label="Kho vật phẩm">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'equipment'"
            :class="{ 'tab-active': activeTab === 'equipment' }"
            @click="activeTab = 'equipment'"
          >
            Trang bị
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'inventory'"
            :class="{ 'tab-active': activeTab === 'inventory' }"
            @click="activeTab = 'inventory'"
          >
            Kho đồ
          </button>
        </div>

        <div v-if="activeTab === 'equipment'" class="equipment-row">
          <article
            v-for="slot in EQUIPMENT_SLOTS"
            :key="slot.id"
            class="equipment-card"
          >
            <img
              class="equipment-icon"
              :src="equipmentSprite(slot.id)"
              :alt="slot.label"
            />
            <div>
              <strong>{{ player.equipment[slot.id]?.name ?? slot.label }}</strong>
              <small>{{ equipmentBonusText(slot.id) }}</small>
            </div>
          </article>
        </div>

        <div class="item-grid">
          <button
            v-for="item in visibleInventorySlots"
            :key="item.id"
            type="button"
            class="item-slot"
            :class="{ occupied: item.name }"
            :title="item.name"
            @click="item.name ? useInventoryItem(item) : goToInventory"
          >
            <template v-if="item.name">
              <img class="item-icon" :src="itemSprite(item)" :alt="item.name" />
              <strong v-if="item.quantity > 1">{{ item.quantity }}</strong>
              <small v-if="item.type === 'equipment'">+{{ item.enhanceLevel ?? item.attackBonus ?? item.defenseBonus ?? 0 }}</small>
              <span class="item-name">{{ item.name }}</span>
            </template>
            <template v-else>
              <span class="empty-plus">＋</span>
            </template>
          </button>
        </div>
      </div>

      <div class="portrait-console-footer">
        <button type="button" class="portrait-quest" @click="openQuickPanel('Nhiệm vụ mùa giải')">
          <strong>{{ activeQuest?.title ?? 'Nhiệm vụ' }}</strong>
          <span>{{ activeQuest?.progress ?? 0 }} / {{ activeQuest?.required ?? 0 }}</span>
          <span class="quest-progress-track"><i :style="{ width: `${questProgress}%` }"></i></span>
        </button>
        <div class="portrait-chat" aria-live="polite">
          <strong>〈 Thông tin đội 〉</strong>
          <span>{{ player.autoMessage }}</span>
        </div>
        <div class="portrait-footer-actions">
          <button type="button" @click="toggleAuto"><span>◉</span>Tự động</button>
          <button type="button" @click="openQuickPanel('Lịch trình')"><span>✦</span>Sự kiện</button>
        </div>
        <button type="button" class="portrait-forge" @click="goToInventory">
          <span aria-hidden="true">🏮</span>
          <strong>Lò Rèn</strong>
          <small>Chạm để nâng cấp</small>
        </button>
      </div>
    </section>

    <div v-if="player.lootMessage" class="loot-toast" role="status">{{ player.lootMessage }}</div>

    <div v-if="quickPanelTitle" class="quick-panel-backdrop" @click.self="closeQuickPanel">
      <section class="quick-panel" role="dialog" aria-modal="true" aria-labelledby="quick-panel-title">
        <header class="quick-panel-heading">
          <div>
            <span>Sự kiện & mục tiêu</span>
            <h2 id="quick-panel-title">{{ quickPanelTitle }}</h2>
          </div>
          <button type="button" aria-label="Đóng" @click="closeQuickPanel">×</button>
        </header>
        <div class="quick-panel-list">
          <button type="button" @click="quickPanelGoToInventory">
            <img src="/assets/item-shard.svg" alt="" />
            <div><strong>{{ quickPanelPrimaryTitle }}</strong><span>{{ quickPanelPrimaryText }}</span></div>
          </button>
          <button type="button" @click="quickPanelGoToInventory">
            <img src="/assets/item-sword.svg" alt="" />
            <div><strong>{{ quickPanelSecondaryTitle }}</strong><span>{{ quickPanelSecondaryText }}</span></div>
          </button>
        </div>
        <footer><button type="button" @click="closeQuickPanel">Đóng</button></footer>
      </section>
    </div>

    <div v-if="showProfileDrawer" class="profile-drawer-backdrop" @click.self="closeProfileDrawer">
      <aside class="profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-drawer-title">
        <header class="profile-drawer-heading">
          <img :src="avatarSource" :alt="player.playerName" />
          <div>
            <strong id="profile-drawer-title">{{ player.playerName }}</strong>
            <span>Nhà thám hiểm · Cấp {{ player.level }}</span>
          </div>
          <button type="button" aria-label="Đóng hồ sơ" @click="closeProfileDrawer">×</button>
        </header>
        <p class="profile-drawer-id">ID phiêu lưu · {{ player.playerName }}</p>
        <nav class="profile-drawer-menu" aria-label="Tiện ích nhân vật">
          <button v-for="item in profileMenuItems" :key="item.title" type="button" @click="selectProfileAction(item.title)">
            <span>{{ item.icon }}</span>
            <strong>{{ item.title }}</strong>
          </button>
        </nav>
      </aside>
    </div>

    <nav class="bottom-nav" aria-label="Điều hướng chính">
      <button type="button" @click="openSkills">
        <span class="bottom-nav-icon character"><img :src="avatarSource" :alt="player.playerName" /></span>
        <strong>Nhân Vật</strong>
      </button>
      <button type="button" @click="openCompanions">
        <span class="bottom-nav-icon companion"><img src="/assets/supplied/mushroom-companion.png" alt="Đồng hành" /></span>
        <strong>Đồng Hành</strong>
      </button>
      <RouterLink to="/activities?screen=world">
        <span class="bottom-nav-icon shop"><img src="/assets/item-sword.svg" alt="Phố bán" /></span>
        <strong>Phó Bản</strong>
      </RouterLink>
      <RouterLink to="/activities?screen=farm">
        <span class="bottom-nav-icon guild"><img src="/assets/supplied/mushroom-companion.png" alt="Nông trại" /></span>
        <strong>Gia Viên</strong>
      </RouterLink>
      <RouterLink to="/activities?screen=guild">
        <span class="bottom-nav-icon race"><img src="/assets/item-ring.svg" alt="Gia tộc" /></span>
        <strong>Gia Tộc</strong>
      </RouterLink>
      <RouterLink to="/shop?tab=summon">
        <span class="bottom-nav-icon shop"><img src="/assets/item-shard.svg" alt="Tiệm" /></span>
        <strong>Tiệm</strong>
      </RouterLink>
    </nav>

    <div v-if="selectedInventoryItem" class="item-detail-backdrop" @click.self="closeItemDetail">
      <section class="item-detail-panel" role="dialog" aria-modal="true" aria-labelledby="item-detail-title">
        <header class="item-detail-heading">
          <div>
            <span :class="`item-rarity rarity-${selectedInventoryItem.rarity}`">{{ selectedInventoryItem.rarity }}</span>
            <h2 id="item-detail-title">{{ selectedInventoryItem.name }}</h2>
          </div>
          <button type="button" class="item-detail-close" aria-label="Đóng" @click="closeItemDetail">×</button>
        </header>
        <div class="item-detail-body">
          <img :src="itemSprite(selectedInventoryItem)" :alt="selectedInventoryItem.name" />
          <div>
            <strong>Cấp {{ player.level }}</strong>
            <p v-if="selectedInventoryItem.type === 'equipment'">{{ equipmentItemBonusText(selectedInventoryItem) }}</p>
            <p v-else-if="selectedInventoryItem.type === 'consumable'">Hồi {{ selectedInventoryItem.healAmount ?? 50 }} HP</p>
            <p v-else>Vật phẩm nhiệm vụ</p>
          </div>
        </div>
        <footer class="item-detail-actions">
          <button
            v-if="selectedInventoryItem.type === 'equipment'"
            type="button"
            @click="equipSelectedItem"
          >
            TRANG BỊ
          </button>
          <button
            v-if="selectedInventoryItem.type === 'equipment'"
            type="button"
            class="item-detail-remove"
            @click="unequipSelectedItem"
          >
            THÁO
          </button>
          <button
            v-else-if="selectedInventoryItem.type === 'consumable'"
            type="button"
            @click="useSelectedItem"
          >
            SỬ DỤNG
          </button>
          <button type="button" class="item-detail-close-action" @click="closeItemDetail">Đóng</button>
        </footer>
      </section>
    </div>

    <div v-if="showMountPanel" class="mount-backdrop" @click.self="closeMountPanel">
      <section class="mount-panel" role="dialog" aria-modal="true" aria-labelledby="mount-title">
        <header class="mount-heading">
          <div>
            <h2 id="mount-title">Thú cưỡi</h2>
            <p>Chọn thú đồng hành trong chiến trường</p>
          </div>
          <button type="button" class="mount-close" aria-label="Đóng" @click="closeMountPanel">×</button>
        </header>

        <div class="mount-options">
          <button
            v-for="mount in mountOptions"
            :key="mount.id"
            type="button"
            class="mount-option"
            :class="{ selected: player.mountId === mount.id }"
            :aria-pressed="player.mountId === mount.id"
            @click="selectMount(mount.id)"
          >
            <img :src="mount.image" :alt="mount.name" />
            <strong>{{ mount.name }}</strong>
            <small>{{ player.mountId === mount.id ? 'Đang đồng hành' : 'Chọn thú cưỡi' }}</small>
          </button>
        </div>

        <nav class="mount-progression-links" aria-label="Tiến trình thú cưỡi và thần khí">
          <RouterLink to="/progression?feature=mount&tab=upgrade">Nâng cấp thú cưỡi</RouterLink>
          <RouterLink to="/progression?feature=mount&tab=empower">Cường hóa</RouterLink>
          <RouterLink to="/progression?feature=mount&tab=advanced">Thú cưỡi bậc cao</RouterLink>
          <RouterLink to="/progression?feature=mount&tab=appearance">Cải trang</RouterLink>
          <RouterLink to="/progression?feature=artifact&tab=upgrade">Thần khí</RouterLink>
        </nav>

        <footer class="mount-footer">
          <button type="button" class="remove-mount" @click="selectMount(null)">Tháo thú cưỡi</button>
          <p v-if="mountStatus || player.mountId" role="status">
            {{ mountStatus || 'Thú cưỡi được lưu trên thiết bị này.' }}
          </p>
        </footer>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { EQUIPMENT_SLOTS, usePlayerStore, type InventoryItem } from '../stores/player'
import { emitGameEvent } from '../game/createGame'
import type { MountId } from '../game/persistence/gameSettings'

const player = usePlayerStore()
const router = useRouter()
const activeTab = ref<'equipment' | 'inventory'>('equipment')
const showMountPanel = ref(false)
const showProfileDrawer = ref(false)
const mountStatus = ref('')
const selectedInventoryItem = ref<InventoryItem | null>(null)
const quickPanelTitle = ref('')
const avatarSource = computed(() =>
  player.playerAvatar === 'hero-scout'
    ? '/assets/hero-scout.svg'
    : '/assets/hero-mushroom.svg'
)

const expToNextLevel = computed(() => 100 * player.level * player.level)
const expProgress = computed(() => Math.min(100, player.exp / expToNextLevel.value * 100))
const potionCount = computed(() => player.inventory.find(item =>
  item.type === 'consumable' && item.name === 'Thuốc hồi phục'
)?.quantity ?? 0)
const activeQuest = computed(() => player.quests.find(quest => !quest.claimed) ?? player.quests[0] ?? null)
const questProgress = computed(() =>
  activeQuest.value
    ? Math.min(100, activeQuest.value.progress / activeQuest.value.required * 100)
    : 0
)

const monsterTargets = [
  { id: 'slime', name: 'Slime lá', level: 'Cấp 1', portrait: '/assets/slime.svg' },
  { id: 'wolf', name: 'Sói tuyết', level: 'Cấp 3', portrait: '/assets/wolf.svg' },
  { id: 'goblin', name: 'Goblin', level: 'Cấp 5', portrait: '/assets/goblin.svg' },
  { id: 'boss', name: 'Bạch Hổ', level: 'BOSS', portrait: '/assets/boss-tiger.svg' }
]
const mountOptions: Array<{ id: MountId; name: string; image: string }> = [
  { id: 'ice-dragon', name: 'Rồng băng', image: '/assets/supplied/mount-ice-dragon.png' },
  { id: 'mechanical-frog', name: 'Ếch cơ giới', image: '/assets/supplied/mount-mechanical-frog.png' }
]
const profileMenuItems = [
  { title: 'Hộp thư', icon: '✉️' },
  { title: 'Mời bạn', icon: '👥' },
  { title: 'Bạn bè', icon: '🍄' },
  { title: 'Sổ tay chiến đấu', icon: '📖' },
  { title: 'Bảng xếp hạng', icon: '🏆' },
  { title: 'Cộng đồng', icon: '💬' },
  { title: 'Vòng quay may mắn', icon: '🎡' },
  { title: 'Thông báo', icon: '📯' },
  { title: 'Trung tâm phúc lợi', icon: '🎁' },
  { title: 'Thú cưỡi', icon: '🐉' },
  { title: 'Thần khí', icon: '⚔️' },
  { title: 'Cửa hàng', icon: '🛍️' }
]

const inventorySlots = computed(() => {
  const slots = player.inventory.slice(0, 24).map(item => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    type: item.type,
    enhanceLevel: item.enhanceLevel,
    attackBonus: item.attackBonus,
    defenseBonus: item.defenseBonus,
    slot: item.slot
  }))
  while (slots.length < 24) {
    slots.push({
      id: `empty-${slots.length}`,
      name: '',
      quantity: 0,
      type: 'material',
      enhanceLevel: 0,
      attackBonus: 0,
      defenseBonus: 0,
      slot: undefined
    })
  }
  return slots
})

const equipmentInventorySlots = computed(() => {
  const slots = inventorySlots.value.filter(item => item.name && item.type === 'equipment')
  while (slots.length < 24) {
    slots.push({
      id: `equipment-empty-${slots.length}`,
      name: '',
      quantity: 0,
      type: 'material',
      enhanceLevel: 0,
      attackBonus: 0,
      defenseBonus: 0,
      slot: undefined
    })
  }
  return slots.slice(0, 24)
})
const visibleInventorySlots = computed(() =>
  activeTab.value === 'equipment' ? equipmentInventorySlots.value : inventorySlots.value
)

const itemSprite = (item: { name: string; type: string; slot?: string }) => {
  if (item.type === 'equipment') {
    if (item.slot === 'weapon') return '/assets/item-sword.svg'
    if (item.slot === 'helmet') return '/assets/item-helmet.svg'
    if (item.slot === 'armor') return '/assets/item-armor.svg'
    if (item.slot === 'gloves') return '/assets/item-gloves.svg'
    if (item.slot === 'boots') return '/assets/item-boots.svg'
    if (item.slot === 'ring') return '/assets/item-ring.svg'
    if (item.slot === 'necklace') return '/assets/item-necklace.svg'
  }
  if (item.type === 'consumable') return '/assets/item-potion.svg'
  if (item.name.includes('linh')) return '/assets/item-shard.svg'
  return '/assets/item-shard.svg'
}

const equipmentSprite = (slot: string) => {
  if (slot === 'weapon') return '/assets/item-sword.svg'
  if (slot === 'helmet') return '/assets/item-helmet.svg'
  if (slot === 'armor') return '/assets/item-armor.svg'
  if (slot === 'gloves') return '/assets/item-gloves.svg'
  if (slot === 'boots') return '/assets/item-boots.svg'
  if (slot === 'ring') return '/assets/item-ring.svg'
  if (slot === 'necklace') return '/assets/item-necklace.svg'
  return '/assets/item-shard.svg'
}

const equipmentBonusText = (slot: typeof EQUIPMENT_SLOTS[number]['id']) => {
  const item = player.equipment[slot]
  if (!item) return 'Trống'
  const bonuses: string[] = []
  if (item.attackBonus) bonuses.push(`+${item.attackBonus} ATK`)
  if (item.defenseBonus) bonuses.push(`+${item.defenseBonus} DEF`)
  if (item.hpBonus) bonuses.push(`+${item.hpBonus} HP`)
  if (item.mpBonus) bonuses.push(`+${item.mpBonus} MP`)
  if (item.attackSpeedBonus) bonuses.push(`+${item.attackSpeedBonus} tốc đánh`)
  if (item.criticalBonus) bonuses.push(`+${Math.round(item.criticalBonus * 100)}% chí mạng`)
  if (item.dodgeBonus) bonuses.push(`+${Math.round(item.dodgeBonus * 100)}% né`)
  return bonuses.join(' · ') || 'Không có chỉ số'
}

const equipmentItemBonusText = (item: InventoryItem) => {
  const bonuses: string[] = []
  if (item.attackBonus) bonuses.push(`+${item.attackBonus} ATK`)
  if (item.defenseBonus) bonuses.push(`+${item.defenseBonus} DEF`)
  if (item.hpBonus) bonuses.push(`+${item.hpBonus} HP`)
  if (item.mpBonus) bonuses.push(`+${item.mpBonus} MP`)
  if (item.attackSpeedBonus) bonuses.push(`+${item.attackSpeedBonus} tốc đánh`)
  if (item.criticalBonus) bonuses.push(`+${Math.round(item.criticalBonus * 100)}% chí mạng`)
  if (item.dodgeBonus) bonuses.push(`+${Math.round(item.dodgeBonus * 100)}% né`)
  return bonuses.join(' · ') || 'Không có chỉ số'
}

const attack = () => emitGameEvent('combat:attack')
const useSkill = () => emitGameEvent('combat:skill')
const usePotion = () => emitGameEvent('combat:item')
const selectTarget = (id: string) => emitGameEvent('combat:target', id)
const toggleAuto = () => {
  player.setAutoBattle(!player.autoBattle)
  emitGameEvent('combat:auto', player.autoBattle)
}
const resetBattle = () => emitGameEvent('combat:reset')
const goToInventory = () => void router.push('/inventory')
const openSkills = () => void router.push({ path: '/inventory', query: { tab: 'skills' } })
const openCompanions = () => void router.push({ path: '/inventory', query: { tab: 'companions' } })
const openProfileDrawer = () => {
  showProfileDrawer.value = true
}
const closeProfileDrawer = () => {
  showProfileDrawer.value = false
}
const selectProfileAction = (title: string) => {
  closeProfileDrawer()
  if (title === 'Cửa hàng') {
    void router.push('/shop?tab=diamond')
    return
  }
  if (title === 'Trung tâm phúc lợi') {
    void router.push('/shop?tab=limited')
    return
  }
  if (title === 'Thú cưỡi') {
    void router.push('/progression?feature=mount&tab=upgrade')
    return
  }
  if (title === 'Thần khí') {
    void router.push('/progression?feature=artifact&tab=upgrade')
    return
  }
  openQuickPanel(title)
}
const openMountPanel = () => {
  mountStatus.value = ''
  showMountPanel.value = true
}
const closeMountPanel = () => {
  showMountPanel.value = false
}
const quickPanelContent = computed(() => {
  const content: Record<string, { primaryTitle: string; primaryText: string; secondaryTitle: string; secondaryText: string }> = {
    'Nhiệm vụ mùa giải': { primaryTitle: 'Dọn bãi tập', primaryText: 'Đánh bại quái để nhận EXP và vàng', secondaryTitle: 'Mảnh linh thạch', secondaryText: 'Thu thập 3 mảnh linh thạch' },
    'Lịch trình': { primaryTitle: 'Lịch hôm nay', primaryText: 'Thử thách Boss và rèn trang bị', secondaryTitle: 'Phần thưởng', secondaryText: 'Nhận vàng và vật phẩm' },
    'Chiến Liên': { primaryTitle: 'Đấu trường', primaryText: 'Chọn quái và chiến đấu liên tục', secondaryTitle: 'Bảng thành tích', secondaryText: 'Tăng cấp để mở thử thách mới' },
    'Quà nạp': { primaryTitle: 'Thưởng hằng ngày', primaryText: 'Nhận vật phẩm bằng cách hoàn thành nhiệm vụ', secondaryTitle: 'Quà chiến lợi', secondaryText: 'Phần thưởng khi đánh bại Boss' }
  }
  return content[quickPanelTitle.value] ?? {
    primaryTitle: 'Hoạt động',
    primaryText: 'Xem mục tiêu và phần thưởng',
    secondaryTitle: 'Tiến độ',
    secondaryText: 'Cập nhật theo lượt chiến đấu'
  }
})
const quickPanelPrimaryTitle = computed(() => quickPanelContent.value.primaryTitle)
const quickPanelPrimaryText = computed(() => quickPanelContent.value.primaryText)
const quickPanelSecondaryTitle = computed(() => quickPanelContent.value.secondaryTitle)
const quickPanelSecondaryText = computed(() => quickPanelContent.value.secondaryText)
const openQuickPanel = (title: string) => {
  quickPanelTitle.value = title
}
const closeQuickPanel = () => {
  quickPanelTitle.value = ''
}
const quickPanelGoToInventory = () => {
  closeQuickPanel()
  void router.push('/inventory')
}
const selectMount = (id: MountId | null) => {
  if (!player.setMount(id)) {
    mountStatus.value = player.settingsStatus
    return
  }
  mountStatus.value = ''
  emitGameEvent('mount:change', id)
}
const useInventoryItem = (item: { id: string; type: string }) => {
  if (item.type === 'equipment' || item.type === 'consumable') {
    selectedInventoryItem.value = player.inventory.find(inventoryItem => inventoryItem.id === item.id) ?? null
  } else void router.push('/inventory')
}
const closeItemDetail = () => {
  selectedInventoryItem.value = null
}
const equipSelectedItem = () => {
  const item = selectedInventoryItem.value
  if (!item) return
  player.equipItem(item.id)
  closeItemDetail()
}
const unequipSelectedItem = () => {
  const item = selectedInventoryItem.value
  if (!item?.slot) return
  if (player.equipment[item.slot]?.id === item.id) player.unequipItem(item.slot)
  closeItemDetail()
}
const useSelectedItem = () => {
  const item = selectedInventoryItem.value
  if (!item) return
  player.useItem(item.id)
  closeItemDetail()
}
</script>

<style scoped>
.game-view {
  --gold: #ffe6a0;
  --wood-dark: #4a2d20;
  --wood-mid: #79502e;
  --wood-light: #bd8846;
  --panel-cream: #f3dfae;
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  color: #fff;
  font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif;
}
.game-view button, .game-view a { pointer-events: auto; }

.battle-hud {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  height: 68px;
  display: grid;
  grid-template-columns: 190px minmax(180px, 1fr) 170px 86px auto;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 3px solid #ffe4a1;
  border-radius: 18px;
  background:
    linear-gradient(90deg, rgba(255, 222, 139, .12), transparent 35%, rgba(255, 222, 139, .12)),
    linear-gradient(180deg, #80604a 0, #4e3428 100%);
  box-shadow:
    0 5px 14px rgba(48, 29, 19, .48),
    inset 0 0 0 3px rgba(255, 226, 154, .25),
    inset 0 -5px 10px rgba(62, 31, 20, .42);
}
.player-identity {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.player-identity strong, .player-identity span { display: block; }
.player-identity strong { color: var(--gold); font-size: 15px; }
.player-identity span { font-size: 12px; color: #dff4df; }
.portrait {
  display: grid; width: 44px; height: 44px; place-items: center;
  border: 3px solid #ffe7a4; border-radius: 50%; background: #eec889;
  box-shadow: 0 3px 0 #80522d, 0 0 0 2px #bd8846;
  font-size: 25px;
}
.header-bar { min-width: 0; }
.exp-label { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px; }
.exp-track { height: 10px; overflow: hidden; border: 2px solid #3b271d; border-radius: 8px; background: #34231c; }
.exp-track div { height: 100%; background: linear-gradient(90deg, #8bd76c, #e6e878); border-radius: 6px; }
.player-bars { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.hp-mini, .mp-mini {
  display: flex; justify-content: space-between; padding: 7px 8px;
  border: 2px solid #593823; border-radius: 8px; background: linear-gradient(#a74b3a, #793529);
  font-size: 10px;
}
.mp-mini { background: linear-gradient(#4489ba, #315c91); }
.hp-mini strong, .mp-mini strong { color: #fff; }
.gold-pill {
  justify-self: center; padding: 9px 10px; border: 2px solid #ffe39a;
  border-radius: 10px; background: linear-gradient(#ffe69a, #e3aa42); color: #65411c; font-weight: 900;
}
.top-nav { display: flex; gap: 6px; }
.top-nav a, .top-nav button {
  cursor: pointer;
  color: #fff; text-decoration: none; font-size: 10px; font-weight: 900;
  padding: 8px 7px; border: 2px solid #f4d184;
  border-radius: 8px; background: linear-gradient(#b77a3c, #754627);
  pointer-events: auto;
}
.portrait-server-meta { display: none; }
.portrait-hud-actions { display: none; }

.combat-status {
  position: absolute;
  top: 84px;
  left: 16px;
  display: flex;
  gap: 7px;
}
.target-chip {
  min-width: 104px;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 2px solid #d5a856;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(112, 72, 39, .96), rgba(69, 43, 30, .96));
  color: #fff;
  box-shadow: 0 3px 0 rgba(53, 33, 22, .62), inset 0 1px 0 rgba(255, 237, 191, .25);
  opacity: .82;
}
.target-portrait {
  display: grid; flex: 0 0 34px; width: 34px; height: 34px; place-items: center;
  overflow: hidden;
  border: 2px solid #f1d283;
  border-radius: 8px;
  background: #f5e8bd;
}
.target-portrait img {
  width: 31px;
  height: 31px;
  object-fit: contain;
}
.target-chip strong, .target-chip small { display: block; text-align: left; }
.target-chip strong { font-size: 10px; }
.target-chip small { color: #ffe990; }
.target-chip.active {
  opacity: 1;
  border-color: #fff0a0;
  background: linear-gradient(180deg, #bd8139, #885229);
  box-shadow: 0 3px 0 #57331f, 0 0 14px rgba(255, 225, 112, .48), inset 0 1px 0 #fff0bb;
}

.portrait-battle-enter,
.portrait-left-actions,
.portrait-right-actions {
  display: none;
}

.bottom-console {
  position: absolute;
  left: 50%;
  bottom: 76px;
  transform: translateX(-50%);
  width: min(620px, calc(100% - 24px));
  pointer-events: auto;
}
.skill-row {
  height: 88px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 10px;
  margin-bottom: 5px;
}
.auto-toggle, .skill-orb {
  position: relative;
  border: 4px solid #f1d58d;
  box-shadow: 0 4px 0 #684327, 0 6px 12px rgba(54, 34, 20, .48), inset 0 0 12px rgba(255,255,255,.48);
  color: #fff;
  background: linear-gradient(145deg, #bb8946, #79502d);
}
.auto-toggle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: grid;
  align-content: center;
  line-height: 1.05;
  background: linear-gradient(145deg, #e3ae50, #985c2b);
}
.auto-toggle.active { background: linear-gradient(145deg, #f7d26c, #bd742e); box-shadow: 0 4px 0 #704322, 0 0 18px #ffe795; }
.auto-toggle span { font-size: 10px; }
.auto-toggle strong { color: #fff3a7; font-size: 16px; }
.skill-orb {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  padding: 5px;
  background: linear-gradient(145deg, #c38d47, #81532e);
}
.orb-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 2px solid #f7efd1;
  border-radius: 50%;
  background: linear-gradient(145deg, #f1ba59, #c66f3a);
  font-size: 23px;
  text-shadow: 0 2px 2px #85523b;
}
.orb-icon.skill-blue { background: linear-gradient(145deg, #78d1ef, #416bba); }
.orb-icon.potion { background: linear-gradient(145deg, #7ee0a1, #3d9b62); }
.orb-icon.reset { background: linear-gradient(145deg, #bea1ef, #71589e); }
.skill-orb small {
  position: absolute;
  bottom: -9px;
  min-width: 42px;
  padding: 2px 4px;
  border: 1px solid #8d7d61;
  border-radius: 7px;
  background: #f1dfb4;
  color: #4e493e;
  font-size: 9px;
  font-weight: 800;
}

.inventory-strip {
  min-height: 208px;
  border: 4px solid #94612f;
  border-radius: 14px;
  background:
    radial-gradient(circle at 8px 8px, rgba(255,255,255,.45) 0 3px, transparent 4px),
    linear-gradient(180deg, #f8e8bd, #dfc58e);
  box-shadow:
    0 -4px 16px rgba(65, 45, 28, .36),
    inset 0 0 0 3px #fff1c4,
    inset 0 0 18px rgba(255, 252, 224, .78);
  color: #594b3b;
  padding: 6px 10px 8px;
}
.portrait-console-footer { display: none; }
.strip-tabs { display: flex; gap: 5px; height: 27px; }
.strip-tabs button {
  border: 1px solid #8e6335;
  border-radius: 7px 7px 0 0;
  background: linear-gradient(#b77a3e, #82512d);
  color: #fff1ca;
  font-size: 10px;
  font-weight: 900;
}
.strip-tabs .tab-active { background: linear-gradient(#fff0b8, #e8c36c); color: #6a451e; }
.equipment-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 7px;
  margin: 5px 0;
}
.equipment-card {
  min-width: 0;
  min-height: 49px;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 5px;
  padding: 4px 5px;
  border: 2px solid #c6a463;
  border-radius: 8px;
  background: linear-gradient(145deg, #fff5d7, #e8d19b);
  box-shadow: inset 0 1px 0 #fffced;
}
.equipment-icon {
  width: 30px;
  height: 30px;
  object-fit: contain;
  border: 1px solid #c3a366;
  border-radius: 7px;
  background: #f6e8c5;
}
.equipment-card strong, .equipment-card small { display: block; }
.equipment-card strong {
  overflow: hidden;
  font-size: 9px;
  line-height: 1.1;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.equipment-card small {
  overflow: hidden;
  color: #79572f;
  font-size: 8px;
  line-height: 1.1;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.item-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(2, 58px);
  gap: 5px;
}
.item-slot {
  position: relative;
  min-width: 0;
  border: 2px solid #b99a61;
  border-radius: 8px;
  background: rgba(255, 251, 229, .72);
  color: #5e4f3d;
  overflow: hidden;
}
.item-slot:nth-child(n + 17) { display: none; }
.item-slot.occupied {
  background: linear-gradient(145deg, #fff1c8, #dcc079);
  box-shadow: inset 0 0 8px rgba(255,255,255,.75);
}
.item-icon { width: 38px; height: 38px; display: block; margin: 0 auto; object-fit: contain; }
.item-slot strong {
  position: absolute;
  right: 4px;
  top: 3px;
  display: grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  border-radius: 50%;
  background: #81552e;
  color: #fff;
  font-size: 9px;
}
.item-slot small {
  position: absolute;
  left: 3px;
  top: 3px;
  font-size: 8px;
  color: #76502c;
}
.item-name {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 7px;
}
.empty-plus { color: #c1ae83; font-size: 18px; }

.bottom-nav {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 76px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: end;
  gap: 2px;
  padding: 5px 4px 3px;
  border-top: 4px solid #b68a4c;
  background:
    linear-gradient(90deg, rgba(255, 225, 144, .09) 1px, transparent 1px) 0 0 / 34px 100%,
    linear-gradient(180deg, rgba(122, 82, 52, .98), rgba(58, 39, 30, .98));
  box-shadow: 0 -5px 18px rgba(44, 30, 19, .55), inset 0 3px 0 #dfb56d;
  pointer-events: auto;
}
.bottom-nav button, .bottom-nav a {
  min-width: 0;
  height: 64px;
  display: grid;
  justify-items: center;
  align-content: end;
  gap: 3px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #fff4cf;
  text-decoration: none;
  font-family: inherit;
  text-shadow: 0 2px 2px #3b281b;
}
.bottom-nav strong {
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bottom-nav-icon {
  position: relative;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 3px solid #dcae61;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 28%, #fff1bc 0 12%, #b2a178 13% 42%, #6f4930 43%);
  box-shadow: 0 3px 0 #3f2d21, inset 0 0 0 2px #f7e6b1;
  color: #fff;
  font-size: 21px;
}
.bottom-nav-icon img {
  width: 38px;
  height: 38px;
  object-fit: contain;
  filter: drop-shadow(0 2px 1px rgba(62, 38, 25, .42));
}
.bottom-nav button:nth-child(1) .bottom-nav-icon::after,
.bottom-nav button:nth-child(4) .bottom-nav-icon::after,
.bottom-nav a:nth-of-type(3) .bottom-nav-icon::after {
  content: '';
  position: absolute;
  top: -5px;
  right: -5px;
  width: 10px;
  height: 10px;
  border: 2px solid #fff1b4;
  border-radius: 50%;
  background: #ce4a35;
}
.bottom-nav-icon.companion { background: radial-gradient(circle at 35% 28%, #f7cf78, #9d5a40 52%, #56372b); }
.bottom-nav-icon.shop { background: radial-gradient(circle at 35% 28%, #fff0bf, #9d8bd2 52%, #514071); }
.bottom-nav-icon.guild { background: radial-gradient(circle at 35% 28%, #eaf4ba, #78a78a 52%, #405c47); }
.bottom-nav-icon.race { background: radial-gradient(circle at 35% 28%, #f4df86, #bf8174 52%, #68413a); }
.loot-toast {
  position: absolute;
  left: 50%;
  top: 84px;
  transform: translateX(-50%);
  padding: 8px 14px;
  border: 2px solid #fff1a8;
  border-radius: 12px;
  background: rgba(76, 111, 77, .94);
  color: #fff7bf;
  font-size: 12px;
  pointer-events: none;
}

.item-detail-backdrop {
  position: fixed;
  inset: 0;
  z-index: 21;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(37, 25, 18, .62);
}
.item-detail-panel {
  width: min(420px, 100%);
  padding: 16px;
  border: 4px solid #9a6332;
  border-radius: 16px;
  background: linear-gradient(180deg, #fff3d1, #e7ca94);
  box-shadow: 0 12px 36px rgba(27, 18, 12, .5), inset 0 0 0 2px #fff7dc;
  color: #58391f;
}
.item-detail-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #c39b57;
  padding-bottom: 10px;
}
.item-detail-heading h2 { margin: 4px 0 0; font-size: 20px; }
.item-rarity { font-size: 11px; font-weight: 800; }
.rarity-Huyền-thoại, .rarity-Huyền { color: #a14ac7; }
.item-detail-close {
  width: 32px;
  height: 32px;
  border: 2px solid #8e542c;
  border-radius: 8px;
  background: linear-gradient(#bf7540, #8e462e);
  color: #fff2ca;
  font-size: 23px;
  line-height: 1;
}
.item-detail-body {
  display: grid;
  grid-template-columns: 110px 1fr;
  align-items: center;
  gap: 12px;
  min-height: 130px;
  padding: 12px 0;
}
.item-detail-body img {
  width: 100px;
  height: 100px;
  object-fit: contain;
  border: 2px solid #b8955b;
  border-radius: 12px;
  background: #fff7dc;
}
.item-detail-body p { margin: 6px 0 0; font-size: 13px; line-height: 1.5; }
.item-detail-actions { display: flex; justify-content: flex-end; gap: 8px; }
.item-detail-actions button {
  min-height: 38px;
  padding: 7px 12px;
  border: 2px solid #88612e;
  border-radius: 9px;
  background: linear-gradient(#ffe48b, #dba75a);
  color: #59391f;
  font-weight: 800;
}
.item-detail-remove, .item-detail-close-action {
  background: linear-gradient(#f3dfbc, #cda970) !important;
}

.quick-panel-backdrop {
  position: fixed;
  inset: 0;
  z-index: 22;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(37, 25, 18, .62);
  pointer-events: auto;
}
.quick-panel {
  width: min(460px, 100%);
  padding: 16px;
  border: 4px solid #9a6332;
  border-radius: 16px;
  background: linear-gradient(180deg, #fff3d1, #e3c58a);
  box-shadow: 0 12px 36px rgba(27, 18, 12, .5), inset 0 0 0 2px #fff7dc;
  color: #58391f;
}
.quick-panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 10px;
  border-bottom: 2px solid #c39b57;
}
.quick-panel-heading h2 { margin: 3px 0 0; }
.quick-panel-heading span { font-size: 10px; color: #9a6b38; }
.quick-panel-heading button {
  width: 32px;
  height: 32px;
  border: 2px solid #8e542c;
  border-radius: 8px;
  background: linear-gradient(#bf7540, #8e462e);
  color: #fff2ca;
  font-size: 23px;
}
.quick-panel-list {
  display: grid;
  gap: 8px;
  padding: 12px 0;
}
.quick-panel-list button {
  min-height: 64px;
  display: grid;
  grid-template-columns: 52px 1fr;
  align-items: center;
  gap: 10px;
  text-align: left;
  border: 2px solid #c39b57;
  border-radius: 10px;
  background: linear-gradient(145deg, #fff8dc, #dcc38f);
  color: #644323;
}
.quick-panel-list img { width: 46px; height: 46px; object-fit: contain; justify-self: center; }
.quick-panel-list strong, .quick-panel-list span { display: block; }
.quick-panel-list span { margin-top: 4px; color: #80613d; font-size: 11px; }
.quick-panel footer { display: flex; justify-content: flex-end; }
.quick-panel footer button {
  min-height: 38px;
  padding: 7px 14px;
  border: 2px solid #88612e;
  border-radius: 9px;
  background: linear-gradient(#f3dfbc, #cda970);
  color: #59391f;
  font-weight: 800;
}

.profile-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 24;
  display: flex;
  background: rgba(26, 18, 14, .62);
  pointer-events: auto;
}
.profile-drawer {
  width: min(220px, 44vw);
  height: 100%;
  overflow-y: auto;
  padding: 10px 8px;
  border: 4px solid #aa7a43;
  border-left: 0;
  border-radius: 0 16px 16px 0;
  background:
    linear-gradient(90deg, rgba(255, 222, 152, .08) 1px, transparent 1px) 0 0 / 24px 100%,
    linear-gradient(180deg, #714b2d, #3f2a1e);
  box-shadow: 8px 0 24px rgba(24, 15, 10, .5), inset -3px 0 0 rgba(255, 220, 147, .3);
  color: #fff0cb;
  pointer-events: auto;
}
.profile-drawer-heading {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  border: 2px solid #c59c5e;
  border-radius: 10px;
  background: linear-gradient(#a77a48, #68472e);
}
.profile-drawer-heading > img {
  width: 42px;
  height: 42px;
  object-fit: contain;
  border: 2px solid #f4d791;
  border-radius: 8px;
  background: #e7c889;
}
.profile-drawer-heading strong, .profile-drawer-heading span { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.profile-drawer-heading strong { color: #fff2c9; font-size: 11px; }
.profile-drawer-heading span { margin-top: 3px; color: #ebd5a5; font-size: 8px; }
.profile-drawer-heading button {
  width: 26px;
  height: 26px;
  border: 1px solid #f3d58f;
  border-radius: 50%;
  background: #8c4c2b;
  color: #fff3d3;
  font-size: 19px;
}
.profile-drawer-id {
  margin: 8px 2px;
  padding: 6px;
  border: 1px solid rgba(239, 209, 147, .5);
  border-radius: 6px;
  background: rgba(41, 28, 20, .48);
  color: #e4c99b;
  font-size: 9px;
  text-align: center;
}
.profile-drawer-menu { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.profile-drawer-menu button {
  min-width: 0;
  min-height: 64px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 2px;
  padding: 4px 2px;
  border: 1px solid #bd8f53;
  border-radius: 8px;
  background: linear-gradient(145deg, #8b633d, #5c3c28);
  color: #fff0c8;
  text-shadow: 0 1px 2px #392316;
}
.profile-drawer-menu button > span { font-size: 22px; line-height: 1; }
.profile-drawer-menu button > strong {
  max-width: 100%;
  display: -webkit-box;
  overflow: hidden;
  font-size: 8px;
  line-height: 1.05;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.mount-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(37, 25, 18, .62);
  pointer-events: auto;
}
.mount-panel {
  width: min(520px, 100%);
  padding: 16px;
  border: 4px solid #9a6332;
  border-radius: 16px;
  background: linear-gradient(180deg, #f8edcc, #e6cb91);
  box-shadow: 0 12px 36px rgba(27, 18, 12, .5), inset 0 0 0 2px #fff3cc;
  color: #58391f;
}
.mount-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 12px;
  border-bottom: 2px solid #c39b57;
}
.mount-heading h2 {
  margin: 0;
  color: #744721;
  font-size: 20px;
}
.mount-heading p {
  margin: 4px 0 0;
  color: #795c38;
  font-size: 12px;
}
.mount-close {
  width: 32px;
  height: 32px;
  border: 2px solid #8e542c;
  border-radius: 8px;
  background: linear-gradient(#bf7540, #8e462e);
  color: #fff2ca;
  font-size: 23px;
  line-height: 1;
}
.mount-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 14px 0;
}
.mount-option {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 0;
  padding: 12px 8px 10px;
  border: 2px solid #c59d59;
  border-radius: 12px;
  background: linear-gradient(145deg, #fff8df, #e7d19f);
  color: #644323;
  box-shadow: inset 0 1px 0 #fff;
}
.mount-option.selected {
  border-color: #9e6828;
  background: linear-gradient(145deg, #fff1b6, #e8ba5b);
  box-shadow: 0 0 0 2px #f7d780, inset 0 1px 0 #fff;
}
.mount-option img {
  width: 112px;
  height: 100px;
  object-fit: contain;
}
.mount-option strong { font-size: 13px; }
.mount-option small { color: #805d34; font-size: 10px; }
.mount-progression-links {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 2px 0 10px;
}
.mount-progression-links a {
  flex: 1 1 30%;
  min-width: 90px;
  padding: 6px;
  border: 1px solid #c19a5c;
  border-radius: 7px;
  background: linear-gradient(#fff0c8, #dfc28a);
  color: #684728;
  font-size: 9px;
  font-weight: 800;
  text-align: center;
  text-decoration: none;
}
.mount-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 34px;
}
.remove-mount {
  padding: 7px 10px;
  border: 2px solid #b78a50;
  border-radius: 8px;
  background: #f8e6ba;
  color: #704927;
  font-size: 11px;
  font-weight: 800;
}
.mount-footer p {
  margin: 0;
  color: #70502d;
  font-size: 10px;
  text-align: right;
}

@media (max-aspect-ratio: 4 / 5) {
  .battle-hud {
    top: 7px;
    left: 7px;
    right: 7px;
    height: 96px;
    grid-template-columns: 170px minmax(120px, 1fr) 160px 74px;
    gap: 8px;
    padding: 7px 8px;
  }
  .top-nav { display: none; }
  .portrait-server-meta {
    display: grid;
    position: absolute;
    top: 8px;
    right: 8px;
    justify-items: end;
    z-index: 2;
    pointer-events: none;
  }
  .portrait-server-meta strong {
    font-size: 10px;
    color: #fff8cf;
  }
  .portrait-server-meta span {
    margin-top: 2px;
    font-size: 8px;
    color: #d9ebdc;
  }
  .portrait-hud-actions {
    display: flex;
    position: absolute;
    left: 50%;
    bottom: -40px;
    transform: translateX(-50%);
    z-index: 3;
    gap: 5px;
  }
  .portrait-hud-actions a,
  .portrait-hud-actions button {
    min-width: 74px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 2px solid #d5b267;
    border-radius: 8px;
    background: linear-gradient(#a8753d, #70472b);
    box-shadow: 0 3px 0 #4e3423;
    color: #fff3c8;
    text-decoration: none;
    font-size: 9px;
    font-weight: 900;
  }
  .portrait { width: 48px; height: 48px; }
  .player-bars { gap: 4px; }
  .hp-mini, .mp-mini { padding: 7px 5px; }

  .combat-status {
    top: 108px;
    left: 8px;
    max-width: calc(100% - 16px);
    gap: 4px;
  }
  .target-chip {
    min-width: 94px;
    height: 48px;
  }

  .bottom-console {
    bottom: 78px;
    width: calc(100% - 10px);
  }
  .skill-row {
    height: 82px;
    gap: 7px;
  }
  .auto-toggle { width: 68px; height: 68px; }
  .skill-orb { width: 60px; height: 60px; }

  .inventory-strip {
    min-height: 292px;
    padding: 6px 8px 8px;
  }
  .equipment-row {
    grid-template-columns: repeat(7, minmax(58px, 1fr));
    gap: 4px;
    overflow-x: auto;
  }
  .equipment-card { min-height: 58px; }
  .item-grid {
    grid-template-columns: repeat(8, 1fr);
    grid-template-rows: repeat(2, 64px);
    gap: 4px;
  }
  .item-icon { width: 42px; height: 42px; }

  .bottom-nav { height: 76px; }
  .bottom-nav-icon { width: 46px; height: 46px; }
  .bottom-nav strong { font-size: 11px; }

  .portrait-battle-enter {
    display: block;
    position: absolute;
    left: 50%;
    top: 38%;
    transform: translate(-50%, -50%);
    min-width: 230px;
    height: 48px;
    border: 3px solid #f3df9e;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255, 244, 188, .95), rgba(224, 184, 94, .95));
    box-shadow: 0 5px 0 #9a672f, 0 8px 18px rgba(58, 38, 22, .38);
    color: #65421f;
    font-family: inherit;
    font-size: 16px;
    font-weight: 900;
    text-shadow: 0 1px #fff4cb;
  }
  .portrait-left-actions,
  .portrait-right-actions {
    display: grid;
    position: absolute;
    top: 31%;
    z-index: 4;
    gap: 8px;
  }
  .portrait-left-actions { left: 8px; }
  .portrait-right-actions { right: 8px; }
  .portrait-left-actions button,
  .portrait-right-actions button {
    position: relative;
    width: 64px;
    height: 64px;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 2px;
    padding: 4px;
    border: 2px solid #cfae66;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(255, 246, 204, .96), rgba(203, 161, 91, .96));
    box-shadow: 0 3px 0 #7a5030;
    color: #60421f;
  }
  .portrait-left-actions button::after,
  .portrait-right-actions button::after {
    content: '';
    position: absolute;
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    border: 2px solid #fff2ba;
    border-radius: 50%;
    background: #ce4a35;
    box-shadow: 0 2px 4px rgba(75, 43, 25, .45);
  }
  .portrait-left-actions img,
  .portrait-right-actions img {
    width: 38px;
    height: 38px;
    object-fit: contain;
  }
  .portrait-left-actions strong,
  .portrait-right-actions strong {
    max-width: 58px;
    overflow: hidden;
    font-size: 8px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

@media (max-width: 700px) {
  .battle-hud {
    grid-template-columns: minmax(112px, 1fr) minmax(90px, 1.15fr) auto;
    grid-template-rows: 30px 16px;
    height: 68px;
    gap: 0 6px;
    padding: 4px 7px;
  }
  .player-identity { grid-column: 1; grid-row: 1 / 3; gap: 6px; }
  .player-identity strong { font-size: 11px; }
  .player-identity span { font-size: 9px; }
  .portrait { width: 38px; height: 38px; font-size: 20px; }
  .header-bar { grid-column: 2; grid-row: 1; align-self: center; }
  .exp-label { margin-bottom: 2px; font-size: 8px; }
  .exp-track { height: 7px; }
  .player-bars {
    display: grid;
    grid-column: 2 / 4;
    grid-row: 2;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
  }
  .hp-mini, .mp-mini { padding: 2px 4px; border-width: 1px; border-radius: 5px; font-size: 8px; }
  .gold-pill { grid-column: 3; grid-row: 1; align-self: start; padding: 3px 5px; font-size: 9px; }
  .top-nav a, .top-nav button { font-size: 8px; padding: 7px 5px; }
  .portrait-server-meta { display: none; }
  .combat-status { top: 76px; left: 8px; }
  .target-chip { min-width: 58px; height: 42px; padding: 4px; }
  .target-chip strong { display: none; }
  .target-portrait { flex-basis: 30px; width: 30px; height: 30px; }
  .target-portrait img { width: 27px; height: 27px; }
  .bottom-console { left: 0; bottom: 94px; width: 100%; transform: none; }
  .skill-row { height: 60px; gap: 3px; margin-bottom: 1px; align-items: center; justify-content: space-around; }
  .auto-toggle { width: 52px; height: 52px; border-width: 3px; }
  .auto-toggle strong { font-size: 13px; }
  .skill-orb { width: 45px; height: 45px; border-width: 3px; }
  .orb-icon { width: 30px; height: 30px; font-size: 16px; }
  .skill-orb small { bottom: -7px; min-width: 34px; padding: 1px 3px; font-size: 7px; }
  .inventory-strip {
    min-height: 280px;
    padding: 5px 8px 8px;
    border-radius: 14px 14px 6px 6px;
  }
  .strip-tabs { height: 24px; }
  .equipment-row { display: none; }
  .item-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
    grid-template-rows: repeat(3, 60px);
    gap: 4px;
  }
  .item-slot:nth-child(n + 17) { display: block; }
  .item-slot { border-radius: 6px; }
  .item-icon { width: 44px; height: 44px; }
  .item-name { display: none; }

  .portrait-console-footer {
    display: grid;
    min-height: 104px;
    grid-template-columns: minmax(102px, .8fr) minmax(0, 1.2fr) minmax(68px, .55fr);
    grid-template-rows: 24px minmax(58px, 1fr);
    gap: 4px;
    padding: 5px 6px 7px;
    border: 3px solid #6f472b;
    border-top: 0;
    background:
      linear-gradient(90deg, rgba(255, 216, 145, .08) 1px, transparent 1px) 0 0 / 28px 100%,
      linear-gradient(#5c3c28, #37251c);
    box-shadow: inset 0 2px 0 rgba(255, 221, 151, .35);
  }
  .portrait-quest {
    display: grid;
    grid-column: 1;
    grid-row: 2;
    align-content: center;
    gap: 5px;
    padding: 7px;
    border: 2px solid #a47743;
    border-radius: 8px;
    background: rgba(32, 24, 19, .65);
    color: #ffe6b1;
    text-align: left;
  }
  .portrait-quest strong { font-size: 11px; }
  .portrait-quest > span { color: #e8c994; font-size: 10px; }
  .quest-progress-track { height: 6px; overflow: hidden; border-radius: 6px; background: #261b16; }
  .quest-progress-track i { display: block; height: 100%; border-radius: inherit; background: #70ce76; }
  .portrait-chat {
    display: grid;
    grid-column: 1 / 4;
    grid-row: 1;
    grid-template-columns: auto minmax(0, 1fr);
    align-content: center;
    align-items: center;
    gap: 5px;
    min-width: 0;
    padding: 3px 6px;
    border: 1px solid rgba(206, 164, 101, .55);
    border-radius: 6px;
    background: rgba(31, 22, 17, .55);
    color: #f1dfbf;
    font-size: 10px;
  }
  .portrait-chat span { overflow: hidden; color: #d7a24f; text-overflow: ellipsis; white-space: nowrap; }
  .portrait-forge {
    display: grid;
    grid-column: 2;
    grid-row: 2;
    grid-template-columns: 44px 1fr;
    grid-template-rows: 1fr 1fr;
    align-items: center;
    gap: 0 5px;
    min-width: 0;
    padding: 3px 6px;
    border: 3px solid #e0b257;
    border-radius: 14px;
    background:
      radial-gradient(ellipse at 28% 50%, rgba(255, 224, 123, .75), transparent 55%),
      linear-gradient(145deg, #8b5a31, #49301f);
    box-shadow: 0 3px 0 #342219, inset 0 0 0 2px rgba(255, 239, 183, .28);
    color: #fff0b5;
    text-align: left;
  }
  .portrait-forge > span { grid-row: 1 / 3; font-size: 37px; filter: drop-shadow(0 2px 2px #321d12); }
  .portrait-forge strong { align-self: end; font-size: 11px; }
  .portrait-forge small { align-self: start; color: #e8c994; font-size: 8px; }
  .portrait-footer-actions {
    display: grid;
    grid-column: 3;
    grid-row: 2;
    grid-template-columns: 1fr;
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 3px;
  }
  .portrait-footer-actions button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    padding: 2px;
    border: 1px solid #9a713f;
    border-radius: 6px;
    background: linear-gradient(#755233, #48301f);
    color: #f9e3b2;
    font-size: 7px;
  }
  .portrait-footer-actions span { color: #ffd775; font-size: 13px; }

  .bottom-nav { height: 94px; }
  .bottom-nav button, .bottom-nav a { height: 82px; }
  .bottom-nav-icon { width: 50px; height: 50px; }
  .bottom-nav-icon img { width: 46px; height: 46px; }
  .bottom-nav strong { font-size: 10px; }

  .portrait-battle-enter {
    top: 19%;
    min-width: 150px;
    height: 42px;
    font-size: 11px;
  }
  .portrait-left-actions,
  .portrait-right-actions { top: 11%; gap: 5px; }
  .portrait-left-actions { left: 3px; }
  .portrait-right-actions { right: 3px; }
  .portrait-left-actions button,
  .portrait-right-actions button {
    width: 50px;
    height: 54px;
  }
  .portrait-left-actions img,
  .portrait-right-actions img {
    width: 29px;
    height: 29px;
  }
  .portrait-left-actions strong,
  .portrait-right-actions strong {
    display: block;
    max-width: 46px;
    font-size: 7px;
  }

  .mount-backdrop {
    align-items: end;
    padding: 8px;
  }
  .mount-panel {
    width: 100%;
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    border-radius: 18px;
  }
  .mount-options {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .mount-option img {
    width: 78px;
    height: 72px;
  }
}
</style>
