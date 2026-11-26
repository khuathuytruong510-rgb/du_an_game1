<template>
  <main class="activities-page">
    <header class="activity-player-bar">
      <div class="activity-player">
        <img
          :src="player.playerAvatar === 'hero-scout' ? '/assets/hero-scout.svg' : '/assets/hero-mushroom.svg'"
          :alt="player.playerName"
        />
        <div>
          <strong>{{ player.playerName }}</strong>
          <span>Cấp {{ player.level }} · HP {{ player.hp }}/{{ player.maxHp }}</span>
        </div>
      </div>
      <div class="activity-resources">
        <span>🪙 {{ player.gold.toLocaleString('vi-VN') }}</span>
        <span>✦ {{ spiritShards }}</span>
      </div>
      <RouterLink class="activity-close" to="/" aria-label="Quay lại chiến trường">×</RouterLink>
    </header>

    <section class="activity-stage" :class="`screen-${screen}`">
      <div class="activity-title">
        <span>✦</span>
        <h1>{{ screenTitle }}</h1>
        <span>✦</span>
      </div>

      <nav class="activity-shortcuts" aria-label="Khu vực hoạt động">
        <button
          v-for="item in screenOptions"
          :key="item.id"
          type="button"
          :class="{ active: screen === item.id }"
          :aria-current="screen === item.id ? 'page' : undefined"
          @click="selectScreen(item.id)"
        >
          <span>{{ item.icon }}</span>{{ item.label }}
        </button>
      </nav>

      <section v-if="screen === 'lantern'" class="activity-content lantern-screen">
        <div class="lantern-level">
          <strong>Đèn cấp {{ player.level }}</strong>
          <span>››</span>
          <strong>Cấp {{ player.level + 1 }}</strong>
        </div>

        <div class="lantern-rate-heading">
          <span>Phẩm chất</span>
          <span>Hiện tại</span>
          <span>Sau nâng cấp</span>
        </div>
        <div class="lantern-rate-list" role="table" aria-label="Tỷ lệ phẩm chất minh họa">
          <div v-for="rate in lanternRates" :key="rate.name" class="lantern-rate-row" :class="`rate-${rate.tone}`" role="row">
            <strong role="cell">{{ rate.name }}</strong>
            <span role="cell">{{ rate.current.toFixed(2) }}%</span>
            <span role="cell">{{ rate.next.toFixed(2) }}%</span>
          </div>
        </div>

        <div class="lantern-offer">
          <div class="lantern-flame" aria-hidden="true">✦</div>
          <div>
            <strong>Ánh sáng kế tiếp</strong>
            <span>Thử vận may với phần thưởng ngẫu nhiên</span>
          </div>
          <button type="button" @click="showLanternPreview">Xem thử</button>
        </div>

        <div class="lantern-actions">
          <p>Đây là bản xem trước. Nâng cấp chưa tác động đến dữ liệu nhân vật.</p>
          <button type="button" class="activity-primary" @click="showLanternPreview">Thử nâng cấp</button>
        </div>
      </section>

      <section v-else-if="screen === 'farm'" class="activity-content farm-screen">
        <header class="section-caption">
          <div><strong>Vườn Mây</strong><span>Chăm sóc luống cây và thu hoạch</span></div>
          <span class="farm-day">Ngày {{ player.level }}</span>
        </header>
        <div class="farm-overview">
          <div class="farm-illustration" aria-hidden="true"><span>☀</span><span>☁</span><span>🌿</span></div>
          <p>Vườn thử nghiệm <strong>·</strong> Sản lượng không cộng vào túi đồ</p>
        </div>
        <div class="farm-plots">
          <article v-for="plot in farmPlots" :key="plot.id" class="farm-plot" :class="`plot-${plot.status}`">
            <template v-if="plot.status !== 'locked'">
              <span class="plot-status">{{ plot.status === 'ready' ? 'Sẵn sàng' : plot.status === 'growing' ? 'Đang lớn' : 'Đã thu hoạch' }}</span>
              <div class="crop-display" aria-hidden="true">
                <span>{{ plot.crop }}</span>
                <img :src="plot.icon" alt="" />
              </div>
              <strong>{{ plot.name }}</strong>
              <button type="button" :disabled="plot.status !== 'ready'" @click="harvestPlot(plot.id)">
                {{ plot.status === 'ready' ? 'Thu hoạch' : plot.status === 'growing' ? 'Còn 02:15' : 'Đã thu hoạch' }}
              </button>
            </template>
            <template v-else>
              <span class="plot-locked-icon" aria-hidden="true">⌑</span>
              <strong>Luống bị khóa</strong>
              <small>Mở ở cấp {{ plot.unlockLevel }}</small>
            </template>
          </article>
        </div>
        <p class="activity-notice" role="status">{{ activityNotice }}</p>
      </section>

      <section v-else-if="screen === 'world'" class="activity-content map-screen world-map-screen">
        <header class="section-caption map-caption">
          <div><strong>Thung lũng Ánh Dương</strong><span>Chọn địa điểm để khám phá</span></div>
          <span class="map-coordinate">Khu {{ player.level }} · Phía Đông</span>
        </header>
        <div class="map-board world-map">
          <div class="map-river" aria-hidden="true"></div>
          <div class="map-trail" aria-hidden="true"></div>
          <button
            v-for="location in worldLocations"
            :key="location.name"
            type="button"
            class="map-location"
            :class="`location-${location.tone}`"
            :style="{ left: location.x, top: location.y }"
            @click="visitLocation(location)"
          >
            <span>{{ location.icon }}</span>
            <strong>{{ location.name }}</strong>
          </button>
          <div class="map-player-marker"><img src="/assets/hero-mushroom.svg" alt="" /><span>{{ player.playerName }}</span></div>
          <span class="map-compass" aria-label="Hướng bắc">N<br>▲</span>
        </div>
        <p class="activity-notice" role="status">{{ activityNotice }}</p>
      </section>

      <section v-else class="activity-content map-screen guild-map-screen">
        <header class="section-caption map-caption">
          <div><strong>Thung lũng Hội Tụ</strong><span>Khu sinh hoạt cộng đồng</span></div>
          <span class="map-coordinate">Cổng hội · Cấp {{ player.level }}</span>
        </header>
        <div class="map-board guild-map">
          <div class="guild-path" aria-hidden="true"></div>
          <button
            v-for="location in guildLocations"
            :key="location.name"
            type="button"
            class="map-location guild-location"
            :class="`location-${location.tone}`"
            :style="{ left: location.x, top: location.y }"
            @click="visitLocation(location)"
          >
            <span>{{ location.icon }}</span>
            <strong>{{ location.name }}</strong>
          </button>
          <div class="map-player-marker"><img src="/assets/hero-scout.svg" alt="" /><span>{{ player.playerName }}</span></div>
        </div>
        <p class="activity-notice" role="status">{{ activityNotice }}</p>
      </section>
    </section>

    <nav class="activity-bottom-nav" aria-label="Điều hướng game">
      <RouterLink to="/inventory?tab=skills">
        <span>🧙</span><strong>Nhân vật</strong>
      </RouterLink>
      <RouterLink to="/inventory?tab=companions">
        <span>🐾</span><strong>Đồng hành</strong>
      </RouterLink>
      <button type="button" :class="{ active: screen === 'world' }" @click="selectScreen('world')">
        <span>🧭</span><strong>Thế giới</strong>
      </button>
      <button type="button" :class="{ active: screen === 'farm' }" @click="selectScreen('farm')">
        <span>🌱</span><strong>Nông trại</strong>
      </button>
      <button type="button" :class="{ active: screen === 'guild' }" @click="selectScreen('guild')">
        <span>🏰</span><strong>Gia tộc</strong>
      </button>
      <button type="button" :class="{ active: screen === 'lantern' }" @click="selectScreen('lantern')">
        <span>🏮</span><strong>Đèn thần</strong>
      </button>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'

type ActivityScreen = 'lantern' | 'farm' | 'world' | 'guild'
type MapLocation = {
  name: string
  icon: string
  x: string
  y: string
  tone: 'forest' | 'stone' | 'water' | 'gold'
  target?: ActivityScreen
}
type FarmPlot = {
  id: string
  name: string
  crop: string
  icon: string
  unlockLevel: number
  status: 'ready' | 'growing' | 'harvested' | 'locked'
}

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const activityNotice = ref('Các hoạt động trong màn hình này là bản xem trước.')
const screenOptions: Array<{ id: ActivityScreen; label: string; icon: string }> = [
  { id: 'world', label: 'Thế giới', icon: '🧭' },
  { id: 'farm', label: 'Nông trại', icon: '🌱' },
  { id: 'guild', label: 'Gia tộc', icon: '🏰' },
  { id: 'lantern', label: 'Đèn thần', icon: '🏮' }
]
const screen = computed<ActivityScreen>(() => {
  const requestedScreen = route.query.screen
  return screenOptions.some(item => item.id === requestedScreen)
    ? requestedScreen as ActivityScreen
    : 'world'
})
const screenTitle = computed(() => ({
  lantern: 'Đèn Thần',
  farm: 'Nông Trại',
  world: 'Thế Giới',
  guild: 'Gia Tộc'
})[screen.value])
const spiritShards = computed(() =>
  player.inventory
    .filter(item => item.name.toLowerCase().includes('linh thạch'))
    .reduce((total, item) => total + item.quantity, 0)
)
const lanternRates = [
  { name: 'Phổ thông', current: 72, next: 66, tone: 'common' },
  { name: 'Tinh luyện', current: 21, next: 25, tone: 'fine' },
  { name: 'Linh khí', current: 5.5, next: 7, tone: 'spirit' },
  { name: 'Hiếm', current: 1.3, next: 1.7, tone: 'rare' },
  { name: 'Cổ vật', current: 0.2, next: 0.3, tone: 'relic' }
]
const farmPlots = ref<FarmPlot[]>([
  { id: 'sunroot', name: 'Củ nắng', crop: '🌼', icon: '/assets/item-potion.svg', unlockLevel: 1, status: 'ready' },
  { id: 'blueberry', name: 'Quả lam', crop: '🫐', icon: '/assets/item-shard.svg', unlockLevel: 1, status: 'ready' },
  { id: 'moonleaf', name: 'Lá trăng', crop: '🌿', icon: '/assets/item-ring.svg', unlockLevel: 3, status: 'growing' },
  { id: 'starfruit', name: 'Khế sao', crop: '⭐', icon: '/assets/item-shard.svg', unlockLevel: 5, status: 'locked' },
  { id: 'crystal-herb', name: 'Thảo tinh', crop: '🍃', icon: '/assets/item-necklace.svg', unlockLevel: 8, status: 'locked' },
  { id: 'golden-seed', name: 'Hạt vàng', crop: '🌱', icon: '/assets/item-ring.svg', unlockLevel: 12, status: 'locked' }
])
const worldLocations: MapLocation[] = [
  { name: 'Trại Gió', icon: '⛺', x: '14%', y: '18%', tone: 'gold' },
  { name: 'Rừng Thì Thầm', icon: '🌳', x: '67%', y: '15%', tone: 'forest' },
  { name: 'Đền Bình Minh', icon: '✦', x: '36%', y: '36%', tone: 'gold', target: 'lantern' },
  { name: 'Cầu Suối Lam', icon: '🌉', x: '73%', y: '43%', tone: 'water' },
  { name: 'Vườn Mây', icon: '🌱', x: '24%', y: '63%', tone: 'forest', target: 'farm' },
  { name: 'Cổng Hội Tụ', icon: '🏰', x: '67%', y: '76%', tone: 'stone', target: 'guild' }
]
const guildLocations: MapLocation[] = [
  { name: 'Sảnh Hội', icon: '🏛️', x: '49%', y: '16%', tone: 'gold' },
  { name: 'Tháp Canh', icon: '🗼', x: '15%', y: '36%', tone: 'stone' },
  { name: 'Vòng Thử Thách', icon: '⚔️', x: '79%', y: '39%', tone: 'gold' },
  { name: 'Suối Tĩnh Tâm', icon: '💧', x: '34%', y: '62%', tone: 'water' },
  { name: 'Cổng Hành Trình', icon: '🌀', x: '70%', y: '72%', tone: 'water' }
]

const selectScreen = (nextScreen: ActivityScreen) => {
  activityNotice.value = 'Các hoạt động trong màn hình này là bản xem trước.'
  void router.replace({ query: { ...route.query, screen: nextScreen } })
}
const visitLocation = (location: MapLocation) => {
  if (location.target) {
    selectScreen(location.target)
    return
  }
  activityNotice.value = `${location.name}: địa điểm xem trước, chưa có nhiệm vụ kết nối.`
}
const harvestPlot = (plotId: string) => {
  const plot = farmPlots.value.find(item => item.id === plotId)
  if (!plot) return
  if (plot.status !== 'ready') {
    activityNotice.value = plot.status === 'locked'
      ? `Mở luống ở cấp ${plot.unlockLevel}.`
      : 'Luống này chưa sẵn sàng thu hoạch.'
    return
  }
  plot.status = 'harvested'
  activityNotice.value = `Đã thu hoạch thử ${plot.name}; tài nguyên chưa được cộng vào túi đồ.`
}
const showLanternPreview = () => {
  activityNotice.value = 'Nâng cấp đèn thần chưa kết nối với tiến trình nhân vật.'
}
</script>

<style>
.activities-page {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  width: min(620px, 100%);
  height: 100dvh;
  min-height: 0;
  margin: 0 auto;
  padding: 8px 10px 0;
  overflow: hidden;
  color: #fff0cb;
  background:
    linear-gradient(90deg, rgba(37, 21, 12, .55), transparent 8%, transparent 92%, rgba(37, 21, 12, .55)),
    repeating-linear-gradient(90deg, #67432b 0 42px, #704a2e 43px 45px, #5c3a26 46px 50px);
  box-shadow: inset 0 0 0 4px #9f7041, inset 0 0 0 7px #422b20;
}

.activity-player-bar {
  display: flex;
  flex: 0 0 54px;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 2px solid #e8c77d;
  border-radius: 12px;
  background: linear-gradient(180deg, #70513a, #422d23);
  box-shadow: 0 3px 0 #342219, inset 0 0 0 2px rgba(255, 242, 205, .18);
}

.activity-player {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.activity-player img {
  width: 40px;
  height: 40px;
  padding: 2px;
  border: 2px solid #f3d37e;
  border-radius: 50%;
  background: #d3a66d;
  object-fit: contain;
}

.activity-player strong,
.activity-player span {
  display: block;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-player strong { font-size: 13px; }
.activity-player span { color: #e4d3b2; font-size: 10px; }

.activity-resources {
  display: grid;
  gap: 2px;
  color: #ffe797;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.activity-close {
  display: grid;
  flex: 0 0 34px;
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

.activity-stage {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  gap: 7px;
  padding: 7px 4px;
}

.activity-title {
  display: flex;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  gap: 18px;
  border: 3px solid #f1c776;
  border-radius: 12px;
  background: linear-gradient(180deg, #d86f4a, #9f3f32);
  box-shadow: 0 4px 0 #5f3023, inset 0 0 0 2px rgba(255, 232, 171, .26);
  color: #fff0a5;
  text-shadow: 0 2px 2px #7f3429;
}

.activity-title h1 { margin: 0; font-size: 21px; }
.activity-title span { color: #ffe7a0; }

.activity-shortcuts {
  display: grid;
  flex: 0 0 38px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.activity-shortcuts button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  padding: 3px 5px;
  border: 2px solid #a87d4b;
  border-radius: 8px;
  background: linear-gradient(#725239, #4a3223);
  color: #f5e1b5;
  font-size: 10px;
  font-weight: 800;
}

.activity-shortcuts button.active {
  border-color: #ffe3a1;
  background: linear-gradient(#be8140, #80512f);
  color: #fff5d0;
}

.activity-shortcuts button span { font-size: 14px; }

.activity-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 3px solid #b78a50;
  border-radius: 13px;
  background: linear-gradient(180deg, #f8edcc, #e6cb91);
  box-shadow: inset 0 0 0 2px #fff3cc, 0 3px 0 #4e3221;
  color: #60442b;
}

.section-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 2px solid #c39b57;
  color: #694522;
}

.section-caption strong,
.section-caption span { display: block; }
.section-caption strong { font-size: 15px; }
.section-caption span { margin-top: 2px; color: #856744; font-size: 10px; }
.farm-day, .map-coordinate { flex: 0 0 auto; padding: 5px 8px; border-radius: 14px; background: #805633; color: #fff0c2 !important; }

.lantern-screen {
  gap: 7px;
  padding: 10px;
  overflow-y: auto;
}

.lantern-level {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 2px solid #ba9156;
  border-radius: 8px;
  background: #fff3d4;
  color: #6b4727;
  text-align: center;
}

.lantern-level strong { font-size: 12px; }
.lantern-level span { color: #bb7132; font-size: 19px; font-weight: 900; }

.lantern-rate-heading,
.lantern-rate-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(64px, 1fr) minmax(75px, 1fr);
  align-items: center;
  gap: 4px;
}

.lantern-rate-heading {
  padding: 5px 8px;
  color: #786143;
  font-size: 9px;
  font-weight: 900;
  text-align: center;
}

.lantern-rate-row {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, .66);
  border-radius: 18px;
  color: white;
  font-size: 11px;
  text-align: center;
  text-shadow: 0 1px 2px rgba(25, 24, 21, .5);
}

.lantern-rate-row strong { text-align: left; }
.rate-common { background: linear-gradient(90deg, #90918c, #777972); }
.rate-fine { background: linear-gradient(90deg, #4a9d77, #68aa79); }
.rate-spirit { background: linear-gradient(90deg, #5d82bf, #8294bd); }
.rate-rare { background: linear-gradient(90deg, #9562a5, #b27db0); }
.rate-relic { background: linear-gradient(90deg, #c89740, #d8b857); }

.lantern-offer {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 3px;
  padding: 9px;
  border: 2px solid #c9a46d;
  border-radius: 10px;
  background: #f4dfb5;
}

.lantern-flame {
  display: grid;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 2px solid #e8bf76;
  border-radius: 50%;
  background: radial-gradient(circle, #ffeb9b, #ed9746 66%, #bd593b);
  color: #fff9d1;
  font-size: 23px;
}

.lantern-offer div:nth-child(2) { flex: 1; min-width: 0; }
.lantern-offer strong, .lantern-offer span { display: block; }
.lantern-offer strong { color: #674526; font-size: 12px; }
.lantern-offer span { margin-top: 3px; color: #856a47; font-size: 9px; }
.lantern-offer button { padding: 6px 9px; border: 1px solid #8e6335; border-radius: 7px; background: #825535; color: #fff1c8; font-size: 10px; }

.lantern-actions {
  display: grid;
  gap: 8px;
  margin-top: auto;
  padding: 10px 4px 2px;
}

.lantern-actions p { margin: 0; color: #876744; font-size: 10px; text-align: center; }
.activity-primary {
  min-height: 42px;
  border: 3px solid #f0d48a;
  border-radius: 22px;
  background: linear-gradient(#85bd3b, #4a8529);
  box-shadow: 0 3px 0 #604027, inset 0 0 0 2px rgba(255,255,255,.25);
  color: white;
  font-size: 15px;
  font-weight: 900;
  text-shadow: 0 2px 2px rgba(0,0,0,.4);
}

.farm-screen { gap: 8px; }
.farm-overview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  border-bottom: 1px solid #cfb17a;
}

.farm-overview p { margin: 0; color: #795a36; font-size: 10px; }
.farm-overview p strong { color: #75a24e; }
.farm-illustration { display: flex; align-items: end; gap: 3px; font-size: 22px; }
.farm-illustration span:nth-child(2) { font-size: 16px; }

.farm-plots {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(110px, 1fr));
  gap: 8px;
  min-height: 0;
  padding: 7px 9px;
}

.farm-plot {
  display: flex;
  position: relative;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 5px;
  border: 2px solid #b7975e;
  border-radius: 12px;
  background:
    radial-gradient(ellipse at 50% 80%, #74462c 0 35%, transparent 36%),
    linear-gradient(180deg, #f3e5bd, #c9aa71);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.42), 0 3px 0 #78512e;
  text-align: center;
}

.farm-plot strong { color: #fff5cf; font-size: 10px; text-shadow: 0 1px 2px #573821; }
.farm-plot small { color: #f5e5c4; font-size: 9px; text-shadow: 0 1px 2px #573821; }
.plot-status { position: absolute; top: 4px; color: #f7f1dc; font-size: 8px; text-shadow: 0 1px 2px #49311d; }

.crop-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-height: 48px;
}

.crop-display span { font-size: 24px; filter: drop-shadow(0 2px 2px rgba(34, 24, 12, .4)); }
.crop-display img { width: 34px; height: 34px; object-fit: contain; }
.farm-plot button { width: 100%; padding: 5px 2px; border: 1px solid #e8cb85; border-radius: 14px; background: linear-gradient(#6f9c48, #477236); color: #fff6d8; font-size: 9px; font-weight: 900; }
.farm-plot button:disabled { opacity: .68; }
.plot-growing { filter: saturate(.82); }
.plot-harvested { opacity: .72; }
.plot-locked { background: linear-gradient(145deg, #b6a883, #81765b); }
.plot-locked-icon { color: #f3e3b9; font-size: 28px; }

.activity-notice {
  flex: 0 0 23px;
  margin: 0;
  padding: 4px 8px;
  overflow: hidden;
  border-top: 1px solid #cfb17a;
  color: #795a36;
  font-size: 9px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-screen { gap: 0; }
.map-caption { flex: 0 0 52px; }
.map-board {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 8px;
  overflow: hidden;
  border: 3px solid #8b683b;
  border-radius: 15px;
  background:
    radial-gradient(ellipse at 13% 16%, #aacd73 0 13%, transparent 14%),
    radial-gradient(ellipse at 83% 19%, #90b95e 0 19%, transparent 20%),
    radial-gradient(ellipse at 15% 70%, #8db65d 0 20%, transparent 21%),
    radial-gradient(ellipse at 88% 78%, #adc873 0 18%, transparent 19%),
    linear-gradient(155deg, #d7d995 0%, #a9c876 45%, #e1d49a 46%, #cbd287 100%);
  box-shadow: inset 0 0 0 3px rgba(255, 239, 191, .45), 0 4px 0 #68482c;
}

.map-river {
  position: absolute;
  top: -12%;
  left: 44%;
  width: 19%;
  height: 128%;
  border: 5px solid rgba(236, 232, 183, .6);
  border-radius: 48%;
  background: linear-gradient(90deg, #55b9bd, #8bdbd1 48%, #48a9b5);
  transform: rotate(17deg);
  box-shadow: 0 0 0 2px rgba(41, 118, 124, .35);
}

.map-trail,
.guild-path {
  position: absolute;
  top: 8%;
  left: 30%;
  width: 40%;
  height: 85%;
  border: 13px solid transparent;
  border-left-color: #f0d699;
  border-bottom-color: #f0d699;
  border-radius: 46%;
  transform: rotate(-17deg);
  filter: drop-shadow(0 2px 1px rgba(104, 78, 42, .35));
}

.map-location {
  position: absolute;
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 74px;
  max-width: 112px;
  padding: 5px 7px;
  border: 2px solid #f1d394;
  border-radius: 12px;
  background: linear-gradient(#986b3e, #60402b);
  box-shadow: 0 3px 0 #46301e, inset 0 0 0 1px rgba(255,255,255,.2);
  color: #fff1c7;
  transform: translate(-50%, -50%);
}

.map-location span { font-size: 23px; line-height: 1; }
.map-location strong { max-width: 100%; overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.location-water { border-color: #c1e3cf; background: linear-gradient(#5f9a91, #35666c); }
.location-stone { background: linear-gradient(#81745d, #4e4437); }
.location-gold { background: linear-gradient(#b68143, #76502b); }
.map-player-marker {
  position: absolute;
  z-index: 3;
  left: 49%;
  top: 52%;
  display: grid;
  justify-items: center;
  transform: translate(-50%, -50%);
}

.map-player-marker img {
  width: 54px;
  height: 62px;
  object-fit: contain;
  filter: drop-shadow(0 3px 2px rgba(35, 44, 26, .5));
}

.map-player-marker span {
  max-width: 100px;
  padding: 2px 6px;
  border: 1px solid #ead08b;
  border-radius: 9px;
  background: #385e3b;
  color: #fff1b7;
  font-size: 8px;
  white-space: nowrap;
}

.map-compass {
  position: absolute;
  top: 8px;
  right: 9px;
  color: #fbf0d1;
  font-size: 10px;
  font-weight: 900;
  text-align: center;
  text-shadow: 0 1px 2px #495332;
}

.guild-map {
  background:
    radial-gradient(ellipse at 50% 20%, #f1dc9f 0 12%, transparent 13%),
    radial-gradient(ellipse at 18% 68%, #d2bf82 0 16%, transparent 17%),
    radial-gradient(ellipse at 84% 67%, #90b762 0 22%, transparent 23%),
    radial-gradient(ellipse at 22% 15%, #7fae58 0 20%, transparent 21%),
    linear-gradient(145deg, #9ab969, #e3d99e 48%, #80b48c);
}

.guild-path {
  top: 18%;
  left: 24%;
  width: 52%;
  height: 69%;
  border: 12px solid transparent;
  border-top-color: #f1d898;
  border-right-color: #f1d898;
  border-bottom-color: #f1d898;
  transform: rotate(6deg);
}

.guild-location span { font-size: 21px; }

.activity-bottom-nav {
  display: grid;
  flex: 0 0 74px;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: center;
  gap: 2px;
  margin: 0 -10px;
  padding: 3px 4px max(4px, env(safe-area-inset-bottom));
  border-top: 3px solid #bd8c4e;
  background: linear-gradient(180deg, #6e4a31, #3b291f);
  box-shadow: 0 -3px 10px rgba(31, 18, 12, .4);
}

.activity-bottom-nav a,
.activity-bottom-nav button {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 2px;
  padding: 2px 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #fff0c8;
  font: inherit;
  text-decoration: none;
}

.activity-bottom-nav a > span,
.activity-bottom-nav button > span {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 2px solid #e5bf74;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 25%, #f8e3a8, #986842 70%);
  box-shadow: 0 2px 0 #34251d;
  font-size: 22px;
}

.activity-bottom-nav a.active > span,
.activity-bottom-nav button.active > span { border-color: #fff0a5; box-shadow: 0 0 0 2px #ad7438, 0 2px 0 #34251d; }
.activity-bottom-nav strong { overflow: hidden; max-width: 100%; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }

@media (min-width: 700px) {
  .activities-page { width: min(760px, 100%); }
  .lantern-rate-row { min-height: 38px; font-size: 13px; }
  .farm-plot { min-height: 160px; }
}

@media (max-width: 520px) {
  .activities-page { padding: 7px 8px 0; }
  .activity-player-bar { flex-basis: 50px; }
  .activity-player img { width: 36px; height: 36px; }
  .activity-title { flex-basis: 41px; }
  .activity-title h1 { font-size: 19px; }
  .activity-stage { gap: 6px; padding-inline: 1px; }
  .activity-shortcuts { flex-basis: 35px; gap: 3px; }
  .activity-shortcuts button { gap: 3px; padding-inline: 2px; font-size: 8px; }
  .activity-shortcuts button span { font-size: 12px; }
  .activity-content { border-radius: 11px; }
  .lantern-screen { padding: 7px; gap: 5px; }
  .lantern-rate-row { min-height: 31px; font-size: 10px; }
  .lantern-rate-heading { font-size: 8px; }
  .farm-plots { gap: 6px; padding: 6px; }
  .farm-plot { padding: 3px; border-radius: 10px; }
  .crop-display span { font-size: 20px; }
  .crop-display img { width: 29px; height: 29px; }
  .map-caption { flex-basis: 48px; }
  .map-caption strong { font-size: 13px; }
  .map-caption span { font-size: 9px; }
  .map-location { min-width: 65px; padding: 4px 5px; }
  .map-location span { font-size: 19px; }
  .map-location strong { font-size: 8px; }
  .activity-bottom-nav { margin-inline: -8px; }
  .activity-bottom-nav a > span,
  .activity-bottom-nav button > span { width: 34px; height: 34px; font-size: 19px; }
}
</style>
