import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AutoState } from '../game/systems/AutoBattleSystem'
import {
  isPlayerSaveData,
  loadPlayerSave,
  resetPlayerSave,
  writePlayerSave,
  type PlayerSaveData
} from '../game/persistence/playerSave'
import { GameApiError, gameApi } from '../game/persistence/gameApi'
import { rollEquipmentRarity } from '../game/systems/equipmentLoot'
import {
  isAutoPotionThreshold,
  isMountId,
  loadGameSettings,
  loadSelectedMount,
  writeGameSettings,
  writeSelectedMount,
  type AutoPotionThreshold,
  type MountId
} from '../game/persistence/gameSettings'

export type EquipmentSlot =
  | 'weapon'
  | 'helmet'
  | 'armor'
  | 'gloves'
  | 'boots'
  | 'ring'
  | 'necklace'
export type ItemRarity = 'Thường' | 'Tốt' | 'Hiếm' | 'Sử thi' | 'Huyền thoại'
export const INVENTORY_CAPACITY = 20
export const HEALING_POTION_PRICE = 20
const MAX_STACK_SIZE = 999
export const EQUIPMENT_SHOP = {
  weapon: {
    name: 'Kiếm tập sự',
    price: 80,
    bonus: 4
  },
  armor: {
    name: 'Giáp da tập sự',
    price: 60,
    bonus: 2
  },
  helmet: {
    name: 'Mũ da tập sự',
    price: 50,
    bonus: 2
  },
  gloves: {
    name: 'Găng tay tập sự',
    price: 55,
    bonus: 3
  },
  boots: {
    name: 'Giày tập sự',
    price: 55,
    bonus: 2
  },
  ring: {
    name: 'Nhẫn tập sự',
    price: 70,
    bonus: 3
  },
  necklace: {
    name: 'Dây chuyền tập sự',
    price: 70,
    bonus: 3
  }
} as const

export interface InventoryItem {
  id: string
  name: string
  type: 'material' | 'equipment' | 'consumable'
  rarity: ItemRarity
  quantity: number
  slot?: EquipmentSlot
  attackBonus?: number
  defenseBonus?: number
  hpBonus?: number
  mpBonus?: number
  attackSpeedBonus?: number
  criticalBonus?: number
  dodgeBonus?: number
  enhanceLevel?: number
  healAmount?: number
}

export const EQUIPMENT_SLOTS: Array<{ id: EquipmentSlot; label: string; icon: string }> = [
  { id: 'weapon', label: 'Vũ khí', icon: '⚔' },
  { id: 'helmet', label: 'Mũ', icon: '⛑' },
  { id: 'armor', label: 'Áo giáp', icon: '🛡' },
  { id: 'gloves', label: 'Găng tay', icon: '✋' },
  { id: 'boots', label: 'Giày', icon: '👟' },
  { id: 'ring', label: 'Nhẫn', icon: '💍' },
  { id: 'necklace', label: 'Dây chuyền', icon: '◆' }
]

export type PlayerAvatar = 'hero-mushroom' | 'hero-scout'
export const PLAYER_AVATARS: Array<{ id: PlayerAvatar; name: string; src: string }> = [
  { id: 'hero-mushroom', name: 'Nấm Lùn', src: '/assets/hero-mushroom.svg' },
  { id: 'hero-scout', name: 'Thám hiểm', src: '/assets/hero-scout.svg' }
]

export const getItemSellPrice = (item: InventoryItem): number => {
  if (item.type === 'material') return 2
  if (item.type === 'consumable') return 3
  const bonus = item.slot === 'weapon'
    ? item.attackBonus ?? 0
    : item.defenseBonus ?? item.attackBonus ?? 0
  return 5 + bonus * 2
}

interface Quest {
  id: string
  title: string
  description: string
  progress: number
  required: number
  rewardExp: number
  rewardGold: number
  claimed: boolean
}

export const usePlayerStore = defineStore('player', () => {
  let nextItemId = 1
  const level = ref(1)
  const exp = ref(0)
  const gold = ref(0)
  const hp = ref(100)
  const mp = ref(50)
  const playerName = ref('Nấm Lùn')
  const playerAvatar = ref<PlayerAvatar>('hero-mushroom')
  const autoBattle = ref(false)
  const autoPotionThreshold = ref<AutoPotionThreshold>(0.35)
  const mountId = ref<MountId | null>(null)
  const inventory = ref<InventoryItem[]>([])
  const equipment = ref<Partial<Record<EquipmentSlot, InventoryItem>>>({})
  const attackPower = computed(() =>
    10 +
    (equipment.value.weapon?.attackBonus ?? 0) +
    (equipment.value.gloves?.attackBonus ?? 0) +
    (equipment.value.ring?.attackBonus ?? 0)
  )
  const defensePower = computed(() => {
    return Object.values(equipment.value).reduce(
      (total, item) => total + (
        item?.defenseBonus ??
        (item?.slot === 'armor' ? item.attackBonus ?? 0 : 0)
      ),
      0
    )
  })
  const maxHp = computed(() =>
    Math.min(
      100 + (level.value - 1) * 10 +
      Object.values(equipment.value).reduce(
        (total, item) => total + (item?.hpBonus ?? 0),
        0
      ),
      1000
    )
  )
  const maxMp = computed(() =>
    Math.min(
      50 + (level.value - 1) * 5 +
      Object.values(equipment.value).reduce(
        (total, item) => total + (item?.mpBonus ?? 0),
        0
      ),
      500
    )
  )
  const attackSpeed = computed(() =>
    Object.values(equipment.value).reduce(
      (total, item) => total + (item?.attackSpeedBonus ?? 0),
      0
    )
  )
  const criticalChance = computed(() =>
    Math.min(
      0.1 +
      Object.values(equipment.value).reduce(
        (total, item) => total + (item?.criticalBonus ?? 0),
        0
      ),
      0.75
    )
  )
  const dodgeChance = computed(() =>
    Math.min(
      Object.values(equipment.value).reduce(
        (total, item) => total + (item?.dodgeBonus ?? 0),
        0
      ),
      0.5
    )
  )
  const createQuests = (): Quest[] => [
    {
      id: 'slime-hunt',
      title: 'Dọn bãi tập',
      description: 'Đánh bại 3 quái vật',
      progress: 0,
      required: 3,
      rewardExp: 30,
      rewardGold: 15,
      claimed: false
    },
    {
      id: 'spirit-shards',
      title: 'Mảnh linh thạch',
      description: 'Thu thập 3 mảnh linh thạch',
      progress: 0,
      required: 3,
      rewardExp: 20,
      rewardGold: 20,
      claimed: false
    }
  ]
  const quests = ref<Quest[]>(createQuests())
  const autoState = ref<AutoState>('IDLE')
  const currentTarget = ref<string | null>(null)
  const currentTargetId = ref<string | null>(null)
  const currentTargetHp = ref(0)
  const currentTargetMaxHp = ref(0)
  const currentTargetDistance = ref<number | null>(null)
  const currentTargetInRange = ref(false)
  const attackCooldownRemaining = ref(0)
  const skillCooldownRemaining = ref(0)
  const autoMessage = ref('Sẵn sàng chiến đấu')
  const lootMessage = ref('')
  const saveStatus = ref('Đang kiểm tra dữ liệu lưu')
  const settingsStatus = ref('')
  const accountEmail = ref<string | null>(null)
  const authLoading = ref(false)
  const remoteSaveInProgress = ref(false)
  const accountStatus = ref('Đang kết nối máy chủ')
  const accountStatusType = ref<'loading' | 'success' | 'error' | 'neutral'>('loading')
  const saveBlocked = ref(false)
  const forgeInProgress = ref(false)
  const forgeOpen = ref(false)
  let remoteSaveRequested = false
  let remoteSavePromise: Promise<boolean> | null = null

  const clearTargetState = () => {
    currentTarget.value = null
    currentTargetId.value = null
    currentTargetHp.value = 0
    currentTargetMaxHp.value = 0
    currentTargetDistance.value = null
    currentTargetInRange.value = false
    attackCooldownRemaining.value = 0
    skillCooldownRemaining.value = 0
  }

  const openForgePanel = () => {
    forgeOpen.value = true
  }

  const closeForgePanel = () => {
    if (forgeInProgress.value) return
    forgeOpen.value = false
  }

  const setAutoBattle = (enabled: boolean) => {
    autoBattle.value = enabled
    if (!enabled) {
      autoState.value = 'IDLE'
      autoMessage.value = 'Auto đã tắt'
      clearTargetState()
      return
    }

    autoState.value = 'SEARCH'
    autoMessage.value = 'Đang tìm quái trong khu vực'
    clearTargetState()
  }

  const setAutoPotionThreshold = (threshold: number): boolean => {
    if (!isAutoPotionThreshold(threshold)) {
      settingsStatus.value = 'Ngưỡng dùng thuốc không hợp lệ.'
      return false
    }

    const error = writeGameSettings(threshold)
    if (error) {
      settingsStatus.value = error
      return false
    }

    autoPotionThreshold.value = threshold
    settingsStatus.value = 'Đã lưu ngưỡng tự dùng thuốc trên thiết bị này.'
    return true
  }

  const setMount = (id: MountId | null): boolean => {
    if (id !== null && !isMountId(id)) {
      settingsStatus.value = 'Thú cưỡi không hợp lệ.'
      return false
    }

    const error = writeSelectedMount(id)
    if (error) {
      settingsStatus.value = error
      return false
    }

    mountId.value = id
    settingsStatus.value = id
      ? 'Đã lưu thú cưỡi trên thiết bị này.'
      : 'Đã tháo thú cưỡi.'
    return true
  }

  const setPlayerProfile = (name: string, avatar: PlayerAvatar): boolean => {
    const normalizedName = name.trim().replace(/\s+/g, ' ')
    if (normalizedName.length < 2 || normalizedName.length > 24) {
      settingsStatus.value = 'Tên nhân vật phải từ 2 đến 24 ký tự.'
      return false
    }
    if (!PLAYER_AVATARS.some(candidate => candidate.id === avatar)) {
      settingsStatus.value = 'Avatar không hợp lệ.'
      return false
    }

    playerName.value = normalizedName
    playerAvatar.value = avatar
    settingsStatus.value = 'Đã lưu hồ sơ nhân vật.'
    persistGame()
    return true
  }

  const gainExp = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0 || level.value >= 30) return

    exp.value += amount
    while (level.value < 30 && exp.value >= getExpForLevel(level.value)) {
      exp.value -= getExpForLevel(level.value)
      levelUp()
    }

    if (level.value >= 30) exp.value = 0
    persistGame()
    if (accountEmail.value) void persistRemoteGame()
  }

  const regenerateMp = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0 || mp.value >= maxMp.value) return
    mp.value = Math.min(maxMp.value, mp.value + amount)
  }

  const takeDamage = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0 || hp.value <= 0) return 0
    const mitigatedDamage = Math.max(1, amount - defensePower.value)
    const actualDamage = Math.min(hp.value, mitigatedDamage)
    hp.value -= actualDamage
    persistGame()
    if (accountEmail.value) void persistRemoteGame()
    return actualDamage
  }

  const restoreHealth = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0 || hp.value >= maxHp.value) return
    hp.value = Math.min(maxHp.value, hp.value + amount)
  }

  const getExpForLevel = (level: number): number => {
    return 100 * level * level
  }

  const levelUp = () => {
    level.value++
    hp.value = Math.min(100 + (level.value - 1) * 10, 200)
    mp.value = Math.min(50 + (level.value - 1) * 5, 150)
    gold.value += 10
  }

  const addItem = (item: InventoryItem): boolean => {
    const stack = item.type === 'material' || item.type === 'consumable'
      ? inventory.value.find(existing => existing.type === item.type && existing.name === item.name)
      : undefined
    if (stack) {
      if (stack.quantity + item.quantity > MAX_STACK_SIZE) return false
      stack.quantity += item.quantity
    } else {
      if (inventory.value.length >= INVENTORY_CAPACITY) return false
      inventory.value.push(item)
    }

    if (item.name === 'Mảnh linh thạch') {
      const quest = quests.value.find(item => item.id === 'spirit-shards')
      if (quest) quest.progress = Math.min(quest.required, quest.progress + item.quantity)
    }
    lootMessage.value = `Nhặt được ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`
    persistGame()
    if (accountEmail.value) void persistRemoteGame()
    return true
  }

  const createItem = (item: Omit<InventoryItem, 'id'>): InventoryItem => ({
    ...item,
    id: `item-${nextItemId++}`
  })

  const createLootEquipment = (monsterKind: 'slime' | 'wolf' | 'goblin' | 'boss'): InventoryItem => {
    const slots: EquipmentSlot[] = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'necklace']
    const slot = slots[Math.floor(Math.random() * slots.length)]
    const roll = Math.random()
    const rarity: ItemRarity = rollEquipmentRarity(monsterKind, roll)
    const rarityBonus = { 'Thường': 1, 'Tốt': 2, 'Hiếm': 4, 'Sử thi': 7, 'Huyền thoại': 10 }[rarity]
    const levelBonus = 1 + Math.floor(level.value / 5)
    const bonus = rarityBonus * levelBonus
    const names: Record<EquipmentSlot, string> = {
      weapon: 'Kiếm',
      helmet: 'Mũ',
      armor: 'Áo giáp',
      gloves: 'Găng tay',
      boots: 'Giày',
      ring: 'Nhẫn',
      necklace: 'Dây chuyền'
    }
    const common = {
      name: `${rarity} ${names[slot]}`,
      type: 'equipment' as const,
      rarity,
      quantity: 1,
      slot,
      enhanceLevel: 0
    }
    if (slot === 'weapon' || slot === 'gloves') {
      return createItem({ ...common, attackBonus: bonus })
    }
    if (slot === 'helmet' || slot === 'armor') {
      return createItem({
        ...common,
        defenseBonus: bonus,
        hpBonus: slot === 'armor' ? bonus * 5 : 0
      })
    }
    if (slot === 'boots') {
      return createItem({ ...common, dodgeBonus: Math.min(0.5, bonus * 0.01), attackSpeedBonus: bonus })
    }
    if (slot === 'ring') {
      return createItem({ ...common, criticalBonus: Math.min(0.75, bonus * 0.01), attackBonus: Math.ceil(bonus / 2) })
    }
    return createItem({ ...common, hpBonus: bonus * 5, mpBonus: bonus * 3, defenseBonus: Math.ceil(bonus / 2) })
  }

  const removeItem = (itemId: string) => {
    inventory.value = inventory.value.filter(item => item.id !== itemId)
  }

  const sellItem = (itemId: string, quantity?: number): boolean => {
    const item = inventory.value.find(existing => existing.id === itemId)
    if (!item) {
      autoMessage.value = 'Không tìm thấy vật phẩm cần bán'
      return false
    }

    const sellQuantity = quantity ?? item.quantity
    if (!Number.isSafeInteger(sellQuantity) || sellQuantity <= 0 || sellQuantity > item.quantity) {
      autoMessage.value = 'Số lượng bán không hợp lệ'
      return false
    }

    const value = getItemSellPrice(item) * sellQuantity
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(gold.value + value)) {
      autoMessage.value = 'Không thể bán vật phẩm vì số vàng vượt giới hạn an toàn'
      return false
    }

    gold.value += value
    if (sellQuantity === item.quantity) {
      removeItem(itemId)
    } else {
      item.quantity -= sellQuantity
    }
    autoMessage.value = `Đã bán ${item.name} x${sellQuantity} · nhận ${value} vàng`
    persistGame()
    if (accountEmail.value) void persistRemoteGame()
    return true
  }

  const buyHealingPotion = (quantity = 1): boolean => {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      autoMessage.value = 'Số lượng mua không hợp lệ'
      return false
    }

    const totalPrice = HEALING_POTION_PRICE * quantity
    if (!Number.isSafeInteger(totalPrice) || gold.value < totalPrice) {
      autoMessage.value = `Cần ${totalPrice} vàng để mua ${quantity} thuốc hồi phục`
      return false
    }

    const potionStack = inventory.value.find(
      item => item.type === 'consumable' && item.name === 'Thuốc hồi phục'
    )
    if (
      (potionStack && potionStack.quantity + quantity > MAX_STACK_SIZE) ||
      (!potionStack && inventory.value.length >= INVENTORY_CAPACITY)
    ) {
      autoMessage.value = 'Không thể mua thuốc: túi đồ đã đầy hoặc chồng thuốc đã đủ 999'
      return false
    }

    const potion = createItem({
      name: 'Thuốc hồi phục',
      type: 'consumable',
      rarity: 'Thường',
      quantity,
      healAmount: 50
    })
    if (!addItem(potion)) {
      autoMessage.value = 'Không thể thêm thuốc vào túi đồ'
      return false
    }

    gold.value -= totalPrice
    autoMessage.value = `Đã mua Thuốc hồi phục x${quantity} · -${totalPrice} vàng`
    persistGame()
    if (accountEmail.value) void persistRemoteGame()
    return true
  }

  const buyEquipment = (slot: EquipmentSlot): boolean => {
    const stock = EQUIPMENT_SHOP[slot]
    if (gold.value < stock.price) {
      autoMessage.value = `Cần ${stock.price} vàng để mua ${stock.name}`
      return false
    }
    if (inventory.value.length >= INVENTORY_CAPACITY) {
      autoMessage.value = 'Túi đồ đã đầy; không thể mua trang bị'
      return false
    }

    const item = createItem({
      name: stock.name,
      type: 'equipment',
      rarity: 'Tốt',
      quantity: 1,
      slot,
      ...(slot === 'weapon' || slot === 'gloves'
        ? { attackBonus: stock.bonus }
        : slot === 'helmet'
          ? { defenseBonus: stock.bonus }
          : slot === 'armor'
            ? { defenseBonus: stock.bonus, hpBonus: stock.bonus * 5 }
            : slot === 'boots'
              ? { dodgeBonus: stock.bonus * 0.01, attackSpeedBonus: stock.bonus }
              : slot === 'ring'
                ? { attackBonus: stock.bonus, criticalBonus: stock.bonus * 0.01 }
                : { hpBonus: stock.bonus * 5, mpBonus: stock.bonus * 3 })
    })
    if (!addItem(item)) {
      autoMessage.value = 'Không thể thêm trang bị vào túi đồ'
      return false
    }

    gold.value -= stock.price
    autoMessage.value = `Đã mua ${stock.name} · -${stock.price} vàng`
    persistGame()
    if (accountEmail.value) void persistRemoteGame()
    return true
  }

  const equipItem = (itemId: string): boolean => {
    const index = inventory.value.findIndex(item => item.id === itemId)
    const item = inventory.value[index]
    if (index < 0 || item?.type !== 'equipment' || !item.slot) return false
    if (![
      'weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'necklace'
    ].includes(item.slot)) {
      autoMessage.value = 'Vị trí trang bị không hợp lệ'
      return false
    }

    inventory.value.splice(index, 1)
    const previousItem = equipment.value[item.slot]
    equipment.value[item.slot] = item
    if (previousItem) inventory.value.push(previousItem)
    hp.value = Math.min(hp.value, maxHp.value)
    mp.value = Math.min(mp.value, maxMp.value)
    autoMessage.value = `Đã trang bị ${item.name}`
    persistGame()
    if (accountEmail.value) void persistRemoteGame()
    return true
  }

  const unequipItem = (slot: EquipmentSlot): boolean => {
    const item = equipment.value[slot]
    if (!item) {
      autoMessage.value = 'Ô trang bị đang trống'
      return false
    }
    if (inventory.value.length >= INVENTORY_CAPACITY) {
      autoMessage.value = 'Túi đồ đã đầy; hãy tạo chỗ trống trước khi tháo trang bị'
      return false
    }

    inventory.value.push(item)
    delete equipment.value[slot]
    hp.value = Math.min(hp.value, maxHp.value)
    mp.value = Math.min(mp.value, maxMp.value)
    autoMessage.value = `Đã tháo ${item.name}`
    persistGame()
    if (accountEmail.value) void persistRemoteGame()
    return true
  }

  const useItem = (itemId: string): boolean => {
    const item = inventory.value.find(existing => existing.id === itemId)
    if (!item || item.type !== 'consumable' || !item.healAmount) {
      autoMessage.value = 'Vật phẩm này không thể sử dụng'
      return false
    }
    if (hp.value <= 0) {
      autoMessage.value = 'Không thể dùng thuốc khi đang gục ngã'
      return false
    }
    if (hp.value >= maxHp.value) {
      autoMessage.value = 'HP đã đầy; hãy dùng thuốc sau khi bị thương'
      return false
    }

    restoreHealth(item.healAmount)
    item.quantity--
    if (item.quantity <= 0) removeItem(itemId)
    autoMessage.value = `Đã dùng ${item.name} · hồi ${item.healAmount} HP`
    persistGame()
    if (accountEmail.value) void persistRemoteGame()
    return true
  }

  const useHealingPotion = (): boolean => {
    const potion = inventory.value.find(item => item.type === 'consumable' && item.quantity > 0)
    return potion ? useItem(potion.id) : false
  }

  const useHealingPotionIfHpAtOrBelow = (healthRatio: number): boolean => {
    if (
      !Number.isFinite(healthRatio) ||
      healthRatio < 0 ||
      healthRatio > 1 ||
      hp.value <= 0 ||
      hp.value / maxHp.value > healthRatio
    ) return false

    return useHealingPotion()
  }

  const enhanceWeapon = async (itemId: string): Promise<'success' | 'failed' | 'error'> => {
    const item = inventory.value.find(existing => existing.id === itemId)
    if (!item || item.type !== 'equipment' || item.slot !== 'weapon') {
      autoMessage.value = 'Chỉ có thể cường hóa vũ khí trong túi đồ'
      return 'error'
    }
    if (forgeInProgress.value) return 'error'

    forgeInProgress.value = true
    try {
      const result = await gameApi.enhanceWeapon(itemId)
      const currentLevel = item.enhanceLevel ?? 0
      const expectedCost = [1000, 2000, 3000][currentLevel]
      if (
        (result.status !== 'success' && result.status !== 'failed') ||
        result.cost !== expectedCost ||
        result.newLevel !== currentLevel + (result.status === 'success' ? 1 : 0)
      ) {
        throw new GameApiError('Kết quả cường hóa từ máy chủ không nhất quán.', 502)
      }
      const candidate = {
        ...getSaveData(),
        gold: result.currentGold,
        inventory: inventory.value.map(existing =>
          existing.id === itemId ? result.item : existing
        )
      }
      if (
        !isPlayerSaveData(candidate) ||
        !Number.isSafeInteger(result.cost) ||
        result.cost <= 0 ||
        !Number.isInteger(result.newLevel) ||
        result.newLevel < 0 ||
        result.newLevel > 3
      ) {
        throw new GameApiError('Dữ liệu cường hóa từ máy chủ không hợp lệ.', 502)
      }

      const updatedItem = candidate.inventory.find(existing => existing.id === itemId)
      if (
        !updatedItem ||
        updatedItem.type !== 'equipment' ||
        updatedItem.slot !== 'weapon' ||
        updatedItem.enhanceLevel !== result.newLevel ||
        result.currentGold < 0
      ) {
        throw new GameApiError('Kết quả cường hóa không khớp với vũ khí.', 502)
      }

      gold.value = candidate.gold
      inventory.value = candidate.inventory
      autoMessage.value = result.status === 'success'
        ? `${updatedItem.name} đã cường hóa thành công lên +${result.newLevel}`
        : `Cường hóa thất bại · đã trừ ${result.cost} vàng`
      return result.status
    } catch (error) {
      autoMessage.value = error instanceof Error ? error.message : 'Không thể cường hóa vũ khí.'
      return 'error'
    } finally {
      forgeInProgress.value = false
    }
  }

  const recordMonsterDefeat = () => {
    const quest = quests.value.find(item => item.id === 'slime-hunt')
    if (quest) quest.progress = Math.min(quest.required, quest.progress + 1)
  }

  const claimQuest = (questId: string): boolean => {
    const quest = quests.value.find(item => item.id === questId)
    if (!quest) {
      autoMessage.value = 'Không tìm thấy nhiệm vụ'
      return false
    }
    if (quest.claimed) {
      autoMessage.value = `Phần thưởng nhiệm vụ "${quest.title}" đã được nhận`
      return false
    }
    if (quest.progress < quest.required) {
      autoMessage.value = `Nhiệm vụ "${quest.title}" chưa hoàn thành`
      return false
    }

    quest.claimed = true
    gainExp(quest.rewardExp)
    gold.value += quest.rewardGold
    autoMessage.value = `Hoàn thành nhiệm vụ: ${quest.title}`
    return true
  }

  const getSaveData = (): PlayerSaveData => ({
    version: 1,
    savedAt: new Date().toISOString(),
    playerName: playerName.value,
    avatar: playerAvatar.value,
    level: level.value,
    exp: exp.value,
    gold: gold.value,
    hp: hp.value,
    mp: mp.value,
    inventory: inventory.value,
    equipment: equipment.value,
    quests: quests.value.map(({ id, progress, claimed }) => ({ id, progress, claimed }))
  })

  const restoreSaveData = (data: PlayerSaveData) => {
    playerName.value =
      typeof data.playerName === 'string' && data.playerName.trim()
        ? data.playerName.trim().slice(0, 24)
        : 'Nấm Lùn'
    playerAvatar.value =
      data.avatar === 'hero-scout' ? 'hero-scout' : 'hero-mushroom'
    level.value = data.level
    exp.value = data.exp
    gold.value = data.gold
    hp.value = data.hp
    mp.value = data.mp
    inventory.value = data.inventory
    equipment.value = data.equipment
    quests.value = createQuests().map(quest => {
      const savedQuest = data.quests.find(item => item.id === quest.id)
      return savedQuest
        ? { ...quest, progress: savedQuest.progress, claimed: savedQuest.claimed }
        : quest
    })
    autoBattle.value = false
    autoState.value = 'IDLE'
    clearTargetState()
    autoMessage.value = 'Đã khôi phục tiến trình · Auto đang tắt'
    nextItemId = Math.max(
      0,
      ...[...inventory.value, ...Object.values(equipment.value)]
        .map(item => Number(item.id.match(/^item-(\d+)$/)?.[1] ?? 0))
    ) + 1
  }

  const initializeGame = () => {
    const settings = loadGameSettings()
    const mountSettings = loadSelectedMount()
    autoPotionThreshold.value = settings.autoPotionThreshold
    mountId.value = mountSettings.mountId
    settingsStatus.value = [settings.error, mountSettings.error].filter(Boolean).join(' ')

    const result = loadPlayerSave()
    if (result.status === 'invalid') {
      saveBlocked.value = true
      saveStatus.value = result.message
      return
    }

    if (result.status === 'empty') {
      saveStatus.value = 'Chưa có dữ liệu lưu · tự động lưu trên thiết bị này'
      return
    }

    restoreSaveData(result.data)
    saveStatus.value = `Đã khôi phục tiến trình · ${new Date(result.data.savedAt).toLocaleString()}`
  }

  const syncAuthenticatedSave = async () => {
    persistGame()
    if (accountEmail.value && !saveBlocked.value) {
      await persistRemoteGame()
    }
  }

  const loadAccount = async () => {
    authLoading.value = true
    accountStatusType.value = 'loading'
    try {
      accountStatus.value = 'Đang kiểm tra phiên đăng nhập…'
      const { user } = await gameApi.currentUser()
      accountEmail.value = user.email
      const { character } = await gameApi.loadCharacter()
      if (!isPlayerSaveData(character)) {
        throw new GameApiError('Dữ liệu nhân vật từ máy chủ không hợp lệ.', 502)
      }

      restoreSaveData(character)
      await syncAuthenticatedSave()
      accountStatus.value = `Đã đăng nhập · ${user.email}`
      accountStatusType.value = 'success'
    } catch (error) {
      if (error instanceof GameApiError && error.status === 401) {
        accountEmail.value = null
        accountStatus.value = 'Chưa đăng nhập · tiến trình đang lưu trên thiết bị'
        accountStatusType.value = 'neutral'
        return
      }

      accountEmail.value = null
      accountStatus.value = error instanceof Error ? error.message : 'Không tải được dữ liệu tài khoản.'
      accountStatusType.value = 'error'
    } finally {
      authLoading.value = false
    }
  }

  const authenticate = async (action: 'login' | 'register', email: string, password: string) => {
    authLoading.value = true
    accountStatusType.value = 'loading'
    try {
      accountStatus.value = action === 'login'
        ? 'Đang đăng nhập…'
        : 'Đang tạo tài khoản…'
      const result = action === 'register'
        ? await gameApi.register(email, password, getSaveData())
        : await gameApi.login(email, password)
      if (!isPlayerSaveData(result.character)) {
        throw new GameApiError('Dữ liệu nhân vật từ máy chủ không hợp lệ.', 502)
      }

      accountEmail.value = result.user.email
      restoreSaveData(result.character)
      await syncAuthenticatedSave()
      accountStatus.value = `Đã đăng nhập · ${result.user.email}`
      accountStatusType.value = 'success'
    } catch (error) {
      accountEmail.value = null
      accountStatus.value = error instanceof Error ? error.message : 'Không thể xác thực tài khoản.'
      accountStatusType.value = 'error'
    } finally {
      authLoading.value = false
    }
  }

  const login = (email: string, password: string) => authenticate('login', email, password)
  const register = (email: string, password: string) => authenticate('register', email, password)

  const logout = async () => {
    authLoading.value = true
    accountStatusType.value = 'loading'
    const wasAuthenticated = Boolean(accountEmail.value)
    const localSaveSucceeded = persistGame()
    let remoteSaveSucceeded = false
    try {
      if (wasAuthenticated && !saveBlocked.value) {
        remoteSaveSucceeded = await persistRemoteGame()
      }

      accountStatus.value = 'Đang đăng xuất…'
      await gameApi.logout()
      accountEmail.value = null
      const savedTargets = [
        localSaveSucceeded ? 'thiết bị' : '',
        wasAuthenticated && remoteSaveSucceeded ? 'máy chủ' : ''
      ].filter(Boolean)
      accountStatus.value = savedTargets.length
        ? `Đã đăng xuất · tiến trình đã lưu trên ${savedTargets.join(' và ')}`
        : 'Đã đăng xuất · không lưu được tiến trình trên thiết bị hoặc máy chủ'
      accountStatusType.value = localSaveSucceeded && (!wasAuthenticated || remoteSaveSucceeded)
        ? 'success'
        : 'error'
    } catch (error) {
      accountEmail.value = null
      accountStatus.value = error instanceof Error ? error.message : 'Không thể đăng xuất.'
      accountStatusType.value = 'error'
    } finally {
      authLoading.value = false
    }
  }

  const persistGame = (): boolean => {
    if (saveBlocked.value) return false

    const error = writePlayerSave(getSaveData())
    saveStatus.value = error ?? `Đã lưu lúc ${new Date().toLocaleTimeString()}`
    return !error
  }

  const persistRemoteGame = (): Promise<boolean> => {
    if (!accountEmail.value || saveBlocked.value) return Promise.resolve(false)
    if (remoteSavePromise) {
      remoteSaveRequested = true
      return remoteSavePromise
    }

    remoteSaveInProgress.value = true
    accountStatus.value = 'Đang đồng bộ dữ liệu máy chủ…'
    accountStatusType.value = 'loading'

    remoteSavePromise = (async () => {
      let succeeded = true
      try {
        do {
          remoteSaveRequested = false
          const email: string | null = accountEmail.value
          if (!email || saveBlocked.value) break

          const { savedAt } = await gameApi.saveCharacter(getSaveData())
          if (accountEmail.value === email) {
            accountStatus.value = `Đã đồng bộ máy chủ · ${new Date(savedAt).toLocaleTimeString()}`
            accountStatusType.value = 'success'
          }
        } while (remoteSaveRequested && accountEmail.value && !saveBlocked.value)
      } catch (error) {
        succeeded = false
        accountStatus.value = error instanceof Error ? error.message : 'Không đồng bộ được tiến trình.'
        accountStatusType.value = 'error'
      } finally {
        remoteSaveInProgress.value = false
        remoteSavePromise = null
      }

      return succeeded
    })()

    return remoteSavePromise
  }

  const startNewGame = (): boolean => {
    const error = resetPlayerSave()
    if (error) {
      saveStatus.value = error
      return false
    }

    saveBlocked.value = false
    level.value = 1
    exp.value = 0
    gold.value = 0
    hp.value = 100
    mp.value = 50
    playerName.value = 'Nấm Lùn'
    playerAvatar.value = 'hero-mushroom'
    autoBattle.value = false
    inventory.value = []
    equipment.value = {}
    quests.value = createQuests()
    autoState.value = 'IDLE'
    clearTargetState()
    autoMessage.value = 'Sẵn sàng chiến đấu'
    lootMessage.value = ''
    nextItemId = 1
    saveStatus.value = 'Trình duyệt đã xóa dữ liệu lưu · chơi mới chưa lưu'
    return true
  }

  return {
    playerName,
    playerAvatar,
    level,
    exp,
    gold,
    hp,
    mp,
    autoBattle,
    autoPotionThreshold,
    mountId,
    inventory,
    equipment,
    attackPower,
    defensePower,
    maxHp,
    maxMp,
    attackSpeed,
    criticalChance,
    dodgeChance,
    quests,
    autoState,
    currentTarget,
    currentTargetId,
    currentTargetHp,
    currentTargetMaxHp,
    currentTargetDistance,
    currentTargetInRange,
    attackCooldownRemaining,
    skillCooldownRemaining,
    autoMessage,
    lootMessage,
    saveStatus,
    settingsStatus,
    accountEmail,
    authLoading,
    remoteSaveInProgress,
    accountStatus,
    accountStatusType,
    forgeInProgress,
    forgeOpen,
    openForgePanel,
    closeForgePanel,
    clearTargetState,
    setAutoBattle,
    setAutoPotionThreshold,
    setMount,
    setPlayerProfile,
    gainExp,
    regenerateMp,
    takeDamage,
    restoreHealth,
    addItem,
    createItem,
    createLootEquipment,
    removeItem,
    sellItem,
    buyHealingPotion,
    buyEquipment,
    equipItem,
    unequipItem,
    useItem,
    useHealingPotion,
    useHealingPotionIfHpAtOrBelow,
    enhanceWeapon,
    recordMonsterDefeat,
    claimQuest,
    getSaveData,
    restoreSaveData,
    initializeGame,
    loadAccount,
    login,
    register,
    logout,
    persistRemoteGame,
    persistGame,
    startNewGame
  }
})