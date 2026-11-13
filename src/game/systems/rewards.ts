export const rollGoldReward = (
  min: number,
  max: number,
  random: () => number = Math.random
): number => {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || max < min) {
    throw new RangeError('Gold reward bounds must be non-negative safe integers with max >= min.')
  }

  const roll = random()
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError('Random roll must be between 0 (inclusive) and 1 (exclusive).')
  }

  return min + Math.floor(roll * (max - min + 1))
}
