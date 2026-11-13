import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'
import { createApiServer } from './app.js'
import { createPostgresRepository } from './repository.js'

const start = async () => {
  const envFile = join(process.cwd(), '.env')
  if (existsSync(envFile)) process.loadEnvFile(envFile)

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Configure PostgreSQL before starting the game API.')
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const migration = await readFile(join(process.cwd(), 'src/server/migrations/001_initial.sql'), 'utf8')
  await pool.query(migration)
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()')

  const port = Number(process.env.API_PORT ?? 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be a valid TCP port.')
  }

  const server = createApiServer(createPostgresRepository(pool), {
    secureCookies: process.env.NODE_ENV === 'production',
    allowedOrigins: (process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map(origin => origin.trim())
  })

  server.listen(port, '127.0.0.1', () => {
    console.info(`Game API listening on http://127.0.0.1:${port}`)
  })

  const shutdown = () => {
    server.close(() => {
      void pool.end()
    })
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

void start().catch(error => {
  console.error('Unable to start game API:', error)
  process.exitCode = 1
})
