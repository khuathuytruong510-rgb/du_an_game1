<template>
  <main class="shop-page">
    <header class="shop-header">
      <div class="shop-currencies">
        <span>🔷 {{ spiritShards }}</span>
        <span>🪙 {{ player.gold.toLocaleString('vi-VN') }}</span>
      </div>
      <RouterLink class="shop-close" to="/" aria-label="Quay lại chiến trường">×</RouterLink>
      <div class="shop-banner-art" aria-hidden="true">
        <span class="banner-glow"></span>
        <img src="/assets/hero-mushroom.svg" alt="" />
        <img class="banner-item" src="/assets/item-shard.svg" alt="" />
      </div>
      <div class="shop-heading">
        <span>HỘI CHỢ MÂY</span>
        <h1>{{ activeShop.title }}</h1>
      </div>
    </header>

    <nav class="shop-categories" aria-label="Danh mục cửa hàng">
      <button
        v-for="tab in shopTabs"
        :key="tab.id"
        type="button"
        :class="{ active: activeTab === tab.id }"
        :aria-current="activeTab === tab.id ? 'page' : undefined"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section class="shop-content">
      <div v-if="activeTab === 'summon'" class="summon-shop">
        <div class="summon-kind-tabs" role="tablist" aria-label="Loại triệu hồi">
          <button
            type="button"
            role="tab"
            :aria-selected="summonType === 'skills'"
            :class="{ active: summonType === 'skills' }"
            @click="summonType = 'skills'"
          >
            Kỹ năng
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="summonType === 'companions'"
            :class="{ active: summonType === 'companions' }"
            @click="summonType = 'companions'"
          >
            Đồng hành
          </button>
        </div>

        <section class="summon-machine" :class="`machine-${summonType}`" aria-label="Bệ triệu hồi minh họa">
          <div class="machine-top-lights"><i></i><i></i><i></i><i></i></div>
          <div class="machine-sign">{{ summonType === 'skills' ? 'Tháp Kỹ Năng' : 'Khu Vườn Đồng Hành' }}</div>
          <div class="summon-shelf">
            <div class="summon-rewards">
              <div v-for="reward in summonRewards" :key="reward.name" class="summon-reward">
                <img :src="reward.image" :alt="reward.name" />
                <span>{{ reward.name }}</span>
              </div>
            </div>
            <div class="summon-orbit" aria-hidden="true"></div>
            <div class="summon-main-reward">
              <img :src="featuredReward.image" :alt="featuredReward.name" />
            </div>
          </div>
          <div class="summon-progress">
            <strong>Cấp {{ player.level }}</strong>
            <div><i :style="{ width: `${expProgress}%` }"></i></div>
            <span>{{ player.exp }} / {{ expToNextLevel }}</span>
          </div>
        </section>

        <div class="summon-actions">
          <button type="button" class="summon-action" @click="showPreview('Lượt triệu hồi đơn đã sẵn sàng xem thử.')">
            <strong>Triệu hồi 1 lần</strong>
            <span>Không trừ vật phẩm</span>
          </button>
          <button type="button" class="summon-action" @click="showPreview('Gói triệu hồi 10 lần chỉ là bản xem trước.')">
            <strong>Triệu hồi 10 lần</strong>
            <span>Không trừ vật phẩm</span>
          </button>
          <button type="button" class="summon-action summon-action-wide" @click="showPreview('Gói triệu hồi đặc biệt chưa kết nối tiến trình.')">
            <strong>Triệu hồi đặc biệt</strong>
            <span>Phần thưởng minh họa · chưa có giao dịch</span>
          </button>
        </div>
        <p class="shop-notice" role="status">{{ notice }}</p>
        <RouterLink class="lantern-shortcut" to="/activities?screen=lantern">Đèn Thần · Xem thử nâng cấp</RouterLink>
      </div>

      <div v-else-if="activeTab === 'diamond'" class="shop-catalog">
        <p class="shop-intro">Gói tinh thạch minh họa · thanh toán chưa được kết nối</p>
        <div class="product-grid">
          <article v-for="pack in diamondPacks" :key="pack.name" class="shop-product">
            <span class="product-ribbon">{{ pack.badge }}</span>
            <div class="product-art"><img :src="pack.image" :alt="pack.name" /></div>
            <strong>{{ pack.name }}</strong>
            <span class="product-detail">{{ pack.detail }}</span>
            <span class="product-price">Giá đang cập nhật</span>
            <button type="button" @click="showPreview(`${pack.name}: gói xem trước, chưa có thanh toán.`)">Xem gói</button>
          </article>
        </div>
        <p class="shop-notice" role="status">{{ notice }}</p>
      </div>

      <div v-else-if="activeTab === 'gifts'" class="shop-catalog gift-catalog">
        <p class="shop-intro">Quà theo chủ đề · chỉ xem trước, không mua thật</p>
        <article v-for="bundle in giftBundles" :key="bundle.name" class="gift-bundle">
          <span class="bundle-ribbon">{{ bundle.badge }}</span>
          <div class="bundle-items">
            <div v-for="item in bundle.items" :key="item.name">
              <img :src="item.image" :alt="item.name" />
              <span>{{ item.name }}</span>
            </div>
          </div>
          <div class="bundle-description">
            <strong>{{ bundle.name }}</strong>
            <span>{{ bundle.detail }}</span>
            <button type="button" @click="showPreview(`${bundle.name}: nội dung gói chỉ để minh họa.`)">Xem gói</button>
          </div>
        </article>
        <p class="shop-notice" role="status">{{ notice }}</p>
      </div>

      <div v-else-if="activeTab === 'misc'" class="shop-catalog">
        <p class="shop-intro">Vật phẩm tiện ích · giá và giao dịch chưa được thiết lập</p>
        <div class="product-grid">
          <article v-for="pack in miscPacks" :key="pack.name" class="shop-product">
            <span class="product-ribbon">{{ pack.badge }}</span>
            <div class="product-art"><img :src="pack.image" :alt="pack.name" /></div>
            <strong>{{ pack.name }}</strong>
            <span class="product-detail">{{ pack.detail }}</span>
            <span class="product-price">Giá đang cập nhật</span>
            <button type="button" @click="showPreview(`${pack.name}: cửa hàng tiện ích đang ở chế độ xem trước.`)">Xem gói</button>
          </article>
        </div>
        <p class="shop-notice" role="status">{{ notice }}</p>
      </div>

      <div v-else-if="activeTab === 'limited'" class="shop-catalog limited-catalog">
        <div class="refresh-banner"><span>⏱</span><strong>Quà luân phiên</strong><small>Danh sách minh họa · chưa đặt lịch làm mới</small></div>
        <div class="limited-grid">
          <article v-for="offer in limitedOffers" :key="offer.name" class="limited-offer">
            <span class="limited-badge">{{ offer.badge }}</span>
            <img :src="offer.image" :alt="offer.name" />
            <strong>{{ offer.name }}</strong>
            <span>{{ offer.detail }}</span>
            <button type="button" @click="showPreview(`${offer.name}: ưu đãi minh họa, không nhận vật phẩm.`)">
              {{ offer.free ? 'Xem quà' : 'Xem ưu đãi' }}
            </button>
          </article>
        </div>
        <p class="shop-notice" role="status">{{ notice }}</p>
      </div>

      <div v-else class="costume-shop">
        <div class="costume-stage">
          <span class="costume-title">SẢNH TRANG PHỤC</span>
          <span class="costume-glow"></span>
          <img class="costume-hero" :src="avatarSource" :alt="player.playerName" />
          <p>{{ player.playerName }} · Cấp {{ player.level }}</p>
        </div>
        <div class="costume-filters" aria-label="Bộ sưu tập trang phục">
          <button v-for="filter in costumeFilters" :key="filter" type="button" :class="{ active: activeCostumeFilter === filter }" @click="activeCostumeFilter = filter">
            {{ filter }}
          </button>
        </div>
        <div class="costume-list">
          <button v-for="costume in visibleCostumes" :key="costume.name" type="button" class="costume-card" @click="showPreview(`${costume.name}: vật phẩm trang trí chưa mở khóa.`)">
            <img :src="costume.image" :alt="costume.name" />
            <strong>{{ costume.name }}</strong>
            <small>Xem trước</small>
          </button>
        </div>
        <p class="shop-notice" role="status">{{ notice }}</p>
      </div>
    </section>

    <nav class="shop-bottom-nav" aria-label="Điều hướng game">
      <RouterLink to="/inventory?tab=skills"><span>🧙</span><strong>Nhân vật</strong></RouterLink>
      <RouterLink to="/inventory?tab=companions"><span>🐾</span><strong>Đồng hành</strong></RouterLink>
      <RouterLink to="/activities?screen=world"><span>🧭</span><strong>Phó bản</strong></RouterLink>
      <RouterLink to="/activities?screen=farm"><span>🌱</span><strong>Gia viên</strong></RouterLink>
      <RouterLink to="/activities?screen=guild"><span>🏰</span><strong>Gia tộc</strong></RouterLink>
      <RouterLink to="/" aria-label="Đóng cửa hàng"><span>✕</span><strong>Đóng</strong></RouterLink>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'

type ShopTab = 'summon' | 'diamond' | 'gifts' | 'misc' | 'limited' | 'costume'
type ShopProduct = { name: string; detail: string; image: string; badge: string }

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const summonType = ref<'skills' | 'companions'>('skills')
const activeCostumeFilter = ref('Trang phục')
const notice = ref('Đây là cửa hàng thử nghiệm; không có giao dịch hoặc phần thưởng thật.')
const shopTabs: Array<{ id: ShopTab; label: string; title: string }> = [
  { id: 'summon', label: 'Triệu hồi', title: 'Triệu hồi' },
  { id: 'diamond', label: 'Tinh thạch', title: 'Cửa hàng Tinh Thạch' },
  { id: 'gifts', label: 'Gói quà', title: 'Gói quà chủ đề' },
  { id: 'misc', label: 'Tiện ích', title: 'Cửa hàng tiện ích' },
  { id: 'limited', label: 'Luân phiên', title: 'Ưu đãi luân phiên' },
  { id: 'costume', label: 'Trang phục', title: 'Trang phục' }
]
const activeTab = computed<ShopTab>(() =>
  shopTabs.find(tab => tab.id === route.query.tab)?.id ?? 'summon'
)
const activeShop = computed(() => shopTabs.find(tab => tab.id === activeTab.value) ?? shopTabs[0])
const spiritShards = computed(() =>
  player.inventory
    .filter(item => item.name.toLowerCase().includes('linh thạch'))
    .reduce((total, item) => total + item.quantity, 0)
)
const expToNextLevel = computed(() => 100 * player.level * player.level)
const expProgress = computed(() => Math.min(100, player.exp / expToNextLevel.value * 100))
const avatarSource = computed(() =>
  player.playerAvatar === 'hero-scout' ? '/assets/hero-scout.svg' : '/assets/hero-mushroom.svg'
)
const skillRewards = [
  { name: 'Lưỡi Sao', image: '/assets/item-sword.svg' },
  { name: 'Mảnh Tinh Vân', image: '/assets/item-shard.svg' },
  { name: 'Nhẫn Rừng', image: '/assets/item-ring.svg' }
]
const companionRewards = [
  { name: 'Bạn Nấm', image: '/assets/supplied/mushroom-companion.png' },
  { name: 'Hộ Vệ Lá', image: '/assets/hero-scout.svg' },
  { name: 'Hổ Mây', image: '/assets/boss-tiger.svg' }
]
const summonRewards = computed(() => summonType.value === 'skills' ? skillRewards : companionRewards)
const featuredReward = computed(() => summonRewards.value[1])
const diamondPacks: ShopProduct[] = [
  { name: 'Túi Tinh Thạch', detail: 'Gói khởi đầu · nội dung minh họa', image: '/assets/item-shard.svg', badge: 'MỚI' },
  { name: 'Hộp Ánh Sao', detail: 'Gói phiêu lưu · nội dung minh họa', image: '/assets/item-shard.svg', badge: 'PHỔ BIẾN' },
  { name: 'Rương Pha Lê', detail: 'Gói sưu tập · nội dung minh họa', image: '/assets/item-ring.svg', badge: 'ĐẶC BIỆT' },
  { name: 'Xe Tinh Vân', detail: 'Gói lớn · nội dung minh họa', image: '/assets/item-helmet.svg', badge: 'BỘ SƯU TẬP' },
  { name: 'Hòm Bảo Vật', detail: 'Gói khám phá · nội dung minh họa', image: '/assets/item-necklace.svg', badge: 'KHÁM PHÁ' },
  { name: 'Túi Ánh Trăng', detail: 'Gói sưu tập · nội dung minh họa', image: '/assets/item-gloves.svg', badge: 'GIỚI HẠN' }
]
const miscPacks: ShopProduct[] = [
  { name: 'Bình Hồi Phục', detail: 'Vật phẩm hỗ trợ', image: '/assets/item-potion.svg', badge: 'HỮU ÍCH' },
  { name: 'Mảnh Linh Thạch', detail: 'Nguyên liệu chế tác', image: '/assets/item-shard.svg', badge: 'NGUYÊN LIỆU' },
  { name: 'Nhẫn Đồng', detail: 'Trang bị minh họa', image: '/assets/item-ring.svg', badge: 'TRANG BỊ' },
  { name: 'Bùa Hộ Mệnh', detail: 'Vật phẩm hành trình', image: '/assets/item-necklace.svg', badge: 'HÀNH TRÌNH' },
  { name: 'Găng Tay Rừng', detail: 'Trang bị minh họa', image: '/assets/item-gloves.svg', badge: 'TRANG BỊ' },
  { name: 'Giày Lữ Hành', detail: 'Trang bị minh họa', image: '/assets/item-boots.svg', badge: 'HÀNH TRÌNH' }
]
const giftBundles = [
  { name: 'Gói Khởi Hành', detail: 'Vật phẩm cho chuyến phiêu lưu đầu tiên', badge: 'TÂN THỦ', items: [{ name: 'Tinh thạch', image: '/assets/item-shard.svg' }, { name: 'Bình thuốc', image: '/assets/item-potion.svg' }, { name: 'Nhẫn', image: '/assets/item-ring.svg' }] },
  { name: 'Gói Đồng Hành', detail: 'Quà chủ đề dành cho người bạn đồng hành', badge: 'BẠN BÈ', items: [{ name: 'Bạn Nấm', image: '/assets/supplied/mushroom-companion.png' }, { name: 'Bùa lá', image: '/assets/item-necklace.svg' }, { name: 'Tinh thạch', image: '/assets/item-shard.svg' }] },
  { name: 'Gói Thợ Rèn', detail: 'Nguyên liệu và trang bị để xem thử', badge: 'RÈN ĐỒ', items: [{ name: 'Kiếm', image: '/assets/item-sword.svg' }, { name: 'Giáp', image: '/assets/item-armor.svg' }, { name: 'Bình thuốc', image: '/assets/item-potion.svg' }] }
]
const limitedOffers = [
  { name: 'Hộp Quà Ngày Mới', detail: 'Quà miễn phí xem trước', badge: 'MIỄN PHÍ', image: '/assets/item-shard.svg', free: true },
  { name: 'Bộ Chìa Khóa', detail: 'Bộ sưu tập chìa khóa minh họa', badge: 'BỘ QUÀ', image: '/assets/item-helmet.svg', free: false },
  { name: 'Đèn Thần', detail: 'Vật phẩm trang trí xem trước', badge: 'NỔI BẬT', image: '/assets/item-ring.svg', free: false },
  { name: 'Phiếu Thám Hiểm', detail: 'Vật phẩm sự kiện minh họa', badge: 'SỰ KIỆN', image: '/assets/item-shard.svg', free: false }
]
const costumeFilters = ['Trang phục', 'Vũ khí', 'Đồng hành', 'Thú cưỡi']
const costumes = [
  { name: 'Nhà Thám Hiểm', image: '/assets/hero-scout.svg', type: 'Trang phục' },
  { name: 'Kiếm Gió', image: '/assets/item-sword.svg', type: 'Vũ khí' },
  { name: 'Bạn Nấm', image: '/assets/supplied/mushroom-companion.png', type: 'Đồng hành' },
  { name: 'Rồng Băng', image: '/assets/supplied/mount-ice-dragon.png', type: 'Thú cưỡi' },
  { name: 'Giáp Rừng', image: '/assets/item-armor.svg', type: 'Trang phục' }
]
const visibleCostumes = computed(() => costumes.filter(item => item.type === activeCostumeFilter.value))

const selectTab = (tab: ShopTab) => {
  notice.value = 'Đây là cửa hàng thử nghiệm; không có giao dịch hoặc phần thưởng thật.'
  void router.replace({ path: '/shop', query: { tab } })
}
const showPreview = (message: string) => {
  notice.value = message
}
</script>

<style scoped>
.shop-page {
  --shop-gold: #ffe6a3;
  --shop-dark: #4a2d20;
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  width: min(620px, 100%);
  height: 100dvh;
  min-height: 0;
  margin: 0 auto;
  overflow: hidden;
  color: #fff1d0;
  background:
    radial-gradient(ellipse at 50% 20%, rgba(161, 98, 36, .34), transparent 55%),
    repeating-linear-gradient(90deg, #55351f 0 42px, #654127 43px 46px, #4b2e1d 47px 52px);
  box-shadow: inset 0 0 0 4px #a47642, inset 0 0 0 7px #392519;
  font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif;
}
.shop-header {
  position: relative;
  flex: 0 0 126px;
  overflow: hidden;
  border-bottom: 5px solid #9a652f;
  background:
    radial-gradient(ellipse at 77% 94%, rgba(255, 195, 76, .52), transparent 38%),
    linear-gradient(135deg, #8e4d22, #c17b2d 52%, #633617);
  box-shadow: inset 0 -7px 0 rgba(53, 31, 18, .35);
}
.shop-header::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 17px;
  border-top: 2px solid rgba(255, 222, 149, .62);
  background: repeating-linear-gradient(90deg, #75502f 0 34px, #9b6b37 35px 38px);
}
.shop-currencies {
  position: absolute;
  z-index: 2;
  top: 10px;
  left: 12px;
  display: flex;
  gap: 7px;
}
.shop-currencies span {
  min-width: 70px;
  padding: 3px 9px;
  border: 2px solid #b88a49;
  border-radius: 14px;
  background: rgba(57, 37, 26, .85);
  color: #fff2cc;
  font-size: 11px;
  font-weight: 900;
}
.shop-close {
  position: absolute;
  z-index: 3;
  top: 8px;
  right: 9px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 2px solid #f1d28c;
  border-radius: 50%;
  background: linear-gradient(#ac6c36, #63391f);
  color: #fff4d2;
  font-size: 24px;
  line-height: 1;
  text-decoration: none;
}
.shop-banner-art { position: absolute; inset: 0 6px 11px auto; width: 42%; }
.shop-banner-art > img:first-of-type {
  position: absolute;
  right: 13px;
  bottom: -5px;
  width: 105px;
  height: 105px;
  object-fit: contain;
  filter: drop-shadow(0 5px 5px rgba(42, 23, 12, .55));
}
.shop-banner-art .banner-item {
  position: absolute;
  right: 82px;
  bottom: 13px;
  width: 43px;
  height: 43px;
  filter: drop-shadow(0 2px 4px #4f321c);
}
.banner-glow {
  position: absolute;
  right: 12px;
  bottom: 0;
  width: 105px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 208, 99, .42);
  filter: blur(15px);
}
.shop-heading {
  position: absolute;
  z-index: 1;
  left: 15px;
  bottom: 23px;
  text-shadow: 0 2px 2px #4e2918;
}
.shop-heading > span { color: #ffe6a0; font-size: 9px; font-weight: 900; letter-spacing: 2px; }
.shop-heading h1 { margin: 1px 0 0; color: #fff0c1; font-size: 25px; line-height: 1.05; }
.shop-categories {
  flex: 0 0 48px;
  display: flex;
  gap: 3px;
  overflow-x: auto;
  padding: 5px 7px;
  border-bottom: 3px solid #3e291c;
  background: linear-gradient(#75502e, #422b1d);
  scrollbar-width: none;
}
.shop-categories::-webkit-scrollbar { display: none; }
.shop-categories button {
  flex: 1 0 auto;
  min-width: 67px;
  padding: 0 7px;
  border: 1px solid #ad7a3d;
  border-radius: 8px;
  background: linear-gradient(#69462b, #4b301f);
  color: #f5dfb2;
  font: inherit;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}
.shop-categories button.active {
  border-color: #ffe08a;
  background: linear-gradient(#ffe69b, #d69233);
  color: #57381e;
  box-shadow: 0 0 8px rgba(255, 225, 137, .45);
}
.shop-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 12px;
  scrollbar-color: #ad7d42 #48301f;
}
.summon-shop { display: grid; gap: 9px; }
.summon-kind-tabs {
  width: min(330px, 90%);
  height: 48px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0 auto;
  padding: 4px;
  border: 4px solid #743c1f;
  border-radius: 15px;
  background: linear-gradient(90deg, #d9731e, #a94d19);
  box-shadow: 0 4px 0 #472719, inset 0 0 0 2px rgba(255, 198, 102, .36);
}
.summon-kind-tabs button {
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #ffd99c;
  font: inherit;
  font-size: 16px;
  font-weight: 900;
}
.summon-kind-tabs button.active {
  border: 2px solid #fff0ad;
  background: linear-gradient(#fff0a1, #e6a438);
  color: #733b1d;
  text-shadow: 0 1px #fff8df;
}
.summon-machine {
  position: relative;
  min-height: 272px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  border: 7px solid #e8b64e;
  border-radius: 20px 20px 12px 12px;
  background:
    radial-gradient(ellipse at 50% 68%, rgba(255, 245, 196, .88), transparent 47%),
    linear-gradient(180deg, #f8d48d, #efb969 42%, #f6e5bb);
  box-shadow: inset 0 0 0 4px #fff0b0, 0 5px 0 #61391f, 0 8px 14px rgba(28, 17, 10, .35);
}
.machine-companions {
  background:
    radial-gradient(ellipse at 50% 68%, rgba(217, 255, 205, .88), transparent 47%),
    linear-gradient(180deg, #73c9af, #a4d5a5 43%, #f1e7b6);
}
.machine-top-lights {
  height: 19px;
  display: flex;
  justify-content: space-around;
  padding-top: 3px;
  background: linear-gradient(#9b5526, #d88a32);
}
.machine-top-lights i { width: 12px; height: 12px; border: 2px solid #fff0a8; border-radius: 50%; background: #e85f8f; box-shadow: 0 0 8px #f7df76; }
.machine-top-lights i:nth-child(even) { background: #75dfe2; }
.machine-sign {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 18px;
  border: 3px solid #f2c55b;
  border-radius: 0 0 12px 12px;
  background: linear-gradient(#9c5829, #713c1e);
  color: #fff0ba;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}
.summon-shelf {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  margin: 20px 10px 8px;
  border: 4px solid rgba(255, 250, 221, .8);
  border-radius: 44% 44% 12px 12px / 23% 23% 12px 12px;
  background:
    linear-gradient(90deg, rgba(246, 190, 80, .36), transparent 16% 84%, rgba(246, 190, 80, .36)),
    linear-gradient(180deg, rgba(255, 249, 224, .76), rgba(235, 190, 111, .55));
  box-shadow: inset 0 0 22px rgba(255,255,255,.55);
}
.summon-rewards {
  position: absolute;
  top: 12%;
  left: 7%;
  right: 7%;
  display: flex;
  justify-content: space-around;
}
.summon-reward {
  width: 65px;
  height: 70px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 2px;
  border: 2px solid rgba(255,255,255,.78);
  border-radius: 50%;
  background: radial-gradient(circle, #fff5d5, #e6c77e);
  box-shadow: 0 4px 0 rgba(128, 83, 39, .3);
}
.machine-companions .summon-reward { background: radial-gradient(circle, #edffd4, #83c98e); }
.summon-reward img { width: 39px; height: 39px; object-fit: contain; }
.summon-reward span { max-width: 58px; overflow: hidden; color: #604124; font-size: 7px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; }
.summon-orbit {
  position: absolute;
  bottom: 9%;
  width: 190px;
  height: 44px;
  border: 5px solid rgba(255,255,255,.78);
  border-radius: 50%;
  background: rgba(255, 247, 214, .42);
  box-shadow: 0 5px 0 rgba(112, 70, 32, .25);
}
.summon-main-reward {
  position: relative;
  z-index: 1;
  width: 110px;
  height: 110px;
  display: grid;
  place-items: center;
  margin-top: 23px;
  border: 5px solid #fff2b5;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 25%, #fff8d5, #edb04c 70%, #b75037);
  box-shadow: 0 5px 0 #88502b, 0 0 22px rgba(255, 220, 106, .68);
}
.machine-companions .summon-main-reward { background: radial-gradient(circle at 35% 25%, #fff8df, #a6df9a 70%, #499c81); }
.summon-main-reward img { width: 92px; height: 92px; object-fit: contain; }
.summon-progress {
  position: relative;
  z-index: 2;
  min-height: 35px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 4px 14px;
  border-radius: 50% 50% 0 0 / 80% 80% 0 0;
  background: #553846;
  color: #fff3d4;
  font-size: 10px;
  font-weight: 900;
}
.summon-progress > div { height: 13px; overflow: hidden; border: 2px solid #332329; border-radius: 9px; background: #231d26; }
.summon-progress i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #56c873, #bbef79); }
.summon-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.summon-action {
  min-height: 62px;
  display: grid;
  align-content: center;
  gap: 3px;
  padding: 6px;
  border: 3px solid #ffe6a1;
  border-radius: 14px;
  background: linear-gradient(#ffbd43, #db7424);
  box-shadow: 0 4px 0 #713d24, inset 0 0 0 2px rgba(255,255,255,.28);
  color: #fff8e4;
  text-shadow: 0 2px 1px #71401e;
}
.summon-action strong { font-size: 14px; }
.summon-action span { font-size: 8px; }
.summon-action-wide { grid-column: 1 / 3; min-height: 56px; background: linear-gradient(#ffcf58, #e68e2c); }
.shop-notice {
  min-height: 24px;
  margin: 0;
  color: #ffe4a8;
  font-size: 10px;
  text-align: center;
}
.lantern-shortcut {
  justify-self: center;
  color: #ffe8b7;
  font-size: 10px;
  text-decoration: underline;
}
.shop-intro {
  margin: 1px 0 10px;
  padding: 8px;
  border: 1px solid rgba(255, 220, 148, .45);
  border-radius: 8px;
  background: rgba(46, 28, 19, .62);
  color: #ffe8be;
  font-size: 11px;
  text-align: center;
}
.product-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; }
.shop-product {
  position: relative;
  min-height: 220px;
  display: grid;
  justify-items: center;
  align-content: end;
  gap: 5px;
  padding: 13px 9px 10px;
  border: 3px solid #b68b53;
  border-radius: 15px;
  background: linear-gradient(150deg, #f6dfaa, #d8b576 55%, #a67c4e);
  box-shadow: inset 0 0 0 2px #fff0c2, 0 5px 0 #432b1d;
  color: #56371f;
  text-align: center;
}
.product-ribbon, .bundle-ribbon {
  position: absolute;
  top: 7px;
  left: -4px;
  padding: 4px 9px;
  border: 2px solid #f7d58d;
  border-radius: 0 8px 8px 0;
  background: linear-gradient(#b64e37, #812b25);
  color: #fff2c8;
  font-size: 8px;
  font-weight: 900;
}
.product-art {
  width: 92px;
  height: 86px;
  display: grid;
  place-items: center;
  margin-bottom: 2px;
  border: 2px solid rgba(142, 94, 44, .48);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 25%, #fffdf0, #e9c976 68%, #b57d3d);
  box-shadow: 0 4px 0 rgba(111, 68, 34, .35);
}
.product-art img { width: 68px; height: 68px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(59, 35, 18, .28)); }
.shop-product > strong { font-size: 13px; }
.product-detail { min-height: 25px; color: #72512f; font-size: 9px; }
.product-price { color: #865428; font-size: 9px; font-weight: 800; }
.shop-product button, .gift-bundle button, .limited-offer button {
  width: 100%;
  min-height: 34px;
  border: 2px solid #ffe5a0;
  border-radius: 18px;
  background: linear-gradient(#eac34c, #c28128);
  box-shadow: 0 3px 0 #79502b;
  color: #fff9e8;
  font: inherit;
  font-size: 11px;
  font-weight: 900;
  text-shadow: 0 1px 2px #704316;
}
.gift-catalog { display: grid; gap: 11px; }
.gift-bundle {
  position: relative;
  min-height: 158px;
  display: grid;
  grid-template-columns: 1.15fr .85fr;
  gap: 8px;
  padding: 20px 10px 10px;
  border: 3px solid #d5b16a;
  border-radius: 14px;
  background:
    radial-gradient(circle at 78% 50%, rgba(255, 235, 167, .85), transparent 38%),
    linear-gradient(145deg, #f3dfa9, #c99756);
  box-shadow: inset 0 0 0 2px #fff0c3, 0 4px 0 #4c2c1a;
  color: #57371f;
}
.bundle-ribbon { top: 5px; }
.bundle-items { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-content: center; gap: 4px; }
.bundle-items > div { min-width: 0; display: grid; justify-items: center; gap: 3px; }
.bundle-items img { width: 42px; height: 42px; object-fit: contain; padding: 3px; border: 2px solid #bc9657; border-radius: 8px; background: #fff0c7; }
.bundle-items span { overflow: hidden; max-width: 100%; font-size: 7px; white-space: nowrap; text-overflow: ellipsis; }
.bundle-description { display: grid; align-content: center; gap: 5px; }
.bundle-description strong { font-size: 13px; }
.bundle-description > span { color: #73522f; font-size: 9px; }
.refresh-banner {
  display: grid;
  grid-template-columns: 34px 1fr;
  align-items: center;
  gap: 0 8px;
  padding: 10px;
  border: 2px solid #c69a5e;
  border-radius: 12px;
  background: linear-gradient(#eed69d, #b27b43);
  color: #57351e;
}
.refresh-banner > span { grid-row: 1 / 3; font-size: 25px; }
.refresh-banner strong { font-size: 13px; }
.refresh-banner small { font-size: 9px; }
.limited-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 11px; }
.limited-offer {
  position: relative;
  min-height: 216px;
  display: grid;
  justify-items: center;
  align-content: end;
  gap: 5px;
  padding: 20px 8px 10px;
  border: 3px solid #dec17c;
  border-radius: 13px;
  background: linear-gradient(145deg, #f7e9be, #d4ae6c);
  color: #55371f;
  text-align: center;
}
.limited-badge { position: absolute; top: 7px; right: 6px; padding: 4px 6px; border: 1px solid #fff0bd; border-radius: 9px; background: #ae4b36; color: #fff1cb; font-size: 8px; font-weight: 900; }
.limited-offer img { width: 78px; height: 78px; object-fit: contain; padding: 6px; border: 2px solid #b58b51; border-radius: 50%; background: #fff3ce; }
.limited-offer strong { font-size: 11px; }
.limited-offer > span:not(.limited-badge) { color: #71502f; font-size: 8px; }
.limited-offer button { font-size: 10px; }
.costume-stage {
  position: relative;
  min-height: 350px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 3px solid #aa7a43;
  border-radius: 16px;
  background:
    radial-gradient(ellipse at 50% 70%, rgba(255, 226, 151, .78), transparent 42%),
    linear-gradient(180deg, #53361f, #a77a4a 58%, #e6cb93);
  box-shadow: inset 0 0 0 3px rgba(255, 239, 191, .45);
}
.costume-title { position: absolute; top: 12px; padding: 6px 18px; border: 2px solid #d3b16d; border-radius: 12px; background: #664326; color: #ffedc4; font-size: 12px; font-weight: 900; }
.costume-glow { position: absolute; bottom: 36px; width: 190px; height: 55px; border: 5px solid #f7df9e; border-radius: 50%; background: rgba(255, 233, 169, .52); box-shadow: 0 6px 0 #73512e; }
.costume-hero { position: relative; z-index: 1; align-self: end; width: 190px; height: 220px; object-fit: contain; filter: drop-shadow(0 6px 5px rgba(41, 26, 13, .45)); }
.costume-stage p { position: absolute; bottom: 8px; z-index: 2; margin: 0; color: #fff0c1; font-size: 10px; font-weight: 900; text-shadow: 0 2px 2px #3d2617; }
.costume-filters { display: flex; gap: 5px; overflow-x: auto; margin: 10px 0; scrollbar-width: none; }
.costume-filters button { flex: 1 0 auto; padding: 7px 9px; border: 2px solid #b4874b; border-radius: 8px; background: #58391f; color: #ffe9bc; font: inherit; font-size: 9px; }
.costume-filters button.active { background: #e4b948; color: #57391f; }
.costume-list { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 7px; }
.costume-card { flex: 0 0 102px; display: grid; justify-items: center; gap: 4px; padding: 7px; border: 2px solid #dbbd78; border-radius: 10px; background: linear-gradient(#f5e2af, #c99e5d); color: #53351f; }
.costume-card img { width: 66px; height: 66px; object-fit: contain; }
.costume-card strong { max-width: 100%; overflow: hidden; font-size: 9px; white-space: nowrap; text-overflow: ellipsis; }
.costume-card small { font-size: 8px; }
.shop-bottom-nav {
  flex: 0 0 78px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: end;
  gap: 2px;
  padding: 5px 4px 3px;
  border-top: 4px solid #b68a4c;
  background: linear-gradient(180deg, #755032, #39271e);
  box-shadow: 0 -5px 18px rgba(34, 21, 13, .48), inset 0 3px 0 #dfb56d;
}
.shop-bottom-nav a {
  min-width: 0;
  height: 65px;
  display: grid;
  justify-items: center;
  align-content: end;
  gap: 2px;
  color: #fff1ce;
  text-decoration: none;
  text-shadow: 0 2px 2px #322115;
}
.shop-bottom-nav a > span { width: 42px; height: 42px; display: grid; place-items: center; border: 3px solid #d3a85e; border-radius: 50%; background: radial-gradient(circle at 35% 25%, #fff1bd, #96643c 58%, #4f3525); font-size: 22px; }
.shop-bottom-nav a > strong { max-width: 100%; overflow: hidden; font-size: 9px; white-space: nowrap; text-overflow: ellipsis; }
@media (max-width: 420px) {
  .shop-header { flex-basis: 114px; }
  .shop-content { padding-right: 8px; padding-left: 8px; }
  .summon-machine { min-height: 248px; }
  .summon-reward { width: 57px; height: 62px; }
  .summon-main-reward { width: 96px; height: 96px; }
  .summon-main-reward img { width: 80px; height: 80px; }
  .summon-progress { padding-right: 8px; padding-left: 8px; }
  .shop-product { min-height: 204px; padding-right: 6px; padding-left: 6px; }
  .product-art { width: 78px; height: 76px; }
  .product-art img { width: 58px; height: 58px; }
  .shop-bottom-nav { flex-basis: 76px; }
  .shop-bottom-nav a > span { width: 38px; height: 38px; font-size: 20px; }
  .shop-bottom-nav a > strong { font-size: 8px; }
}
</style>
