import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { WebSocket } from 'ws'
import {
  createApiServer,
  hashPassword,
  isValidCharacter,
  verifyPassword,
  type AuthRepository,
  type ServerCharacter
} from './app.js'
import { enhanceWeapon } from './enhancement.js'
import { GAME_PROTOCOL_VERSION, decodeServerMessage, type ServerMessage } from '../shared/gameProtocol.js'

const PASSWORD = 'a-secure-test-password'
const ORIGIN = 'http://127.0.0.1:5173'
let nextEmail = 1

class MemoryRepository implements AuthRepository {
  private readonly users = new Map<string, { id: string; email: string; passwordHash: string }>()
  private readonly sessions = new Map<string, { id: string; email: string; expiresAt: Date }>()
  private readonly characters = new Map<string, ServerCharacter>()
  enhancementRoll = 1

  async register(email: string, passwordHash: string, character: ServerCharacter) {
    if (this.users.has(email)) throw Object.assign(new Error('duplicate'), { name: 'DuplicateEmailError' })
    const user = { id: `user-${this.users.size + 1}`, email, passwordHash }
    this.users.set(email, user)
    this.characters.set(user.id, structuredClone(character))
    return { id: user.id, email: user.email }
  }

  async findUserByEmail(email: string) {
    const user = this.users.get(email)
    return user ? { id: user.id, email: user.email, passwordHash: user.passwordHash } : null
  }

  async createSession(tokenHash: string, userId: string, expiresAt: Date) {
    const user = [...this.users.values()].find(item => item.id === userId)
    if (user) this.sessions.set(tokenHash, { id: user.id, email: user.email, expiresAt })
  }

  async findSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash)
    if (!session || session.expiresAt <= new Date()) return null
    return { id: session.id, email: session.email }
  }

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash)
  }

  async getCharacter(userId: string) {
    const character = this.characters.get(userId)
    if (!character) throw new Error('Character not found')
    return structuredClone(character)
  }

  async saveCharacter(userId: string, character: ServerCharacter) {
    if (!this.characters.has(userId)) throw new Error('Character not found')
    this.characters.set(userId, structuredClone(character))
  }

  setCharacter(email: string, character: ServerCharacter) {
    const user = this.users.get(email)
    if (!user) throw new Error('User not found')
    this.characters.set(user.id, structuredClone(character))
  }

  async enhanceWeapon(userId: string, inventoryId: string) {
    const character = this.characters.get(userId)
    if (!character) throw new Error('Character not found')
    const result = enhanceWeapon(character, inventoryId, () => this.enhancementRoll)
    if (result.ok) this.characters.set(userId, result.character)
    return result
  }
}

let server: ReturnType<typeof createApiServer>
let baseUrl: string
let repository: MemoryRepository
let forgeCookie = ''
let forgeEmail = ''

before(async () => {
  repository = new MemoryRepository()
  server = createApiServer(repository, { allowedOrigins: [ORIGIN] })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  server.close()
  await once(server, 'close')
})

const postJson = (path: string, body: unknown, cookie?: string) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body)
  })

const webSocketUrl = () => baseUrl.replace(/^http/, 'ws')

const connectGameSocket = (cookie?: string, origin = ORIGIN) =>
  new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(`${webSocketUrl()}/api/game`, {
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {})
      }
    })
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })

const getUpgradeStatus = (cookie?: string, origin = ORIGIN) =>
  new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(`${webSocketUrl()}/api/game`, {
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {})
      }
    })
    const timeout = setTimeout(() => reject(new Error('WebSocket handshake timed out')), 2000)
    socket.once('unexpected-response', (_request, response) => {
      clearTimeout(timeout)
      const status = response.statusCode ?? 0
      response.resume()
      resolve(status)
    })
    socket.once('open', () => {
      clearTimeout(timeout)
      socket.close()
      resolve(101)
    })
    socket.once('error', () => undefined)
  })

const receiveServerMessage = (socket: WebSocket): Promise<ServerMessage> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket response timed out')), 2000)
    socket.once('message', data => {
      clearTimeout(timeout)
      const decoded = decodeServerMessage(JSON.parse(data.toString()))
      if (!decoded.ok) {
        reject(new Error(`Invalid server protocol response: ${decoded.error}`))
        return
      }
      resolve(decoded.message)
    })
    socket.once('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
  })

const closeGameSocket = async (socket: WebSocket) => {
  if (socket.readyState === WebSocket.CLOSED) return
  const closed = once(socket, 'close')
  socket.close()
  await closed
}

const register = async (character?: ServerCharacter) => {
  const email = `player-${nextEmail++}@example.test`
  const response = await postJson('/api/auth/register', {
    email,
    password: PASSWORD,
    ...(character ? { character } : {})
  })
  assert.equal(response.status, 201)
  return { response, email, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' }
}

const characterWithWeapon = (gold = 10_000): ServerCharacter => ({
  version: 1,
  level: 1,
  exp: 0,
  gold,
  hp: 100,
  mp: 50,
  inventory: [{
    id: 'weapon-test',
    name: 'Kiếm tập sự',
    type: 'equipment',
    rarity: 'Tốt',
    quantity: 1,
    slot: 'weapon',
    attackBonus: 10
  }],
  equipment: {},
  quests: [
    { id: 'slime-hunt', progress: 0, claimed: false },
    { id: 'spirit-shards', progress: 0, claimed: false }
  ],
  savedAt: new Date().toISOString()
})

test('registers an account, creates a character, and issues an HttpOnly session cookie', async () => {
  const { response, email, cookie } = await register()
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/)
  assert.match(response.headers.get('set-cookie') ?? '', /SameSite=Lax/)
  assert.ok(cookie.startsWith('chien_gioi_session='))

  const body = await response.json() as { user: { email: string }; character: ServerCharacter }
  assert.equal(body.user.email, email)
  assert.equal(body.character.level, 1)

  const currentUser = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })
  assert.equal(currentUser.status, 200)
  assert.deepEqual(await currentUser.json(), { user: { id: 'user-1', email } })
})

test('rejects invalid registration data and registration from a different origin', async () => {
  const invalid = await postJson('/api/auth/register', { email: 'not-an-email', password: 'short' })
  assert.equal(invalid.status, 400)

  const wrongOrigin = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'blocked@example.test', password: PASSWORD })
  })
  assert.equal(wrongOrigin.status, 403)
})

test('authenticates game WebSocket upgrades and enforces the join protocol', async () => {
  assert.equal(await getUpgradeStatus(undefined, ORIGIN), 401)
  assert.equal(await getUpgradeStatus(undefined, 'https://other.example'), 403)

  const { cookie } = await register()
  assert.equal(await getUpgradeStatus(cookie, ORIGIN), 101)
  const socket = await connectGameSocket(cookie)
  try {
    socket.send(JSON.stringify({
      v: GAME_PROTOCOL_VERSION + 1,
      type: 'join',
      zoneId: 'training-ground',
      lastSequence: 0
    }))
    assert.deepEqual(await receiveServerMessage(socket), {
      v: GAME_PROTOCOL_VERSION,
      type: 'error',
      code: 'unsupported_version'
    })

    socket.send(JSON.stringify({
      v: GAME_PROTOCOL_VERSION,
      type: 'attack',
      sequence: 1,
      targetId: 'slime-1',
      action: 'basic'
    }))
    assert.deepEqual(await receiveServerMessage(socket), {
      v: GAME_PROTOCOL_VERSION,
      type: 'error',
      code: 'not_joined',
      requestSequence: 1
    })

    socket.send(JSON.stringify({
      v: GAME_PROTOCOL_VERSION,
      type: 'join',
      zoneId: 'training-ground',
      lastSequence: 0
    }))
    const joined = await receiveServerMessage(socket)
    assert.equal(joined.type, 'joined')
    if (joined.type !== 'joined') throw new Error('Expected game join acknowledgement')
    assert.equal(joined.v, GAME_PROTOCOL_VERSION)
    assert.equal(joined.zoneId, 'training-ground')
    assert.ok(Number.isFinite(joined.serverTime))
    const initialSnapshot = await receiveServerMessage(socket)
    assert.equal(initialSnapshot.type, 'snapshot')
    if (initialSnapshot.type !== 'snapshot') throw new Error('Expected initial game snapshot')
    assert.equal(initialSnapshot.player.level, 1)
    assert.equal(initialSnapshot.monsters.length, 5)

    socket.send(JSON.stringify({
      v: GAME_PROTOCOL_VERSION,
      type: 'attack',
      sequence: 1,
      targetId: 'slime-1',
      action: 'basic'
    }))
    assert.deepEqual(await receiveServerMessage(socket), {
      v: GAME_PROTOCOL_VERSION,
      type: 'action_result',
      sequence: 1,
      action: 'attack',
      accepted: false,
      reason: 'target_out_of_range'
    })
    const acknowledgedSnapshot = await receiveServerMessage(socket)
    assert.equal(acknowledgedSnapshot.type, 'snapshot')
    if (acknowledgedSnapshot.type === 'snapshot') {
      assert.equal(acknowledgedSnapshot.acknowledgedSequence, 1)
      assert.equal(acknowledgedSnapshot.monsters[0]?.hp, 40)
    }
  } finally {
    await closeGameSocket(socket)
  }
})

test('revoking a session blocks messages on its already-open game socket', async () => {
  const { cookie } = await register()
  const socket = await connectGameSocket(cookie)
  try {
    socket.send(JSON.stringify({
      v: GAME_PROTOCOL_VERSION,
      type: 'join',
      zoneId: 'training-ground',
      lastSequence: 0
    }))
    const joined = await receiveServerMessage(socket)
    assert.equal(joined.type, 'joined')

    const logout = await postJson('/api/auth/logout', {}, cookie)
    assert.equal(logout.status, 200)

    socket.send(JSON.stringify({
      v: GAME_PROTOCOL_VERSION,
      type: 'input',
      sequence: 1,
      movement: { x: 0, y: 0 },
      autoBattle: false
    }))
    const [code] = await once(socket, 'close')
    assert.equal(code, 1008)
  } finally {
    await closeGameSocket(socket)
  }
})

test('persists validated character data and rejects forged out-of-range rewards', async () => {
  const { email, cookie } = await register()
  const login = await postJson('/api/auth/login', { email, password: PASSWORD })
  assert.equal(login.status, 200)
  const loginCookie = login.headers.get('set-cookie')?.split(';')[0]
  assert.ok(loginCookie)
  assert.notEqual(loginCookie, cookie)

  const character = (await (await fetch(`${baseUrl}/api/character`, {
    headers: { Cookie: loginCookie }
  })).json() as { character: ServerCharacter }).character

  character.gold = 25
  character.savedAt = new Date().toISOString()
  const saved = await fetch(`${baseUrl}/api/character`, {
    method: 'PUT',
    headers: { Cookie: loginCookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify(character)
  })
  assert.equal(saved.status, 200)
  assert.deepEqual(
    (await (await fetch(`${baseUrl}/api/character`, {
      headers: { Cookie: loginCookie }
    })).json() as { character: ServerCharacter }).character,
    character
  )

  character.gold = -1
  const forgedSave = await fetch(`${baseUrl}/api/character`, {
    method: 'PUT',
    headers: { Cookie: loginCookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify(character)
  })
  assert.equal(forgedSave.status, 400)
})

test('enhances an owned weapon on the server and charges the configured fee', async () => {
  repository.enhancementRoll = 90
  const { cookie, email } = await register(characterWithWeapon())
  forgeCookie = cookie
  forgeEmail = email
  const response = await fetch(`${baseUrl}/api/character/enhance`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventoryId: 'weapon-test', gold: 999_999 })
  })

  assert.equal(response.status, 200)
  const result = await response.json() as {
    status: string
    cost: number
    newLevel: number
    currentGold: number
    item: { attackBonus: number; enhanceLevel: number }
  }
  assert.equal(result.status, 'success')
  assert.equal(result.cost, 1000)
  assert.equal(result.newLevel, 1)
  assert.equal(result.currentGold, 9000)
  assert.equal(result.item.attackBonus, 12)
  assert.equal(result.item.enhanceLevel, 1)

  const saved = await fetch(`${baseUrl}/api/character`, { headers: { Cookie: cookie } })
  const { character } = await saved.json() as { character: ServerCharacter }
  assert.equal(character.gold, 9000)
  assert.equal(character.inventory[0]?.enhanceLevel, 1)
})

test('failed enhancement still charges gold without changing weapon stats', async () => {
  repository.enhancementRoll = 91
  repository.setCharacter(forgeEmail, characterWithWeapon())
  const response = await fetch(`${baseUrl}/api/character/enhance`, {
    method: 'POST',
    headers: { Cookie: forgeCookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventoryId: 'weapon-test' })
  })

  assert.equal(response.status, 200)
  const result = await response.json() as {
    status: string
    newLevel: number
    currentGold: number
    item: { attackBonus: number }
  }
  assert.equal(result.status, 'failed')
  assert.equal(result.newLevel, 0)
  assert.equal(result.currentGold, 9000)
  assert.equal(result.item.attackBonus, 10)
})

test('rejects unauthenticated, missing, non-weapon, and unaffordable enhancements', async () => {
  const unauthorized = await fetch(`${baseUrl}/api/character/enhance`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventoryId: 'weapon-test' })
  })
  assert.equal(unauthorized.status, 401)

  repository.setCharacter(forgeEmail, characterWithWeapon(999))
  const poor = await fetch(`${baseUrl}/api/character/enhance`, {
    method: 'POST',
    headers: { Cookie: forgeCookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventoryId: 'weapon-test' })
  })
  assert.equal(poor.status, 409)

  repository.setCharacter(forgeEmail, characterWithWeapon())
  const missing = await fetch(`${baseUrl}/api/character/enhance`, {
    method: 'POST',
    headers: { Cookie: forgeCookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventoryId: 'not-owned' })
  })
  assert.equal(missing.status, 404)

  const invalidTypeCharacter = characterWithWeapon()
  invalidTypeCharacter.inventory[0]!.slot = 'armor'
  invalidTypeCharacter.inventory[0]!.attackBonus = undefined
  invalidTypeCharacter.inventory[0]!.defenseBonus = 2
  repository.setCharacter(forgeEmail, invalidTypeCharacter)
  const armor = await fetch(`${baseUrl}/api/character/enhance`, {
    method: 'POST',
    headers: { Cookie: forgeCookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventoryId: 'weapon-test' })
  })
  assert.equal(armor.status, 400)
})

test('uses the exact success threshold and does not roll when the weapon cannot be enhanced', () => {
  const character = characterWithWeapon()
  const atThreshold = enhanceWeapon(character, 'weapon-test', () => 90)
  const aboveThreshold = enhanceWeapon(character, 'weapon-test', () => 91)
  assert.equal(atThreshold.ok && atThreshold.response.status, 'success')
  assert.equal(aboveThreshold.ok && aboveThreshold.response.status, 'failed')

  let rolled = false
  const insufficient = enhanceWeapon(characterWithWeapon(999), 'weapon-test', () => {
    rolled = true
    return 1
  })
  assert.equal(insufficient.ok, false)
  assert.equal(rolled, false)
})

test('applies the configured fee and success threshold through enhancement level three', () => {
  let character = characterWithWeapon()
  const first = enhanceWeapon(character, 'weapon-test', () => 1)
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.equal(first.response.cost, 1000)
  assert.equal(first.response.newLevel, 1)

  character = first.character
  const second = enhanceWeapon(character, 'weapon-test', () => 70)
  assert.equal(second.ok, true)
  if (!second.ok) return
  assert.equal(second.response.cost, 2000)
  assert.equal(second.response.newLevel, 2)
  const secondMiss = enhanceWeapon(first.character, 'weapon-test', () => 71)
  assert.equal(secondMiss.ok && secondMiss.response.status, 'failed')

  character = second.character
  const third = enhanceWeapon(character, 'weapon-test', () => 50)
  assert.equal(third.ok, true)
  if (!third.ok) return
  assert.equal(third.response.cost, 3000)
  assert.equal(third.response.newLevel, 3)
  assert.equal(third.response.currentGold, 4000)
  const thirdMiss = enhanceWeapon(second.character, 'weapon-test', () => 51)
  assert.equal(thirdMiss.ok && thirdMiss.response.status, 'failed')

  const capped = enhanceWeapon(third.character, 'weapon-test', () => 1)
  assert.deepEqual(capped, { ok: false, error: 'max-level' })

  const highStat = characterWithWeapon()
  highStat.inventory[0]!.attackBonus = 1000
  const statLimit = enhanceWeapon(highStat, 'weapon-test', () => 1)
  assert.deepEqual(statLimit, { ok: false, error: 'stat-limit' })
})

test('logout invalidates the session and expires the cookie', async () => {
  const { cookie } = await register()
  const response = await postJson('/api/auth/logout', {}, cookie)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/)

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })
  assert.equal(me.status, 401)
})

test('password verification is salted and does not accept a wrong password', async () => {
  const firstHash = await hashPassword(PASSWORD)
  const secondHash = await hashPassword(PASSWORD)
  assert.notEqual(firstHash, secondHash)
  assert.equal(await verifyPassword(PASSWORD, firstHash), true)
  assert.equal(await verifyPassword('incorrect-password', firstHash), false)
})

test('accepts valid healing potions and rejects malformed consumables', async () => {
  const { response } = await register()
  const { character } = await response.json() as { character: ServerCharacter }
  character.inventory.push({
    id: 'potion-1',
    name: 'Thuốc hồi phục',
    type: 'consumable',
    rarity: 'Thường',
    quantity: 2,
    healAmount: 50
  })
  assert.equal(isValidCharacter(character), true)

  character.inventory[0]!.healAmount = 1000
  assert.equal(isValidCharacter(character), false)
})

test('accepts new armor defense stats and legacy armor saves', async () => {
  const { response } = await register()
  const { character } = await response.json() as { character: ServerCharacter }
  character.equipment = {
    armor: {
      id: 'armor-1',
      name: 'Giáp da tập sự',
      type: 'equipment',
      rarity: 'Tốt',
      quantity: 1,
      slot: 'armor',
      defenseBonus: 2
    }
  }
  assert.equal(isValidCharacter(character), true)

  const legacyArmor = character.equipment.armor
  delete legacyArmor.defenseBonus
  legacyArmor.attackBonus = 2
  assert.equal(isValidCharacter(character), true)

  legacyArmor.attackBonus = 2
  legacyArmor.defenseBonus = 2
  assert.equal(isValidCharacter(character), false)
})
