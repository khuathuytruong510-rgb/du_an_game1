import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  loadGameSettings,
  loadSelectedMount,
  writeGameSettings,
  writeSelectedMount
} from './gameSettings'

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

test('persists and restores a selected mount independently of combat saves', () => {
  const storage = createStorage()

  assert.deepEqual(loadSelectedMount(storage), { mountId: null, error: null })
  assert.equal(writeSelectedMount('mechanical-frog', storage), null)
  assert.deepEqual(loadSelectedMount(storage), { mountId: 'mechanical-frog', error: null })

  assert.equal(writeSelectedMount(null, storage), null)
  assert.deepEqual(loadSelectedMount(storage), { mountId: null, error: null })
})

test('rejects corrupt mount settings and reports storage errors', () => {
  assert.deepEqual(loadSelectedMount(createStorage('"not-a-mount"')), {
    mountId: null,
    error: 'Thú cưỡi đã lưu không hợp lệ; đã bỏ lựa chọn cũ.'
  })

  const failingStorage = {
    getItem: () => { throw new Error('storage is unavailable') },
    setItem: () => { throw new Error('storage is unavailable') }
  }
  assert.deepEqual(loadSelectedMount(failingStorage), {
    mountId: null,
    error: 'Không thể đọc thú cưỡi đã lưu trên thiết bị này.'
  })
  assert.equal(writeSelectedMount('ice-dragon', failingStorage), 'Không thể lưu thú cưỡi trên thiết bị này.')
})
