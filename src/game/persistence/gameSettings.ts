export const AUTO_POTION_THRESHOLDS = [0.25, 0.35, 0.5] as const
export type AutoPotionThreshold = typeof AUTO_POTION_THRESHOLDS[number]

const SETTINGS_KEY = 'chien-gioi.settings.v1'
type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface GameSettingsLoadResult {
  autoPotionThreshold: AutoPotionThreshold
  error: string | null
}

export const isAutoPotionThreshold = (value: unknown): value is AutoPotionThreshold =>
  AUTO_POTION_THRESHOLDS.some(threshold => threshold === value)

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
