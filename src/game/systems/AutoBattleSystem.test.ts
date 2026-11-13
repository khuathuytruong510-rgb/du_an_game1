import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AutoBattleSystem, type Monster } from './AutoBattleSystem'

const createCombat = (options: {
  mp?: number
  x?: number
  enabled?: boolean
  criticalChance?: number
  random?: () => number
  extraMonsters?: Monster[]
  canAct?: boolean
} = {}) => {
  const player = { x: 0, y: 0 }
  const monster: Monster = {
    id: 'target',
    name: 'Slime',
    x: options.x ?? 20,
    y: 0,
    hp: 100,
    maxHp: 100,
    expValue: 10,
    isAlive: true
  }
  let mp = options.mp ?? 30
  let canAct = options.canAct ?? true
  const damage: number[] = []
  const criticalHits: boolean[] = []
  const warnings: string[] = []
  const defeated: string[] = []
  let selectedTargetId: string | null = null
  const combat = new AutoBattleSystem(player, {
    onStatus: (_state, target) => {
      selectedTargetId = target?.id ?? null
    },
    onMove: () => {},
    canAct: () => canAct,
    onUseSkill: cost => {
      if (mp < cost) return false
      mp -= cost
      return true
    },
    getAttackPower: () => 10,
    onDamage: (_target, amount, critical) => {
      damage.push(amount)
      criticalHits.push(critical)
    },
    onDefeat: target => defeated.push(target.id),
    onWarning: message => warnings.push(message)
  }, { criticalChance: options.criticalChance ?? 0.1 }, options.random ?? (() => 0.5))

  combat.setMonsters([monster, ...(options.extraMonsters ?? [])])
  combat.selectTarget(monster.id)
  if (options.enabled) combat.toggleAuto(true)

  return {
    combat,
    monster,
    damage,
    criticalHits,
    warnings,
    defeated,
    getSelectedTargetId: () => selectedTargetId,
    getMp: () => mp,
    setCanAct: (allowed: boolean) => {
      canAct = allowed
    }
  }
}

test('manual skill spends MP and deals double attack damage', () => {
  const encounter = createCombat()

  assert.equal(encounter.combat.castSkillSelected(10_000), true)
  assert.equal(encounter.getMp(), 15)
  assert.equal(encounter.monster.hp, 80)
  assert.deepEqual(encounter.damage, [20])
})

test('manual skill enforces cooldown without spending MP or dealing damage', () => {
  const encounter = createCombat()

  assert.equal(encounter.combat.castSkillSelected(10_000), true)
  assert.equal(encounter.combat.getSkillCooldownRemaining(10_000), 4000)
  assert.equal(encounter.combat.getSkillCooldownRemaining(11_500), 2500)
  assert.equal(encounter.combat.getSkillCooldownRemaining(14_000), 0)
  assert.equal(encounter.combat.castSkillSelected(10_100), false)
  assert.equal(encounter.getMp(), 15)
  assert.equal(encounter.damage.length, 1)
  assert.match(encounter.warnings.at(-1) ?? '', /đang hồi chiêu/)
})

test('manual skill rejects insufficient MP, distant targets, and Auto mode', () => {
  const noMana = createCombat({ mp: 10 })
  assert.equal(noMana.combat.castSkillSelected(10_000), false)
  assert.equal(noMana.getMp(), 10)
  assert.equal(noMana.damage.length, 0)
  assert.match(noMana.warnings.at(-1) ?? '', /Không đủ MP/)

  const outOfRange = createCombat({ x: 200 })
  assert.equal(outOfRange.combat.castSkillSelected(10_000), false)
  assert.equal(outOfRange.getMp(), 30)
  assert.match(outOfRange.warnings.at(-1) ?? '', /quá xa/)

  const auto = createCombat({ enabled: true })
  assert.equal(auto.combat.castSkillSelected(10_000), false)
  assert.equal(auto.getMp(), 30)
  assert.match(auto.warnings.at(-1) ?? '', /tắt Auto/)
})

test('manual attack and skill cannot act during the respawn lifecycle', () => {
  const encounter = createCombat({ canAct: false })

  encounter.combat.toggleAuto(true)
  assert.equal(encounter.combat.attackSelected(10_000), false)
  assert.equal(encounter.combat.castSkillSelected(10_000), false)
  encounter.combat.update(16, 10_000)
  assert.equal(encounter.monster.hp, 100)
  assert.equal(encounter.getSelectedTargetId(), 'target')
  assert.equal(encounter.getMp(), 30)
  assert.match(encounter.warnings.at(-1) ?? '', /gục ngã/)

  encounter.setCanAct(true)
  assert.equal(encounter.combat.attackSelected(10_001), true)
  assert.equal(encounter.monster.hp, 90)
})

test('Auto update cannot deal a final-frame attack after the player becomes unable to act', () => {
  const encounter = createCombat({ enabled: true })
  encounter.setCanAct(false)

  encounter.combat.update(16, 10_000)

  assert.equal(encounter.monster.hp, 100)
  assert.equal(encounter.getSelectedTargetId(), null)
  assert.equal(encounter.damage.length, 0)
})

test('reports selected target distance and attack range accurately', () => {
  const encounter = createCombat()
  assert.equal(encounter.combat.getSelectedTargetDistance(), 20)
  assert.equal(encounter.combat.isSelectedTargetInRange(), true)

  encounter.monster.x = 100
  assert.equal(encounter.combat.getSelectedTargetDistance(), 100)
  assert.equal(encounter.combat.isSelectedTargetInRange(), false)

  encounter.monster.isAlive = false
  assert.equal(encounter.combat.getSelectedTargetDistance(), null)
  assert.equal(encounter.combat.isSelectedTargetInRange(), false)
})

test('moves toward a selected target and stops just inside attack range', () => {
  const encounter = createCombat({ x: 200 })

  assert.equal(encounter.combat.moveTowardSelectedTarget(100), 'moving')
  assert.equal(encounter.combat.getSelectedTargetDistance(), 181)

  assert.equal(encounter.combat.moveTowardSelectedTarget(1000), 'arrived')
  assert.ok(Math.abs((encounter.combat.getSelectedTargetDistance() ?? 0) - 74) < 1e-9)
  assert.equal(encounter.combat.isSelectedTargetInRange(), true)
  assert.equal(encounter.damage.length, 0)
})

test('cannot manually approach without a target or while Auto is on', () => {
  const auto = createCombat({ x: 200, enabled: true })
  assert.equal(auto.combat.moveTowardSelectedTarget(1000), 'unavailable')
  assert.equal(auto.combat.getSelectedTargetDistance(), null)

  const noTarget = createCombat({ x: 200 })
  noTarget.combat.selectTarget('missing')
  noTarget.combat.toggleAuto(false)
  noTarget.combat.setMonsters([])
  assert.equal(noTarget.combat.moveTowardSelectedTarget(1000), 'unavailable')
})

test('cycles through living targets in both directions and skips defeated monsters', () => {
  const second: Monster = {
    id: 'second',
    name: 'Sói non',
    x: 30,
    y: 0,
    hp: 40,
    maxHp: 40,
    expValue: 12,
    isAlive: true
  }
  const defeated: Monster = {
    id: 'defeated',
    name: 'Goblin',
    x: 40,
    y: 0,
    hp: 0,
    maxHp: 50,
    expValue: 15,
    isAlive: false
  }
  const encounter = createCombat({ extraMonsters: [defeated, second] })

  assert.equal(encounter.combat.selectAdjacentTarget('next'), true)
  assert.equal(encounter.getSelectedTargetId(), 'second')
  assert.equal(encounter.combat.selectAdjacentTarget('next'), true)
  assert.equal(encounter.getSelectedTargetId(), 'target')
  assert.equal(encounter.combat.selectAdjacentTarget('previous'), true)
  assert.equal(encounter.getSelectedTargetId(), 'second')
})

test('reports the updated target HP after applying damage', () => {
  const encounter = createCombat()
  let observedHp = 0
  const combat = new AutoBattleSystem({ x: 0, y: 0 }, {
    onStatus: () => {},
    onMove: () => {},
    canAct: () => true,
    onUseSkill: () => false,
    getAttackPower: () => 10,
    onDamage: target => {
      observedHp = target.hp
    },
    onDefeat: () => {},
    onWarning: () => {}
  }, { criticalChance: 0 })
  combat.setMonsters([encounter.monster])
  combat.selectTarget(encounter.monster.id)
  combat.attackSelected(10_000)

  assert.equal(observedHp, 90)
})

test('manual attacks enforce the attack cooldown and allow attacking again afterward', () => {
  const encounter = createCombat()

  assert.equal(encounter.combat.getAttackCooldownRemaining(10_000), 0)
  assert.equal(encounter.combat.getSkillCooldownRemaining(10_000), 0)
  assert.equal(encounter.combat.attackSelected(10_000), true)
  assert.equal(encounter.combat.getAttackCooldownRemaining(10_000), 850)
  assert.equal(encounter.combat.attackSelected(10_100), false)
  assert.equal(encounter.combat.getAttackCooldownRemaining(10_100), 750)
  assert.equal(encounter.monster.hp, 90)
  assert.equal(encounter.damage.length, 1)
  assert.match(encounter.warnings.at(-1) ?? '', /đang hồi chiêu/)

  assert.equal(encounter.combat.attackSelected(10_850), true)
  assert.equal(encounter.combat.getAttackCooldownRemaining(10_850), 850)
  assert.equal(encounter.monster.hp, 80)
  assert.equal(encounter.damage.length, 2)
})

test('out-of-range manual attacks do not consume the attack cooldown', () => {
  const encounter = createCombat({ x: 200 })

  assert.equal(encounter.combat.attackSelected(10_000), false)
  encounter.monster.x = 20
  assert.equal(encounter.combat.attackSelected(10_000), true)
  assert.equal(encounter.monster.hp, 90)
})

test('critical hit doubles damage and reports the critical state', () => {
  const encounter = createCombat({
    criticalChance: 0.1,
    random: () => 0.09
  })

  encounter.combat.attackSelected(10_000)

  assert.equal(encounter.monster.hp, 80)
  assert.deepEqual(encounter.damage, [20])
  assert.deepEqual(encounter.criticalHits, [true])
})

test('non-critical hit keeps base damage', () => {
  const encounter = createCombat({
    criticalChance: 0.1,
    random: () => 0.1
  })

  encounter.combat.attackSelected(10_000)

  assert.equal(encounter.monster.hp, 90)
  assert.deepEqual(encounter.damage, [10])
  assert.deepEqual(encounter.criticalHits, [false])
})

test('map transition invalidates the old monster identity and resets cooldowns', () => {
  const encounter = createCombat()
  assert.equal(encounter.combat.castSkillSelected(10_000), true)
  assert.equal(encounter.combat.attackSelected(10_000), true)
  assert.equal(encounter.combat.getAttackCooldownRemaining(10_000), 850)
  assert.equal(encounter.combat.getSkillCooldownRemaining(10_000), 4000)

  const newMapMonster: Monster = {
    ...encounter.monster,
    hp: 100,
    isAlive: true
  }
  encounter.combat.setMonsters([newMapMonster])

  assert.equal(encounter.getSelectedTargetId(), null)
  assert.equal(encounter.combat.getAttackCooldownRemaining(10_001), 0)
  assert.equal(encounter.combat.getSkillCooldownRemaining(10_001), 0)
  assert.equal(encounter.combat.attackSelected(10_001), false)
  assert.equal(encounter.monster.hp, 70)

  encounter.combat.selectTarget(newMapMonster.id)
  assert.equal(encounter.combat.attackSelected(10_001), true)
  assert.equal(newMapMonster.hp, 90)
  assert.equal(encounter.monster.hp, 70)
})

test('rapid map transitions leave only the latest map monster attackable', () => {
  const encounter = createCombat()
  const intermediateMonster: Monster = { ...encounter.monster, id: 'intermediate' }
  const latestMonster: Monster = { ...encounter.monster, id: 'latest' }

  encounter.combat.setMonsters([intermediateMonster])
  encounter.combat.setMonsters([latestMonster])
  encounter.combat.selectTarget(latestMonster.id)

  assert.equal(encounter.combat.attackSelected(10_000), true)
  assert.equal(encounter.monster.hp, 100)
  assert.equal(intermediateMonster.hp, 100)
  assert.equal(latestMonster.hp, 90)
})

test('rapid Auto toggles clear the old target and cooldown before combat resumes', () => {
  const encounter = createCombat()
  assert.equal(encounter.combat.attackSelected(10_000), true)
  assert.equal(encounter.combat.attackSelected(14_000), true)
  assert.equal(encounter.combat.castSkillSelected(14_000), true)
  assert.equal(encounter.combat.getAttackCooldownRemaining(14_000), 850)
  assert.equal(encounter.combat.getSkillCooldownRemaining(14_000), 4000)

  encounter.combat.toggleAuto(true)
  encounter.combat.toggleAuto(false)
  encounter.combat.toggleAuto(true)

  assert.equal(encounter.getSelectedTargetId(), null)
  assert.equal(encounter.combat.getAttackCooldownRemaining(14_001), 0)
  assert.equal(encounter.combat.getSkillCooldownRemaining(14_001), 0)
  encounter.combat.update(16, 14_001)
  assert.equal(encounter.getSelectedTargetId(), 'target')
  assert.equal(encounter.monster.hp, 40)
})

test('enabling Auto clears the manual target and internal cooldowns before selecting again', () => {
  const secondTarget: Monster = {
    id: 'second-target',
    name: 'Sói non',
    x: 30,
    y: 0,
    hp: 100,
    maxHp: 100,
    expValue: 12,
    isAlive: true
  }
  const encounter = createCombat({ extraMonsters: [secondTarget] })
  encounter.combat.selectTarget(secondTarget.id)
  assert.equal(encounter.combat.attackSelected(10_000), true)

  encounter.combat.toggleAuto(true)

  assert.equal(encounter.getSelectedTargetId(), null)
  assert.equal(encounter.combat.getAttackCooldownRemaining(10_001), 0)
  encounter.combat.update(16, 10_001)
  assert.equal(encounter.getSelectedTargetId(), 'target')
  assert.equal(secondTarget.hp, 90)
  assert.equal(encounter.monster.hp, 80)
})

test('repeated Auto-on event preserves the active target in the same scene lifecycle', () => {
  const encounter = createCombat({ enabled: true })
  encounter.combat.update(16, 10_000)
  assert.equal(encounter.getSelectedTargetId(), 'target')
  assert.equal(encounter.monster.hp, 80)

  encounter.combat.toggleAuto(true)

  assert.equal(encounter.getSelectedTargetId(), 'target')
  encounter.combat.update(16, 10_100)
  assert.equal(encounter.monster.hp, 80)
})

test('invalidating a selected target clears it and both cooldown clocks', () => {
  const encounter = createCombat()
  assert.equal(encounter.combat.attackSelected(10_000), true)
  assert.equal(encounter.combat.castSkillSelected(10_850), true)
  encounter.monster.isAlive = false

  assert.equal(encounter.combat.attackSelected(10_851), false)

  assert.equal(encounter.getSelectedTargetId(), null)
  assert.equal(encounter.combat.getAttackCooldownRemaining(10_851), 0)
  assert.equal(encounter.combat.getSkillCooldownRemaining(10_851), 0)
  assert.equal(encounter.combat.attackSelected(10_851), false)
  assert.equal(encounter.monster.hp, 70)
})

test('Auto Combat resumes against the new map roster rather than the old target', () => {
  const encounter = createCombat({ enabled: true })
  const newMapMonster: Monster = { ...encounter.monster, id: 'new-map-target' }

  encounter.combat.setMonsters([newMapMonster])
  encounter.combat.update(16, 10_000)

  assert.equal(encounter.getSelectedTargetId(), newMapMonster.id)
  assert.equal(encounter.monster.hp, 100)
  assert.equal(newMapMonster.hp, 80)
})

test('defeating a monster clears internal cooldowns and cannot award defeat twice', () => {
  const encounter = createCombat()
  encounter.monster.hp = 10

  assert.equal(encounter.combat.attackSelected(10_000), true)
  assert.equal(encounter.monster.isAlive, false)
  assert.equal(encounter.combat.getAttackCooldownRemaining(10_000), 0)
  assert.equal(encounter.combat.getSkillCooldownRemaining(10_000), 0)
  assert.equal(encounter.getSelectedTargetId(), null)
  assert.deepEqual(encounter.defeated, ['target'])
  assert.equal(encounter.combat.attackSelected(10_001), false)
  assert.deepEqual(encounter.defeated, ['target'])
})

test('disposed combat cannot run stale callbacks or affect a new target selection', () => {
  const oldCombat = createCombat({ enabled: true })
  oldCombat.combat.dispose()

  const newMapMonster: Monster = {
    id: 'new-target',
    name: 'Sói non',
    x: 20,
    y: 0,
    hp: 100,
    maxHp: 100,
    expValue: 12,
    isAlive: true
  }
  const newCombat = createCombat({ extraMonsters: [newMapMonster] })
  newCombat.combat.selectTarget(newMapMonster.id)

  oldCombat.combat.update(16, 20_000)
  oldCombat.combat.toggleAuto(false)
  oldCombat.combat.selectTarget(oldCombat.monster.id)
  assert.equal(oldCombat.combat.attackSelected(20_000), false)

  assert.equal(newCombat.getSelectedTargetId(), newMapMonster.id)
  assert.equal(newMapMonster.hp, 100)
  assert.deepEqual(oldCombat.damage, [])
})
