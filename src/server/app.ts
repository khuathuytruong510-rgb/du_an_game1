import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { EnhancementOperationResult } from './enhancement.js'
import { attachGameSocket } from './gameSocket.js'

const scrypt = promisify(scryptCallback)
const SESSION_COOKIE = 'chien_gioi_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_BODY_BYTES = 32 * 1024
const MAX_AUTH_ATTEMPTS = 10
const RATE_WINDOW_MS = 10 * 60 * 1000

export interface ServerCharacter {
  version: 1
  level: number
  exp: number
  gold: number
  hp: number
  mp: number
  inventory: Array<Record<string, unknown>>
  equipment: Record<string, Record<string, unknown>>
  quests: Array<Record<string, unknown>>
  savedAt: string
}

export interface AuthRepository {
  register(email: string, passwordHash: string, character: ServerCharacter): Promise<{ id: string; email: string }>
  findUserByEmail(email: string): Promise<{ id: string; email: string; passwordHash: string } | null>
  createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void>
  findSession(tokenHash: string): Promise<{ id: string; email: string } | null>
  deleteSession(tokenHash: string): Promise<void>
  getCharacter(userId: string): Promise<ServerCharacter>
  saveCharacter(userId: string, character: ServerCharacter): Promise<void>
  enhanceWeapon(userId: string, inventoryId: string): Promise<EnhancementOperationResult>
}

interface ApiError extends Error {
  statusCode: number
}

const apiError = (statusCode: number, message: string): ApiError =>
  Object.assign(new Error(message), { statusCode })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseCookies = (header: string | undefined): Map<string, string> => {
  const cookies = new Map<string, string>()
  for (const part of header?.split(';') ?? []) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue
    const name = part.slice(0, separator).trim()
    try {
      cookies.set(name, decodeURIComponent(part.slice(separator + 1).trim()))
    } catch {
      continue
    }
  }
  return cookies
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`
}

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [algorithm, saltHex, hashHex, ...extra] = storedHash.split('$')
  if (
    algorithm !== 'scrypt' ||
    !/^[a-f0-9]{32}$/i.test(saltHex ?? '') ||
    !/^[a-f0-9]{128}$/i.test(hashHex ?? '') ||
    extra.length > 0
  ) return false

  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length) as Buffer
  return timingSafeEqual(actual, expected)
}

export const isValidCharacter = (value: unknown): value is ServerCharacter => {
  if (!isRecord(value)) return false
  if (
    value.version !== 1 ||
    !Number.isInteger(value.level) || (value.level as number) < 1 || (value.level as number) > 30 ||
    typeof value.exp !== 'number' || !Number.isInteger(value.exp) || value.exp < 0 ||
    value.exp >= 100 * (value.level as number) ** 2 ||
    typeof value.gold !== 'number' || !Number.isSafeInteger(value.gold) || value.gold < 0 ||
    typeof value.hp !== 'number' || !Number.isFinite(value.hp) || value.hp < 0 || value.hp > 200 ||
    typeof value.mp !== 'number' || !Number.isFinite(value.mp) || value.mp < 0 || value.mp > 150 ||
    typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) ||
    !Array.isArray(value.inventory) || value.inventory.length > 20 ||
    !isRecord(value.equipment) || !Array.isArray(value.quests) || value.quests.length !== 2
  ) return false

  const questIds = new Set<string>()
  for (const quest of value.quests) {
    if (
      !isRecord(quest) ||
      !['slime-hunt', 'spirit-shards'].includes(String(quest.id)) ||
      questIds.has(String(quest.id)) ||
      !Number.isInteger(quest.progress) ||
      (quest.progress as number) < 0 ||
      (quest.progress as number) > 3 ||
      typeof quest.claimed !== 'boolean' ||
      (quest.claimed && quest.progress !== 3)
    ) return false
    questIds.add(String(quest.id))
  }
  if (questIds.size !== 2) return false

  const itemIds = new Set<string>()
  for (const item of value.inventory) {
    const equipmentItem = isRecord(item) && item.type === 'equipment'
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      item.id.length === 0 ||
      itemIds.has(item.id) ||
      typeof item.name !== 'string' ||
      item.name.length === 0 ||
      !['material', 'equipment', 'consumable'].includes(String(item.type)) ||
      !['Thường', 'Tốt', 'Hiếm'].includes(String(item.rarity)) ||
      !Number.isInteger(item.quantity) ||
      (item.quantity as number) < 1 ||
      (item.quantity as number) > 999 ||
      (equipmentItem && (
        item.healAmount !== undefined ||
        (item.slot === 'weapon' && item.enhanceLevel !== undefined && (
          !Number.isInteger(item.enhanceLevel) ||
          (item.enhanceLevel as number) < 0 ||
          (item.enhanceLevel as number) > 3
        )) ||
        (item.slot === 'armor' && item.enhanceLevel !== undefined) ||
        (item.slot === 'weapon' && (
          typeof item.attackBonus !== 'number' ||
          !Number.isFinite(item.attackBonus) ||
          item.attackBonus < 0 ||
          item.attackBonus > 1000 ||
          item.defenseBonus !== undefined
        )) ||
        (item.slot === 'armor' && (
          item.attackBonus === undefined
            ? typeof item.defenseBonus !== 'number' ||
              !Number.isFinite(item.defenseBonus) ||
              item.defenseBonus < 0 ||
              item.defenseBonus > 1000
            : typeof item.attackBonus !== 'number' ||
              !Number.isFinite(item.attackBonus) ||
              item.attackBonus < 0 ||
              item.attackBonus > 1000 ||
              item.defenseBonus !== undefined
        )) ||
        !['weapon', 'armor'].includes(String(item.slot))
      )) ||
      (item.type === 'consumable' && (
        item.name !== 'Thuốc hồi phục' ||
        typeof item.healAmount !== 'number' ||
        !Number.isInteger(item.healAmount) ||
        item.healAmount < 1 ||
        item.healAmount > 200 ||
        item.slot !== undefined ||
        item.attackBonus !== undefined ||
        item.defenseBonus !== undefined ||
        item.enhanceLevel !== undefined ||
        item.defenseBonus !== undefined
      )) ||
      (item.type === 'material' && (
        item.slot !== undefined ||
        item.attackBonus !== undefined ||
        item.defenseBonus !== undefined ||
        item.healAmount !== undefined ||
        item.enhanceLevel !== undefined
      ))
    ) return false
    itemIds.add(item.id)
  }

  for (const [slot, item] of Object.entries(value.equipment)) {
    if (
      !['weapon', 'armor'].includes(slot) ||
      !isRecord(item) ||
      item.type !== 'equipment' ||
      item.slot !== slot ||
      typeof item.id !== 'string' ||
      item.id.length === 0 ||
      itemIds.has(item.id) ||
      typeof item.name !== 'string' ||
      item.name.length === 0 ||
      !['Thường', 'Tốt', 'Hiếm'].includes(String(item.rarity)) ||
      !Number.isInteger(item.quantity) ||
      item.quantity !== 1 ||
      item.healAmount !== undefined ||
      (slot === 'weapon' && item.enhanceLevel !== undefined && (
        !Number.isInteger(item.enhanceLevel) ||
        (item.enhanceLevel as number) < 0 ||
        (item.enhanceLevel as number) > 3
      )) ||
      (slot === 'armor' && item.enhanceLevel !== undefined) ||
      (slot === 'weapon' && (
        typeof item.attackBonus !== 'number' ||
        !Number.isFinite(item.attackBonus) ||
        item.attackBonus < 0 ||
        item.attackBonus > 1000 ||
        item.defenseBonus !== undefined
      )) ||
      (slot === 'armor' && (
        item.attackBonus === undefined
          ? typeof item.defenseBonus !== 'number' ||
            !Number.isFinite(item.defenseBonus) ||
            item.defenseBonus < 0 ||
            item.defenseBonus > 1000
          : typeof item.attackBonus !== 'number' ||
            !Number.isFinite(item.attackBonus) ||
            item.attackBonus < 0 ||
            item.attackBonus > 1000 ||
            item.defenseBonus !== undefined
      ))
    ) return false
    itemIds.add(item.id)
  }

  return true
}

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  const contentType = request.headers['content-type']?.split(';')[0]?.trim()
  if (contentType !== 'application/json') throw apiError(415, 'Yêu cầu phải có Content-Type: application/json.')

  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk)
    if (size > MAX_BODY_BYTES) throw apiError(413, 'Nội dung yêu cầu vượt quá giới hạn.')
    chunks.push(Buffer.from(chunk))
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw apiError(400, 'Nội dung JSON không hợp lệ.')
  }
}

const sendJson = (response: ServerResponse, statusCode: number, data: unknown, cookie?: string) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...(cookie ? { 'Set-Cookie': cookie } : {})
  })
  response.end(JSON.stringify(data))
}

const makeSessionCookie = (token: string, secure: boolean, clear = false): string => {
  const attributes = [
    `${SESSION_COOKIE}=${clear ? '' : encodeURIComponent(token)}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${clear ? 0 : SESSION_DURATION_MS / 1000}`
  ]
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}

export const createApiServer = (
  repository: AuthRepository,
  options: { secureCookies?: boolean; allowedOrigins?: string[] } = {}
): Server => {
  const attempts = new Map<string, { count: number; resetAt: number }>()

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const method = request.method ?? 'GET'

    try {
      if (url.pathname === '/api/health' && method === 'GET') {
        sendJson(response, 200, { status: 'ok' })
        return
      }

      if (['POST', 'PUT', 'DELETE'].includes(method)) {
        const origin = request.headers.origin
        if (!origin || !options.allowedOrigins?.includes(origin)) {
          throw apiError(403, 'Nguồn yêu cầu không được phép.')
        }
      }

      if (
        ['POST /api/auth/register', 'POST /api/auth/login'].includes(`${method} ${url.pathname}`)
      ) {
        const address = request.socket.remoteAddress ?? 'unknown'
        const now = Date.now()
        let attempt = attempts.get(address)
        if (!attempt || now >= attempt.resetAt) {
          attempt = { count: 0, resetAt: now + RATE_WINDOW_MS }
          attempts.set(address, attempt)
        }
        attempt.count += 1
        if (attempt.count > MAX_AUTH_ATTEMPTS) {
          throw apiError(429, 'Quá nhiều lần thử đăng nhập. Hãy thử lại sau ít phút.')
        }
      }

      if (url.pathname === '/api/auth/register' && method === 'POST') {
        const body = await readJson(request)
        if (!isRecord(body) || typeof body.email !== 'string' || typeof body.password !== 'string') {
          throw apiError(400, 'Email và mật khẩu là bắt buộc.')
        }

        const email = body.email.trim().toLowerCase()
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw apiError(400, 'Email không hợp lệ.')
        }
        if (body.password.length < 12 || body.password.length > 128) {
          throw apiError(400, 'Mật khẩu phải có từ 12 đến 128 ký tự.')
        }

        const newCharacter: ServerCharacter = {
          version: 1,
          level: 1,
          exp: 0,
          gold: 0,
          hp: 100,
          mp: 50,
          inventory: [],
          equipment: {},
          quests: [
            { id: 'slime-hunt', progress: 0, claimed: false },
            { id: 'spirit-shards', progress: 0, claimed: false }
          ],
          savedAt: new Date().toISOString()
        }
        const character = body.character === undefined ? newCharacter : body.character
        if (!isValidCharacter(character)) throw apiError(400, 'Dữ liệu nhân vật ban đầu không hợp lệ.')
        const user = await repository.register(email, await hashPassword(body.password), character)
        const token = randomBytes(32).toString('base64url')
        await repository.createSession(
          hashToken(token),
          user.id,
          new Date(Date.now() + SESSION_DURATION_MS)
        )
        sendJson(
          response,
          201,
          { user: { id: user.id, email: user.email }, character },
          makeSessionCookie(token, options.secureCookies ?? false)
        )
        return
      }

      if (url.pathname === '/api/auth/login' && method === 'POST') {
        const body = await readJson(request)
        if (
          !isRecord(body) ||
          typeof body.email !== 'string' ||
          typeof body.password !== 'string' ||
          body.password.length > 128
        ) throw apiError(400, 'Email hoặc mật khẩu không hợp lệ.')

        const user = await repository.findUserByEmail(body.email.trim().toLowerCase())
        const valid = user
          ? await verifyPassword(body.password, user.passwordHash)
          : await verifyPassword(
              body.password,
              'scrypt$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
            )
        if (!user || !valid) throw apiError(401, 'Email hoặc mật khẩu không chính xác.')

        const token = randomBytes(32).toString('base64url')
        await repository.createSession(
          hashToken(token),
          user.id,
          new Date(Date.now() + SESSION_DURATION_MS)
        )
        sendJson(
          response,
          200,
          { user: { id: user.id, email: user.email }, character: await repository.getCharacter(user.id) },
          makeSessionCookie(token, options.secureCookies ?? false)
        )
        return
      }

      if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/character')) {
        const token = parseCookies(request.headers.cookie).get(SESSION_COOKIE)
        if (!token || token.length > 128) throw apiError(401, 'Vui lòng đăng nhập để tiếp tục.')
        const session = await repository.findSession(hashToken(token))
        if (!session) throw apiError(401, 'Phiên đăng nhập đã hết hạn.')

        if (url.pathname === '/api/auth/me' && method === 'GET') {
          sendJson(response, 200, { user: session })
          return
        }

        if (url.pathname === '/api/auth/logout' && method === 'POST') {
          await repository.deleteSession(hashToken(token))
          sendJson(response, 200, { status: 'signed-out' }, makeSessionCookie('', options.secureCookies ?? false, true))
          return
        }

        if (url.pathname === '/api/character' && method === 'GET') {
          sendJson(response, 200, { character: await repository.getCharacter(session.id) })
          return
        }

        if (url.pathname === '/api/character' && method === 'PUT') {
          const character = await readJson(request)
          if (!isValidCharacter(character)) throw apiError(400, 'Dữ liệu nhân vật không hợp lệ.')
          await repository.saveCharacter(session.id, character)
          sendJson(response, 200, { status: 'saved', savedAt: character.savedAt })
          return
        }

        if (url.pathname === '/api/character/enhance' && method === 'POST') {
          const body = await readJson(request)
          if (
            !isRecord(body) ||
            typeof body.inventoryId !== 'string' ||
            body.inventoryId.length === 0 ||
            body.inventoryId.length > 128
          ) {
            throw apiError(400, 'ID vũ khí không hợp lệ.')
          }

          const result = await repository.enhanceWeapon(session.id, body.inventoryId)
          if (!result.ok) {
            const status = result.error === 'not-found' ? 404
              : result.error === 'insufficient-gold' ||
                result.error === 'max-level' ||
                result.error === 'stat-limit' ? 409
              : 400
            const message = result.error === 'not-found' ? 'Không tìm thấy vật phẩm trong túi đồ.'
              : result.error === 'not-weapon' ? 'Chỉ có thể cường hóa vũ khí.'
              : result.error === 'max-level' ? 'Vũ khí đã đạt cấp cường hóa tối đa.'
              : result.error === 'stat-limit' ? 'Vũ khí đã đạt giới hạn chỉ số có thể cường hóa.'
              : 'Không đủ vàng để cường hóa.'
            throw apiError(status, message)
          }

          sendJson(response, 200, result.response)
          return
        }

        throw apiError(404, 'Không tìm thấy API.')
      }

      throw apiError(404, 'Không tìm thấy API.')
    } catch (error) {
      const status = isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : 500
      const emailConflict = error instanceof Error && error.name === 'DuplicateEmailError'
      const responseStatus = emailConflict ? 409 : status
      if (status === 500 && !emailConflict) console.error('Game API request failed:', error)
      const message = emailConflict
        ? 'Email đã được đăng ký.'
        : status === 500
        ? 'Đã xảy ra lỗi máy chủ.'
        : error instanceof Error ? error.message : 'Yêu cầu không hợp lệ.'
      if (!response.headersSent) sendJson(response, responseStatus, { error: message })
      else response.destroy()
    }
  })

  attachGameSocket(server, {
    allowedOrigins: options.allowedOrigins ?? [],
    authenticate: async cookieHeader => {
      const token = parseCookies(cookieHeader).get(SESSION_COOKIE)
      if (!token || token.length > 128) return null
      const tokenHash = hashToken(token)
      const session = await repository.findSession(tokenHash)
      return session ? { userId: session.id, tokenHash } : null
    },
    validateSession: async tokenHash => Boolean(await repository.findSession(tokenHash)),
    loadCharacter: userId => repository.getCharacter(userId)
  })

  return server
}
