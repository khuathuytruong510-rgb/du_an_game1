export const AUTO_POTION_THRESHOLDS = [0.25, 0.35, 0.5] as const
export type AutoPotionThreshold = typeof AUTO_POTION_THRESHOLDS[number]
export const MOUNT_IDS = ['ice-dragon', 'mechanical-frog'] as const
export type MountId = typeof MOUNT_IDS[number]

const SETTINGS_KEY = 'chien-gioi.settings.v1'
const MOUNT_KEY = 'chien-gioi.mount.v1'
type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface GameSettingsLoadResult {
  autoPotionThreshold: AutoPotionThreshold
  error: string | null
}

export interface MountSettingsLoadResult {
  mountId: MountId | null
  error: string | null
}

export const isAutoPotionThreshold = (value: unknown): value is AutoPotionThreshold =>
  AUTO_POTION_THRESHOLDS.some(threshold => threshold === value)

export const isMountId = (value: unknown): value is MountId =>
  MOUNT_IDS.some(mountId => mountId === value)

export const loadGameSettings = (storage?: SettingsStorage): GameSettingsLoadResult => {
  try {
    const serialized = (storage ?? window.localStorage).getItem(SETTINGS_KEY)
    if (serialized === null) return { autoPotionThreshold: 0.35, error: null }

    const settings: unknown = JSON.parse(serialized)
    if (
      typeof settings !== 'object' ||
      settings === null ||
      !('version' in settings) ||
      settings.version !== 1 ||
      !('autoPotionThreshold' in settings) ||
      !isAutoPotionThreshold(settings.autoPotionThreshold)
    ) {
      return {
        autoPotionThreshold: 0.35,
        error: 'Cài đặt không hợp lệ; đang dùng ngưỡng thuốc mặc định 35%.'
      }
    }

    return { autoPotionThreshold: settings.autoPotionThreshold, error: null }
  } catch {
    return {
      autoPotionThreshold: 0.35,
      error: 'Không thể đọc cài đặt từ trình duyệt; đang dùng ngưỡng thuốc mặc định 35%.'
    }
  }
}

export const writeGameSettings = (
  autoPotionThreshold: AutoPotionThreshold,
  storage?: SettingsStorage
): string | null => {
  try {
    const target = storage ?? window.localStorage
    target.setItem(SETTINGS_KEY, JSON.stringify({
      version: 1,
      autoPotionThreshold
    }))
    return null
  } catch {
    return 'Không thể lưu cài đặt trên thiết bị này.'
  }
}

export const loadSelectedMount = (storage?: SettingsStorage): MountSettingsLoadResult => {
  try {
    const serialized = (storage ?? window.localStorage).getItem(MOUNT_KEY)
    if (serialized === null) return { mountId: null, error: null }

    const mountId: unknown = JSON.parse(serialized)
    if (mountId !== null && !isMountId(mountId)) {
      return {
        mountId: null,
        error: 'Thú cưỡi đã lưu không hợp lệ; đã bỏ lựa chọn cũ.'
      }
    }

    return { mountId, error: null }
  } catch {
    return {
      mountId: null,
      error: 'Không thể đọc thú cưỡi đã lưu trên thiết bị này.'
    }
  }
}

export const writeSelectedMount = (
  mountId: MountId | null,
  storage?: SettingsStorage
): string | null => {
  if (mountId !== null && !isMountId(mountId)) {
    return 'Thú cưỡi không hợp lệ.'
  }

  try {
    const target = storage ?? window.localStorage
    target.setItem(MOUNT_KEY, JSON.stringify(mountId))
    return null
  } catch {
    return 'Không thể lưu thú cưỡi trên thiết bị này.'
  }
}
