import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rollGoldReward } from './rewards'

test('rolls an inclusive integer reward across the configured gold range', () => {
  assert.equal(rollGoldReward(2, 5, () => 0), 2)
  assert.equal(rollGoldReward(2, 5, () => 0.5), 4)
  assert.equal(rollGoldReward(2, 5, () => 0.999), 5)
  assert.equal(rollGoldReward(8, 8, () => 0.3), 8)
})

test('rejects invalid reward bounds and random rolls', () => {
  assert.throws(() => rollGoldReward(-1, 5), RangeError)
  assert.throws(() => rollGoldReward(6, 5), RangeError)
  assert.throws(() => rollGoldReward(0.5, 5), RangeError)
  assert.throws(() => rollGoldReward(2, 5, () => 1), RangeError)
  assert.throws(() => rollGoldReward(2, 5, () => Number.NaN), RangeError)
})
