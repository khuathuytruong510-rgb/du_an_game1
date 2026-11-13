import type { Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import {
  decodeClientMessage,
  GAME_PROTOCOL_VERSION,
  type GameZoneId,
  type ProtocolDecodeError,
  type ServerMessage
} from '../shared/gameProtocol.js'
import type { ServerCharacter } from './app.js'
import { GameSimulation } from './gameSimulation.js'

const GAME_SOCKET_PATH = '/api/game'
const MAX_MESSAGES_PER_WINDOW = 30
const MESSAGE_WINDOW_MS = 1000
const MAX_INVALID_MESSAGES = 3

export interface GameSocketIdentity {
  userId: string
  tokenHash: string
}

interface GameSocketOptions {
  allowedOrigins: string[]
  authenticate: (cookieHeader: string | undefined) => Promise<GameSocketIdentity | null>
  validateSession: (tokenHash: string) => Promise<boolean>
  loadCharacter: (userId: string) => Promise<ServerCharacter>
}

const send = (socket: WebSocket, message: ServerMessage) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

const rejectUpgrade = (socket: Duplex, status: 401 | 403 | 404 | 500) => {
  const phrase = status === 401 ? 'Unauthorized'
    : status === 403 ? 'Forbidden'
    : status === 404 ? 'Not Found'
    : 'Internal Server Error'
  socket.end(
    `HTTP/1.1 ${status} ${phrase}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
  )
}

const decodeErrorCode = (error: ProtocolDecodeError) =>
  error === 'unsupported-version' ? 'unsupported_version' as const : 'invalid_message' as const

export const attachGameSocket = (server: Server, options: GameSocketOptions) => {
  const webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false
  })
  const identities = new WeakMap<WebSocket, GameSocketIdentity>()

  server.on('upgrade', (request, socket, head) => {
    let url: URL
    try {
      url = new URL(request.url ?? '/', 'http://localhost')
    } catch {
      rejectUpgrade(socket, 404)
      return
    }

    if (url.pathname !== GAME_SOCKET_PATH) {
      rejectUpgrade(socket, 404)
      return
    }

    const origin = request.headers.origin
    if (!origin || !options.allowedOrigins.includes(origin)) {
      rejectUpgrade(socket, 403)
      return
    }

    void options.authenticate(request.headers.cookie).then(identity => {
      if (socket.destroyed) return
      if (!identity) {
        rejectUpgrade(socket, 401)
        return
      }

      webSocketServer.handleUpgrade(request, socket, head, webSocket => {
        identities.set(webSocket, identity)
        webSocketServer.emit('connection', webSocket, request)
      })
    }).catch(error => {
      console.error('Game WebSocket authentication failed:', error)
      if (!socket.destroyed) rejectUpgrade(socket, 500)
    })
  })

  webSocketServer.on('connection', socket => {
    const identity = identities.get(socket)
    if (!identity) {
      socket.close(1011, 'Missing authenticated session')
      return
    }

    let joinedZone: GameZoneId | null = null
    let lastSequence = 0
    let invalidMessages = 0
    let messageWindowStartedAt = Date.now()
    let messageCount = 0
    let processing = Promise.resolve()
    let simulation: GameSimulation | null = null
    let tickTimer: ReturnType<typeof setInterval> | null = null

    socket.on('message', rawData => {
      if (socket.readyState !== WebSocket.OPEN) return
      const now = Date.now()
      if (now - messageWindowStartedAt >= MESSAGE_WINDOW_MS) {
        messageWindowStartedAt = now
        messageCount = 0
      }
      messageCount += 1
      if (messageCount > MAX_MESSAGES_PER_WINDOW) {
        send(socket, { v: GAME_PROTOCOL_VERSION, type: 'error', code: 'rate_limited' })
        socket.close(1008, 'Rate limit exceeded')
        return
      }

      processing = processing.then(async () => {
        if (socket.readyState !== WebSocket.OPEN) return
        const sessionValid = await options.validateSession(identity.tokenHash)
        if (!sessionValid) {
          socket.close(1008, 'Session expired')
          return
        }

        let payload: unknown
        try {
          payload = JSON.parse(rawData.toString())
        } catch {
          invalidMessages += 1
          send(socket, { v: GAME_PROTOCOL_VERSION, type: 'error', code: 'invalid_message' })
          if (invalidMessages >= MAX_INVALID_MESSAGES) socket.close(1008, 'Invalid messages')
          return
        }

        const decoded = decodeClientMessage(payload)
        if (!decoded.ok) {
          invalidMessages += 1
          send(socket, {
            v: GAME_PROTOCOL_VERSION,
            type: 'error',
            code: decodeErrorCode(decoded.error)
          })
          if (invalidMessages >= MAX_INVALID_MESSAGES) socket.close(1008, 'Invalid messages')
          return
        }

        const message = decoded.message
        if (message.type === 'join') {
          if (joinedZone || message.lastSequence < lastSequence) {
            send(socket, {
              v: GAME_PROTOCOL_VERSION,
              type: 'error',
              code: 'invalid_message'
            })
            return
          }
          const character = await options.loadCharacter(identity.userId)
          if (socket.readyState !== WebSocket.OPEN) return
          simulation = new GameSimulation(message.zoneId, character)
          joinedZone = message.zoneId
          lastSequence = message.lastSequence
          send(socket, {
            v: GAME_PROTOCOL_VERSION,
            type: 'joined',
            zoneId: joinedZone,
            serverTime: Date.now()
          })
          send(socket, simulation.snapshot(Date.now(), lastSequence))
          tickTimer = setInterval(() => {
            if (!simulation || socket.readyState !== WebSocket.OPEN) return
            send(socket, simulation.tick(lastSequence))
          }, 100)
          return
        }

        if (!joinedZone) {
          send(socket, {
            v: GAME_PROTOCOL_VERSION,
            type: 'error',
            code: 'not_joined',
            requestSequence: message.sequence
          })
          return
        }

        if (message.sequence <= lastSequence) {
          send(socket, {
            v: GAME_PROTOCOL_VERSION,
            type: 'error',
            code: 'invalid_message',
            requestSequence: message.sequence
          })
          return
        }
        lastSequence = message.sequence

        if (!simulation) {
          send(socket, {
            v: GAME_PROTOCOL_VERSION,
            type: 'error',
            code: 'not_joined',
            requestSequence: message.sequence
          })
          return
        }

        if (message.type === 'interact') {
          send(socket, {
            v: GAME_PROTOCOL_VERSION,
            type: 'error',
            code: 'gameplay_unavailable',
            requestSequence: message.sequence
          })
          return
        }

        const result = simulation.handle(message)
        if (result) send(socket, { v: GAME_PROTOCOL_VERSION, ...result })
        send(socket, simulation.snapshot(Date.now(), lastSequence))
      }).catch(error => {
        console.error('Game WebSocket message processing failed:', error)
        socket.close(1011, 'Internal server error')
      })
    })

    socket.on('error', error => {
      console.error('Game WebSocket connection failed:', error)
    })
    socket.on('close', () => {
      if (tickTimer) clearInterval(tickTimer)
    })
  })

  server.once('close', () => {
    webSocketServer.close()
  })

  return webSocketServer
}
