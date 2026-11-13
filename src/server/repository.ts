import type { Pool } from 'pg'
import { randomInt } from 'node:crypto'
import { isValidCharacter, type AuthRepository, type ServerCharacter } from './app.js'
import { enhanceWeapon, type EnhancementOperationResult } from './enhancement.js'

export class DuplicateEmailError extends Error {
  constructor() {
    super('Email đã được đăng ký.')
    this.name = 'DuplicateEmailError'
  }
}

export const createPostgresRepository = (pool: Pool): AuthRepository => ({
  async register(email, passwordHash, character) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const userResult = await client.query<{ id: string; email: string }>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash]
      )
      const user = userResult.rows[0]
      if (!user) throw new Error('User insert did not return a row')
      await client.query(
        'INSERT INTO characters (user_id, data) VALUES ($1, $2::jsonb)',
        [user.id, JSON.stringify(character)]
      )
      await client.query('COMMIT')
      return user
    } catch (error) {
      await client.query('ROLLBACK')
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) throw new DuplicateEmailError()
      throw error
    } finally {
      client.release()
    }
  },

  async findUserByEmail(email) {
    const result = await pool.query<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    )
    const user = result.rows[0]
    return user ? { id: user.id, email: user.email, passwordHash: user.password_hash } : null
  },

  async createSession(tokenHash, userId, expiresAt) {
    await pool.query(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [tokenHash, userId, expiresAt]
    )
  },

  async findSession(tokenHash) {
    const result = await pool.query<{ id: string; email: string }>(
      `SELECT users.id, users.email
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
      [tokenHash]
    )
    return result.rows[0] ?? null
  },

  async deleteSession(tokenHash) {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
  },

  async getCharacter(userId) {
    const result = await pool.query<{ data: ServerCharacter }>(
      'SELECT data FROM characters WHERE user_id = $1',
      [userId]
    )
    const character = result.rows[0]?.data
    if (!character) throw new Error('Character not found for authenticated user')
    return character
  },

  async saveCharacter(userId, character) {
    const result = await pool.query(
      'UPDATE characters SET data = $2::jsonb, updated_at = now() WHERE user_id = $1',
      [userId, JSON.stringify(character)]
    )
    if (result.rowCount !== 1) throw new Error('Character not found for authenticated user')
  },

  async enhanceWeapon(userId, inventoryId): Promise<EnhancementOperationResult> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const characterResult = await client.query<{ data: ServerCharacter }>(
        'SELECT data FROM characters WHERE user_id = $1 FOR UPDATE',
        [userId]
      )
      const character = characterResult.rows[0]?.data
      if (!character) throw new Error('Character not found for authenticated user')
      if (!isValidCharacter(character)) throw new Error('Stored character data is invalid')

      const result = enhanceWeapon(character, inventoryId, () => randomInt(1, 101))
      if (!result.ok) {
        await client.query('ROLLBACK')
        return result
      }

      await client.query(
        'UPDATE characters SET data = $2::jsonb, updated_at = now() WHERE user_id = $1',
        [userId, JSON.stringify(result.character)]
      )
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
})
