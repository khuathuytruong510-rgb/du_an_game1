<template>
  <main class="progression-page">
    <header class="progression-header">
      <div class="progression-resources">
        <span>🪙 {{ player.gold.toLocaleString('vi-VN') }}</span>
        <span>{{ feature === 'mount' ? '🔑' : '✦' }} {{ tokenCount }}</span>
      </div>
      <RouterLink class="progression-close" to="/" aria-label="Đóng">×</RouterLink>
      <div class="progression-ribbon"><h1>{{ screenTitle }}</h1></div>
    </header>

    <section class="progression-content">
      <template v-if="feature === 'mount' && activeTab === 'upgrade'">
        <div class="mount-stage">
          <span class="stage-label">{{ selectedMount.name }} · Bậc 1</span>
          <div class="mount-stage-glow"></div>
          <img :src="selectedMount.image" :alt="selectedMount.name" />
          <button type="button" class="stage-arrow stage-prev" aria-label="Thú cưỡi trước" @click="cycleMount(-1)">‹</button>
          <button type="button" class="stage-arrow stage-next" aria-label="Thú cưỡi tiếp theo" @click="cycleMount(1)">›</button>
          <span class="stage-tier">Bậc 1</span>
        </div>
        <section class="stat-panel">
          <header><img :src="selectedMount.image" :alt="selectedMount.name" /><div><strong>{{ selectedMount.name }}</strong><span>Thú cưỡi hiện tại</span></div><strong class="stat-next">Bậc kế tiếp</strong></header>
          <div class="stat-compare" v-for="stat in mountStats" :key="stat.name">
            <span>{{ stat.name }}</span><strong>{{ stat.current }}</strong><b>››</b><strong>{{ stat.next }}</strong>
          </div>
        </section>
        <div class="star-progress">
          <div class="star-row"><span v-for="star in 8" :key="star" :class="{ lit: star <= 1 }">★</span></div>
          <div class="progress-caption"><strong>Tiến độ chúc phúc</strong><span>{{ mountProgress }}/8</span></div>
          <div class="progress-track"><i :style="{ width: `${mountProgress / 8 * 100}%` }"></i></div>
        </div>
        <div class="token-row"><span>🔑 Phiếu nâng cấp</span><strong>{{ tokenCount }}</strong><span class="token-separator">·</span><span>Yêu cầu minh họa: 1</span></div>
        <div class="progression-actions">
          <button type="button" class="action-primary" @click="showPreview('Nâng cấp thú cưỡi đang ở chế độ xem trước.')">Nâng cấp</button>
          <button type="button" class="action-green" @click="showPreview('Cho ăn chỉ là thao tác minh họa, không dùng vật phẩm.')">Cho ăn</button>
        </div>
      </template>

      <template v-else-if="feature === 'mount' && activeTab === 'empower'">
        <div class="empower-stage">
          <img :src="selectedMount.image" :alt="selectedMount.name" />
          <div class="empower-orbit"><span>◇</span></div>
          <p>Hiệu ứng áp dụng cho mọi thú cưỡi</p>
        </div>
        <div class="empower-levels">
          <article v-for="buff in mountBuffs" :key="buff.name">
            <span>{{ buff.icon }}</span><strong>Cấp {{ buff.level }}</strong><small>{{ buff.name }}</small><b>+{{ buff.bonus }}%</b>
          </article>
        </div>
        <section class="empower-summary">
          <strong>Tổng cấp cường hóa · Lv.0</strong>
          <span>Tỉ lệ thành công minh họa: 100%</span>
          <small>Một thuộc tính được chọn ngẫu nhiên trong bản mô phỏng.</small>
        </section>
        <div class="token-row"><span>✦ Mảnh cường hóa</span><strong>{{ tokenCount }}</strong></div>
        <div class="progression-actions">
          <button type="button" class="action-green" @click="showPreview('Cường hóa chưa thay đổi chỉ số thú cưỡi.')">Cường hóa</button>
          <button type="button" class="action-green" @click="showPreview('Cường hóa nhanh chỉ là bản xem trước.')">Cường hóa nhanh</button>
        </div>
      </template>

      <template v-else-if="feature === 'mount' && activeTab === 'advanced'">
        <div class="mount-stage advanced-stage">
          <span class="stage-label">Thú cưỡi huyền thoại</span>
          <div class="mount-stage-glow"></div>
          <img src="/assets/supplied/mount-ice-dragon.png" alt="Rồng Băng" />
          <div class="advanced-stars">★★★★★</div>
        </div>
        <section class="ability-panel">
          <h2>Kỹ năng thú cưỡi</h2>
          <div class="ability-row"><img src="/assets/item-sword.svg" alt="" /><div><strong>Hơi Thở Băng</strong><span>Kỹ năng minh họa · chưa áp dụng vào chiến đấu</span></div></div>
        </section>
        <section class="stat-panel effect-panel">
          <h2>Hiệu ứng sở hữu</h2>
          <div class="stat-compare"><span>Sinh lực toàn đội</span><strong>0%</strong><b>››</b><strong>+8%</strong></div>
          <button type="button" class="action-green" @click="showPreview('Mở khóa thú cưỡi chưa được kết nối.')">Xem điều kiện mở khóa</button>
        </section>
        <div class="collection-strip">
          <button v-for="mount in mountCollection" :key="mount.name" type="button" :class="{ selected: mount.name === 'Rồng Băng' }" @click="showPreview(`${mount.name}: bộ sưu tập xem trước.`)">
            <img :src="mount.image" :alt="mount.name" /><span>{{ mount.name }}</span><small v-if="mount.locked">Khóa</small>
          </button>
        </div>
      </template>

      <template v-else-if="feature === 'mount'">
        <div class="mount-stage appearance-stage">
          <span class="stage-label">{{ selectedMount.name }} · Ngoại hình</span>
          <div class="mount-stage-glow"></div>
          <img :src="selectedMount.image" :alt="selectedMount.name" />
          <span class="stage-tier">Xem trước</span>
        </div>
        <section class="reward-preview">
          <h2>Phần thưởng hành trình</h2>
          <div><img v-for="reward in appearanceRewards" :key="reward" :src="reward" alt="Vật phẩm minh họa" /></div>
        </section>
        <section class="stat-panel appearance-stats">
          <h2>Cấp cải trang thú cưỡi</h2>
          <div class="stat-compare"><span>Cấp</span><strong>1</strong><b>››</b><strong>2</strong></div>
          <div class="stat-compare" v-for="stat in appearanceStats" :key="stat"><span>{{ stat }}</span><strong>0%</strong><b>››</b><strong>+8%</strong></div>
          <div class="progress-track"><i style="width: 20%"></i></div>
          <button type="button" class="action-small" @click="showPreview('EXP thú cưỡi chưa được cộng trong bản xem trước.')">＋</button>
        </section>
        <div class="collection-strip">
          <button v-for="mount in mountCollection" :key="mount.name" type="button" :class="{ selected: mount.name === selectedMount.name }" @click="selectMountPreview(mount.name)">
            <img :src="mount.image" :alt="mount.name" /><span>{{ mount.name }}</span><small v-if="mount.locked">Khóa</small>
          </button>
        </div>
      </template>

      <template v-else-if="feature === 'artifact' && activeTab === 'upgrade'">
        <div class="artifact-stage">
          <span class="stage-label">Kiếm Sao Mai</span>
          <div class="artifact-glow"></div>
          <img src="/assets/item-sword.svg" alt="Kiếm Sao Mai" />
          <span class="artifact-level">Cấp 1 · nâng cấp xem trước</span>
        </div>
        <section class="stat-panel">
          <header><img src="/assets/item-sword.svg" alt="" /><div><strong>Kiếm Sao Mai</strong><span>Thần khí minh họa</span></div><strong class="stat-next">Cấp kế tiếp</strong></header>
          <div class="stat-compare" v-for="stat in artifactStats" :key="stat.name">
            <span>{{ stat.name }}</span><strong>{{ stat.current }}</strong><b>››</b><strong>{{ stat.next }}</strong>
          </div>
          <div class="artifact-exp"><span>Cấp 1</span><div class="progress-track"><i style="width: 18%"></i></div><span>0/4</span></div>
        </section>
        <div class="token-row"><span>🔨 Búa tinh luyện</span><strong>{{ tokenCount }}</strong><span>Yêu cầu minh họa: 1</span></div>
        <div class="progression-actions">
          <button type="button" class="action-green" @click="showPreview('Nâng cấp thần khí chưa thay đổi chỉ số.')">Nâng cấp</button>
          <button type="button" class="action-green" @click="showPreview('Tự động rèn hiện chưa được kết nối.')">Tự động rèn</button>
        </div>
      </template>

      <template v-else-if="feature === 'artifact' && activeTab === 'enchant'">
        <section class="enchant-board">
          <div class="enchant-wheel">
            <button v-for="slot in 6" :key="slot" type="button" :aria-label="`Ô phụ ma ${slot}`" @click="showPreview('Ô phụ ma trống trong bản xem trước.')">＋</button>
            <div class="enchant-core"><img src="/assets/item-sword.svg" alt="Thần khí" /></div>
          </div>
          <span class="enchant-info" aria-label="Thông tin phụ ma">i</span>
        </section>
        <section class="enchant-empty">
          <img src="/assets/hero-mushroom.svg" alt="" />
          <p>Chưa có phụ ma được trang bị</p>
        </section>
        <button type="button" class="action-green enchant-action" @click="showPreview('Thay đổi phụ ma chưa được kết nối.')">Thay đổi phụ ma</button>
      </template>

      <template v-else>
        <div class="artifact-stage morph-stage">
          <span class="stage-label">Lưỡi Sao Băng</span>
          <div class="artifact-glow"></div>
          <img src="/assets/item-sword.svg" alt="Lưỡi Sao Băng" />
          <span class="artifact-level">Hình thái · Xem trước</span>
        </div>
        <section class="ability-panel">
          <h2>Kỹ năng ngoại hình</h2>
          <div class="ability-row"><img src="/assets/item-shard.svg" alt="" /><div><strong>Vệt Sao</strong><span>Hiệu ứng hình ảnh minh họa</span></div></div>
        </section>
        <section class="stat-panel effect-panel">
          <h2>Hiệu ứng sở hữu</h2>
          <div class="stat-compare"><span>Sức tấn công toàn đội</span><strong>0%</strong><b>››</b><strong>+10%</strong></div>
          <button type="button" class="action-green" @click="showPreview('Mở khóa hình thái chưa được kết nối.')">Xem điều kiện mở khóa</button>
        </section>
        <div class="collection-strip">
          <button v-for="item in artifactCollection" :key="item.name" type="button" :class="{ selected: item.name === 'Lưỡi Sao' }" @click="showPreview(`${item.name}: hình thái xem trước.`)">
            <img :src="item.image" :alt="item.name" /><span>{{ item.name }}</span><small v-if="item.locked">Khóa</small>
          </button>
        </div>
      </template>

      <p class="progression-notice" role="status">{{ notice }}</p>
    </section>

    <nav class="progression-tabs" :aria-label="feature === 'mount' ? 'Thú cưỡi' : 'Thần khí'">
      <button v-for="tab in activeTabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="selectTab(tab.id)">
        {{ tab.label }}
      </button>
    </nav>
    <nav class="progression-global-nav" aria-label="Điều hướng game">
      <RouterLink to="/inventory?tab=skills"><span>🧙</span><strong>Nhân vật</strong></RouterLink>
      <RouterLink to="/inventory?tab=companions"><span>🐾</span><strong>Đồng hành</strong></RouterLink>
      <RouterLink to="/activities?screen=world"><span>🧭</span><strong>Phó bản</strong></RouterLink>
      <RouterLink to="/activities?screen=farm"><span>🌱</span><strong>Gia viên</strong></RouterLink>
      <RouterLink to="/activities?screen=guild"><span>🏰</span><strong>Gia tộc</strong></RouterLink>
      <RouterLink to="/" aria-label="Đóng"><span>✕</span><strong>Đóng</strong></RouterLink>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'

type Feature = 'mount' | 'artifact'
type Tab = 'upgrade' | 'empower' | 'advanced' | 'appearance' | 'enchant' | 'morph'
type ProgressionTab = { id: Tab; label: string }

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const notice = ref('Các chỉ số và thao tác trong màn hình này chỉ mang tính minh họa.')
const mountIndex = ref(0)
const mountProgress = ref(0)
const mountCollection = [
  { name: 'Rồng Băng', image: '/assets/supplied/mount-ice-dragon.png', locked: false },
  { name: 'Ếch Cơ Giới', image: '/assets/supplied/mount-mechanical-frog.png', locked: true },
  { name: 'Kỵ Sĩ Mây', image: '/assets/hero-scout.svg', locked: true },
  { name: 'Bạn Nấm', image: '/assets/supplied/mushroom-companion.png', locked: true },
  { name: 'Kiếm Sao', image: '/assets/item-sword.svg', locked: true },
  { name: 'Tinh Thạch', image: '/assets/item-shard.svg', locked: true }
]
const artifactCollection = [
  { name: 'Lưỡi Sao', image: '/assets/item-sword.svg', locked: false },
  { name: 'Bùa Lá', image: '/assets/item-necklace.svg', locked: true },
  { name: 'Nhẫn Rừng', image: '/assets/item-ring.svg', locked: true },
  { name: 'Giáp Bình Minh', image: '/assets/item-armor.svg', locked: true },
  { name: 'Mảnh Tinh Vân', image: '/assets/item-shard.svg', locked: true },
  { name: 'Bình Sao', image: '/assets/item-potion.svg', locked: true }
]
const mountStats = [
  { name: 'Sinh lực', current: '+5%', next: '+8%' },
  { name: 'Tấn công', current: '+5%', next: '+8%' },
  { name: 'Phòng thủ', current: '+5%', next: '+8%' }
]
const mountBuffs = [
  { name: 'Đòn đánh thường', icon: '⚔️', level: 0, bonus: 0 },
  { name: 'Sát thương đồng hành', icon: '🐾', level: 0, bonus: 0 },
  { name: 'Sát thương kỹ năng', icon: '✦', level: 0, bonus: 0 }
]
const appearanceRewards = ['/assets/item-ring.svg', '/assets/item-helmet.svg', '/assets/item-potion.svg', '/assets/item-shard.svg']
const appearanceStats = ['Tấn công cộng', 'Sinh lực cộng', 'Phòng thủ cộng']
const artifactStats = [
  { name: 'Sinh lực', current: '+7%', next: '+12%' },
  { name: 'Tấn công', current: '+7%', next: '+12%' },
  { name: 'Phòng thủ', current: '+7%', next: '+12%' }
]
const mountOptions = [
  { name: 'Rồng Băng', image: '/assets/supplied/mount-ice-dragon.png' },
  { name: 'Ếch Cơ Giới', image: '/assets/supplied/mount-mechanical-frog.png' }
]
const feature = computed<Feature>(() => route.query.feature === 'artifact' ? 'artifact' : 'mount')
const activeTabs = computed<ProgressionTab[]>(() => feature.value === 'mount'
  ? [
      { id: 'upgrade', label: 'Nâng cấp' },
      { id: 'empower', label: 'Cường hóa' },
      { id: 'advanced', label: 'Thú cưỡi bậc cao' },
      { id: 'appearance', label: 'Cải trang' }
    ]
  : [
      { id: 'upgrade', label: 'Thần khí nâng cấp' },
      { id: 'enchant', label: 'Thần khí phụ ma' },
      { id: 'morph', label: 'Thần khí hóa hình' }
    ])
const activeTab = computed<Tab>(() =>
  activeTabs.value.find(tab => tab.id === route.query.tab)?.id ?? 'upgrade'
)
const selectedMount = computed(() => mountOptions[mountIndex.value])
const tokenCount = computed(() =>
  player.inventory
    .filter(item => item.name.toLowerCase().includes('linh thạch') || item.name.toLowerCase().includes('phiếu'))
    .reduce((total, item) => total + item.quantity, 0)
)
const expToNextLevel = computed(() => 100 * player.level * player.level)
const expProgress = computed(() => Math.min(100, player.exp / expToNextLevel.value * 100))
const screenTitle = computed(() => {
  if (feature.value === 'mount') {
    return {
      upgrade: 'Thú Cưỡi · Nâng Cấp',
      empower: 'Thú Cưỡi · Cường Hóa',
      advanced: 'Thú Cưỡi Bậc Cao',
      appearance: 'Thú Cưỡi · Cải Trang'
    }[activeTab.value as 'upgrade' | 'empower' | 'advanced' | 'appearance']
  }
  return {
    upgrade: 'Thần Khí',
    enchant: 'Thần Khí · Phụ Ma',
    morph: 'Thần Khí · Hóa Hình'
  }[activeTab.value as 'upgrade' | 'enchant' | 'morph']
})

const selectTab = (tab: Tab) => {
  notice.value = 'Các chỉ số và thao tác trong màn hình này chỉ mang tính minh họa.'
  void router.replace({ path: '/progression', query: { feature: feature.value, tab } })
}
const cycleMount = (step: number) => {
  mountIndex.value = (mountIndex.value + step + mountOptions.length) % mountOptions.length
}
const selectMountPreview = (name: string) => {
  const index = mountOptions.findIndex(mount => mount.name === name)
  if (index >= 0) mountIndex.value = index
  else notice.value = `${name}: bộ sưu tập xem trước, chưa mở khóa.`
}
const showPreview = (message: string) => {
  notice.value = message
}
</script>

<style scoped>
.progression-page {
  --wood: #49301f;
  --gold: #f1ce7b;
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  width: min(620px, 100%);
  height: 100dvh;
  min-height: 0;
  margin: 0 auto;
  overflow: hidden;
  color: #fff0cb;
  background:
    linear-gradient(90deg, rgba(28, 17, 11, .38), transparent 12%, transparent 88%, rgba(28, 17, 11, .38)),
    repeating-linear-gradient(90deg, #714b2d 0 42px, #835832 43px 46px, #573a25 47px 52px);
  box-shadow: inset 0 0 0 4px #a27342, inset 0 0 0 7px #3c291f;
  font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif;
}
.progression-header {
  position: relative;
  flex: 0 0 82px;
  display: grid;
  place-items: center;
  border-bottom: 4px solid #6c472b;
  background:
    radial-gradient(ellipse at 50% 20%, rgba(255, 213, 122, .24), transparent 53%),
    linear-gradient(180deg, #60402b, #3e2a20);
}
.progression-resources { position: absolute; z-index: 1; top: 5px; left: 10px; display: flex; gap: 5px; }
.progression-resources span { min-width: 62px; padding: 2px 7px; border: 1px solid #c09a5a; border-radius: 12px; background: rgba(41, 28, 19, .8); font-size: 9px; font-weight: 900; }
.progression-close { position: absolute; z-index: 2; top: 5px; right: 7px; width: 30px; height: 30px; display: grid; place-items: center; border: 2px solid #ebc976; border-radius: 50%; background: linear-gradient(#a56a39, #56381f); color: #fff1c8; font-size: 22px; text-decoration: none; }
.progression-ribbon { width: min(76%, 420px); margin-top: 16px; padding: 6px 12px; border: 3px solid #c87b43; border-radius: 8px; background: linear-gradient(90deg, #b74b36, #dc6545 45%, #a7372b); box-shadow: 0 4px 0 #472a1f, inset 0 0 0 2px rgba(255, 217, 153, .35); text-align: center; }
.progression-ribbon h1 { margin: 0; color: #ffe88d; font-size: 18px; text-shadow: 0 2px 1px #772b22; }
.progression-content { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 8px 10px; background: linear-gradient(rgba(49, 32, 22, .1), rgba(38, 24, 16, .26)); scrollbar-color: #b1844c #4d321f; }
.mount-stage, .artifact-stage {
  position: relative;
  min-height: 220px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 4px solid #d5ab56;
  border-radius: 15px 15px 6px 6px;
  background:
    radial-gradient(ellipse at 50% 73%, rgba(240, 255, 176, .83), transparent 40%),
    linear-gradient(180deg, #49b98e, #8bd1a3 58%, #60bad1 59%, #86d4dc);
  box-shadow: inset 0 0 0 3px #fff0a8, 0 4px 0 #4c3020;
}
.stage-label { position: absolute; z-index: 2; top: 8px; left: 8px; padding: 5px 10px; border: 2px solid #dabd7b; border-radius: 7px; background: #62432b; color: #fff0c7; font-size: 10px; font-weight: 900; }
.mount-stage-glow, .artifact-glow { position: absolute; top: 8%; width: 220px; height: 180px; border: 10px solid rgba(224, 255, 137, .4); border-radius: 50%; background: rgba(214, 255, 154, .13); box-shadow: 0 0 25px rgba(230, 255, 147, .8), inset 0 0 25px rgba(255,255,255,.35); }
.mount-stage > img { position: relative; z-index: 1; width: 70%; height: 185px; object-fit: contain; filter: drop-shadow(0 6px 5px rgba(37, 28, 16, .46)); }
.stage-arrow { position: absolute; z-index: 3; top: 48%; width: 31px; height: 40px; border: 0; background: transparent; color: #fff0af; font-size: 34px; text-shadow: 0 2px 3px #58391f; }
.stage-prev { left: 5px; }
.stage-next { right: 5px; }
.stage-tier { position: absolute; z-index: 2; right: 7px; top: 12px; padding: 5px 8px; border: 1px solid #e8ca78; border-radius: 6px; background: #48798a; font-size: 9px; font-weight: 900; }
.stat-panel, .star-progress, .empower-summary, .ability-panel, .reward-preview, .enchant-empty {
  margin-top: 7px;
  padding: 8px;
  border: 2px solid #d3b879;
  border-radius: 8px;
  background: linear-gradient(135deg, #f8edcc, #e4d2a6);
  color: #61472d;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.48);
}
.stat-panel > header { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 6px; padding-bottom: 6px; border-bottom: 1px solid #c9ab6e; }
.stat-panel > header img { width: 40px; height: 40px; object-fit: contain; padding: 2px; border: 1px solid #ba9656; border-radius: 6px; background: #f7dfad; }
.stat-panel > header strong, .stat-panel > header span { display: block; }
.stat-panel > header div strong { font-size: 11px; }
.stat-panel > header div span { margin-top: 2px; color: #886b46; font-size: 8px; }
.stat-next { color: #a36323; font-size: 9px; }
.stat-compare { min-height: 24px; display: grid; grid-template-columns: 1.15fr .7fr 24px .7fr; align-items: center; gap: 4px; padding: 2px 4px; border-bottom: 1px solid rgba(151, 116, 65, .25); font-size: 9px; }
.stat-compare b { color: #ca7224; font-size: 15px; text-align: center; }
.stat-compare > strong:last-child { color: #9c5d22; }
.star-progress { padding: 4px 8px 7px; }
.star-row { display: flex; justify-content: center; gap: 4px; color: #725d43; font-size: 22px; text-shadow: 0 1px #fff; }
.star-row .lit { color: #ffd454; }
.progress-caption { display: flex; justify-content: space-between; margin: 2px 2px 3px; font-size: 9px; }
.progress-track { height: 12px; overflow: hidden; border: 2px solid #6a4930; border-radius: 8px; background: #4a3326; }
.progress-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #5fc96e, #d6e85f); }
.token-row { min-height: 31px; display: flex; align-items: center; gap: 6px; padding: 4px 8px; color: #fce9bd; font-size: 9px; }
.token-row strong { color: #ffd268; font-size: 12px; }
.token-separator { color: #c89b5b; }
.progression-actions { display: flex; justify-content: center; gap: 10px; padding: 2px 10px 6px; }
.action-primary, .action-green {
  min-width: 118px;
  min-height: 37px;
  padding: 5px 12px;
  border: 3px solid #e7d080;
  border-radius: 22px;
  background: linear-gradient(#9bd33c, #548a25);
  box-shadow: 0 3px 0 #49351f, inset 0 0 0 2px rgba(255,255,255,.3);
  color: #fffceb;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  text-shadow: 0 2px 1px #45601e;
}
.action-primary { background: linear-gradient(#f2c65a, #c47a28); text-shadow: 0 2px 1px #70401e; }
.progression-notice { min-height: 17px; margin: 0; color: #ffdda0; font-size: 8px; text-align: center; }
.empower-stage { position: relative; min-height: 210px; display: grid; place-items: center; overflow: hidden; border: 4px solid #d0a956; border-radius: 12px; background: radial-gradient(circle, #f8df8c, #bd8f42 61%, #634126); }
.empower-stage > img { position: relative; z-index: 1; width: 110px; height: 105px; object-fit: contain; filter: drop-shadow(0 5px 5px #47301d); }
.empower-orbit { position: absolute; width: 190px; height: 170px; display: grid; place-items: center; border: 9px solid rgba(255, 223, 123, .75); border-radius: 50%; box-shadow: 0 0 22px #ffe793, inset 0 0 20px #fff2b0; color: #7d4c20; font-size: 45px; }
.empower-stage p { position: absolute; bottom: 3px; z-index: 2; margin: 0; padding: 4px 12px; border-radius: 10px; background: rgba(70, 47, 31, .75); color: #fff2d0; font-size: 9px; }
.empower-levels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-top: 7px; }
.empower-levels article { min-width: 0; display: grid; justify-items: center; gap: 3px; padding: 7px 3px; border: 2px solid #c8a562; border-radius: 8px; background: linear-gradient(#f5e5bb, #d7bd85); color: #644829; text-align: center; }
.empower-levels article > span { font-size: 19px; }
.empower-levels article strong { font-size: 9px; }
.empower-levels article small { min-height: 20px; font-size: 7px; }
.empower-levels article b { color: #54863b; font-size: 10px; }
.empower-summary { display: grid; justify-items: center; gap: 4px; min-height: 72px; }
.empower-summary strong { color: #6b8c2c; font-size: 11px; }
.empower-summary span { font-size: 10px; }
.empower-summary small { color: #856744; font-size: 8px; }
.advanced-stage { min-height: 235px; }
.advanced-stage > img { width: 75%; height: 200px; }
.advanced-stars { position: absolute; top: 10px; right: 12px; z-index: 2; color: #ffd252; font-size: 15px; text-shadow: 0 2px #4f321e; }
.ability-panel h2, .effect-panel h2, .reward-preview h2, .appearance-stats h2 { margin: 0 0 6px; color: #76512d; font-size: 10px; }
.ability-row { display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 7px; min-height: 52px; border-top: 1px solid rgba(145, 105, 53, .28); }
.ability-row img { width: 40px; height: 40px; object-fit: contain; padding: 3px; border: 2px solid #c19b5c; border-radius: 7px; background: #f5dfad; }
.ability-row strong, .ability-row span { display: block; }
.ability-row strong { font-size: 10px; }
.ability-row span { margin-top: 3px; color: #806243; font-size: 8px; }
.effect-panel .action-green { display: block; min-height: 31px; margin: 5px auto 0; font-size: 9px; }
.collection-strip { display: flex; gap: 5px; overflow-x: auto; margin: 7px 0; padding-bottom: 4px; scrollbar-color: #bb8b4d #543821; }
.collection-strip button { position: relative; flex: 0 0 67px; min-height: 64px; display: grid; justify-items: center; align-content: center; gap: 2px; padding: 3px; border: 2px solid #aa9b80; border-radius: 6px; background: linear-gradient(#b8b2a1, #716b5e); color: #fff1ce; }
.collection-strip button.selected { border-color: #ffc94d; background: linear-gradient(#ffdf80, #b87932); }
.collection-strip img { width: 39px; height: 37px; object-fit: contain; }
.collection-strip span { max-width: 100%; overflow: hidden; font-size: 7px; white-space: nowrap; text-overflow: ellipsis; }
.collection-strip small { position: absolute; top: 0; right: 1px; color: #fff7dd; font-size: 7px; }
.appearance-stage { min-height: 195px; background: radial-gradient(ellipse at 54% 83%, #c9df81, transparent 37%), linear-gradient(#d0a969, #f1d395); }
.appearance-stage .mount-stage-glow { border-color: rgba(171, 224, 101, .35); }
.appearance-stage > img { height: 160px; }
.reward-preview > div { display: flex; gap: 6px; overflow-x: auto; }
.reward-preview img { flex: 0 0 48px; width: 48px; height: 48px; object-fit: contain; padding: 4px; border: 2px solid #c19c60; border-radius: 8px; background: #fff1c9; }
.appearance-stats .progress-track { margin-top: 6px; }
.action-small { float: right; width: 26px; height: 26px; margin-top: -20px; border: 2px solid #fff0b0; border-radius: 50%; background: #9a6b30; color: #fff2c9; font-size: 18px; }
.artifact-stage { min-height: 245px; background: radial-gradient(ellipse at 50% 74%, rgba(135, 255, 213, .86), transparent 45%), linear-gradient(155deg, #9270d3, #77bada 56%, #4bd2a0); }
.artifact-glow { top: 10%; width: 205px; height: 175px; border-color: rgba(131, 255, 213, .46); }
.artifact-stage > img { position: relative; z-index: 1; width: 145px; height: 150px; object-fit: contain; filter: drop-shadow(0 6px 7px rgba(43, 26, 18, .52)); transform: rotate(-24deg); }
.artifact-level { position: absolute; z-index: 2; bottom: 8px; color: #fff8df; font-size: 9px; font-weight: 900; text-shadow: 0 2px 2px #41301c; }
.artifact-exp { display: grid; grid-template-columns: 30px 1fr 30px; align-items: center; gap: 5px; margin-top: 6px; font-size: 8px; }
.enchant-board { position: relative; min-height: 300px; display: grid; place-items: center; overflow: hidden; border: 4px solid #a4773e; border-radius: 12px; background: radial-gradient(circle, #b77c31, #6c3e22 67%, #4a2d1f); }
.enchant-board::before { content: ""; position: absolute; inset: 14px; border: 5px solid #dfb44e; border-radius: 50%; background: radial-gradient(circle, #6e4524, #ad712a 58%, #5d351d); box-shadow: 0 0 25px #f4c754, inset 0 0 20px rgba(255, 215, 91, .55); }
.enchant-wheel { position: relative; z-index: 1; width: 250px; height: 250px; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); place-items: center; }
.enchant-wheel > button { width: 55px; height: 55px; border: 4px solid #c78c34; border-radius: 50%; background: radial-gradient(circle at 35% 25%, #885627, #3e281b); color: #fff0bc; font-size: 27px; box-shadow: 0 3px 0 #37241a, inset 0 0 0 2px #e6be65; }
.enchant-wheel > button:nth-child(1) { grid-area: 1 / 2; }
.enchant-wheel > button:nth-child(2) { grid-area: 2 / 3; }
.enchant-wheel > button:nth-child(3) { grid-area: 3 / 2; }
.enchant-wheel > button:nth-child(4) { grid-area: 2 / 1; }
.enchant-wheel > button:nth-child(5) { grid-area: 1 / 1; }
.enchant-wheel > button:nth-child(6) { grid-area: 3 / 3; }
.enchant-core { grid-area: 2 / 2; width: 72px; height: 72px; display: grid; place-items: center; border: 4px solid #f1c84f; border-radius: 50%; background: radial-gradient(circle, #ffe690, #a96721); box-shadow: 0 0 18px #f6ca52; }
.enchant-core img { width: 55px; height: 55px; object-fit: contain; }
.enchant-info { position: absolute; top: 9px; right: 10px; width: 23px; height: 23px; display: grid; place-items: center; border: 2px solid #fff0b4; border-radius: 50%; background: #9b6630; font-weight: 900; }
.enchant-empty { min-height: 165px; display: grid; justify-items: center; align-content: center; gap: 5px; }
.enchant-empty img { width: 74px; height: 74px; object-fit: contain; opacity: .48; }
.enchant-empty p { margin: 0; padding: 5px 14px; border-radius: 12px; background: #c9b18b; color: #725638; font-size: 9px; }
.enchant-action { display: block; margin: 7px auto; }
.morph-stage { min-height: 220px; }
.morph-stage > img { width: 120px; }
.progression-tabs {
  flex: 0 0 49px;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 8px;
  border-top: 3px solid #bd8d4a;
  background: linear-gradient(#4e321f, #36241a);
  scrollbar-width: none;
}
.progression-tabs::-webkit-scrollbar { display: none; }
.progression-tabs button { flex: 1 0 auto; min-width: 72px; padding: 5px; border: 2px solid #a57840; border-radius: 6px; background: linear-gradient(#75604d, #4b3b2e); color: #f2dfbd; font: inherit; font-size: 8px; font-weight: 900; white-space: nowrap; }
.progression-tabs button.active { border-color: #f3d16f; background: linear-gradient(#c56f35, #7a3d25); color: #fff0c2; }
.progression-global-nav { flex: 0 0 78px; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); align-items: end; gap: 2px; padding: 5px 4px 3px; border-top: 4px solid #b68a4c; background: linear-gradient(#755032, #39271e); box-shadow: 0 -5px 18px rgba(34, 21, 13, .48), inset 0 3px 0 #dfb56d; }
.progression-global-nav a { min-width: 0; height: 65px; display: grid; justify-items: center; align-content: end; gap: 2px; color: #fff1ce; text-decoration: none; text-shadow: 0 2px 2px #322115; }
.progression-global-nav a > span { width: 42px; height: 42px; display: grid; place-items: center; border: 3px solid #d3a85e; border-radius: 50%; background: radial-gradient(circle at 35% 25%, #fff1bd, #96643c 58%, #4f3525); font-size: 22px; }
.progression-global-nav a > strong { max-width: 100%; overflow: hidden; font-size: 9px; white-space: nowrap; text-overflow: ellipsis; }
@media (max-width: 420px) {
  .progression-header { flex-basis: 74px; }
  .progression-content { padding-right: 7px; padding-left: 7px; }
  .mount-stage { min-height: 188px; }
  .mount-stage > img { height: 155px; }
  .stat-panel { padding: 6px; }
  .stat-compare { grid-template-columns: 1.1fr .65fr 20px .65fr; gap: 2px; font-size: 8px; }
  .star-row { font-size: 18px; }
  .progression-tabs { flex-basis: 46px; padding-right: 4px; padding-left: 4px; }
  .progression-tabs button { min-width: 66px; font-size: 7px; }
  .progression-global-nav { flex-basis: 76px; }
  .progression-global-nav a > span { width: 38px; height: 38px; font-size: 20px; }
  .progression-global-nav a > strong { font-size: 8px; }
  .enchant-wheel { transform: scale(.9); }
}
</style>
