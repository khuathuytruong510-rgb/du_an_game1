import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadGameSettings, writeGameSettings } from './gameSettings'

const createStorage = (initialValue: string | null = null) => {
  let value = initialValue
  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue
    },
    getValue: () => value
  }
}

test('loads the default auto potion threshold when no device settings exist', () => {
  assert.deepEqual(loadGameSettings(createStorage()), {
    autoPotionThreshold: 0.35,
    error: null
  })
})

test('persists and restores a supported auto potion threshold', () => {
  const storage = createStorage()

  assert.equal(writeGameSettings(0.5, storage), null)
  assert.deepEqual(loadGameSettings(storage), {
    autoPotionThreshold: 0.5,
    error: null
  })
})

test('rejects invalid stored thresholds and reports write failures', () => {
  const invalidStorage = createStorage('{"version":1,"autoPotionThreshold":0.9}')
  assert.deepEqual(loadGameSettings(invalidStorage), {
    autoPotionThreshold: 0.35,
    error: 'Cài đặt không hợp lệ; đang dùng ngưỡng thuốc mặc định 35%.'
  })

  const failingStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('storage is unavailable')
    }
  }
  assert.equal(writeGameSettings(0.25, failingStorage), 'Không thể lưu cài đặt trên thiết bị này.')
})
