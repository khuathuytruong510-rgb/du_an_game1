import type { PlayerSaveData } from './playerSave'
import type { EnhancementResponse } from '../../server/enhancement'

interface ApiUser {
  id: string
  email: string
}

export class GameApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GameApiError'
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers
      }
    })
  } catch {
    throw new GameApiError('Không kết nối được máy chủ game.', 0)
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = response.status === 502
      ? 'Máy chủ tài khoản chưa chạy hoặc không kết nối được PostgreSQL. Tiến trình vẫn lưu trên thiết bị.'
      : typeof body === 'object' && body !== null && 'error' in body &&
      typeof body.error === 'string'
      ? body.error
      : `Yêu cầu máy chủ thất bại (${response.status}).`
    throw new GameApiError(message, response.status)
  }

  if (typeof body !== 'object' || body === null) {
    throw new GameApiError('Máy chủ trả về dữ liệu không hợp lệ.', response.status)
  }
  return body as T
}

export const gameApi = {
  async register(email: string, password: string, character: PlayerSaveData) {
    return request<{ user: ApiUser; character: unknown }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, character })
    })
  },

  async login(email: string, password: string) {
    return request<{ user: ApiUser; character: unknown }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  },

  async currentUser() {
    return request<{ user: ApiUser }>('/api/auth/me')
  },

  async logout() {
    return request<{ status: string }>('/api/auth/logout', { method: 'POST' })
  },

  async loadCharacter() {
    return request<{ character: PlayerSaveData }>('/api/character')
  },

  async saveCharacter(character: PlayerSaveData) {
    return request<{ status: string; savedAt: string }>('/api/character', {
      method: 'PUT',
      body: JSON.stringify(character)
    })
  },

  async enhanceWeapon(inventoryId: string) {
    return request<EnhancementResponse>('/api/character/enhance', {
      method: 'POST',
      body: JSON.stringify({ inventoryId })
    })
  }
}
