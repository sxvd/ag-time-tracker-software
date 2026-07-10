import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rootDir = resolve(__dirname, '../..')
const readProjectFile = (path: string) =>
  readFileSync(resolve(rootDir, path), 'utf8')

const reservedToolsHostPorts = [
  5100, 5101, 5102,
  5200,
  5300, 5301, 5302, 5303,
  5400
]

describe('production deployment configuration', () => {
  it('uses the assigned AirGradient tools host path, alias, and port', () => {
    const compose = readProjectFile('docker-compose.prod.yml')
    const dockerfile = readProjectFile('Dockerfile')
    const envExample = readProjectFile('.env.example')
    const readme = readProjectFile('README.md')

    const portMatch = compose.match(/\bPORT:\s*(\d+)/)
    expect(portMatch).not.toBeNull()

    const appPort = Number(portMatch?.[1])

    expect(appPort).toBe(5500)
    expect(reservedToolsHostPorts).not.toContain(appPort)
    expect(compose).toContain(`- "${appPort}:${appPort}"`)
    expect(compose).toContain(`http://127.0.0.1:${appPort}/aq-time-tracker/api/health`)
    expect(compose).toMatch(/app-network:[\s\S]*aliases:[\s\S]*-\s*aq-time-tracker/)
    expect(compose).toMatch(/app-network:[\s\S]*external:\s*true[\s\S]*name:\s*app-network/)
    expect(compose).toContain('NUXT_APP_BASE_URL: /aq-time-tracker/')

    expect(dockerfile).toContain(`ENV PORT=${appPort}`)
    expect(dockerfile).toContain(`EXPOSE ${appPort}`)
    expect(dockerfile).toContain('apt-get install -y --no-install-recommends ca-certificates openssl')
    expect(envExample).toContain(`PORT="${appPort}"`)
    expect(readme).toContain(`PORT="${appPort}"`)
    expect(readme).toContain(`http://aq-time-tracker:${appPort}`)
  })

  it('keeps the cron deploy script rebuild-and-start focused', () => {
    const deployScript = readProjectFile('deploy.sh')

    expect(deployScript).toContain('APP_DIR="/opt/apps/tracker"')
    expect(deployScript).toContain('Creating .env.production')
    expect(deployScript).toContain('ensure_env_secret "POSTGRES_PASSWORD"')
    expect(deployScript).toContain('ensure_env_secret "NUXT_SESSION_PASSWORD"')
    expect(deployScript).toContain('Configuring DATABASE_URL for Compose PostgreSQL')
    expect(deployScript).toContain('git pull')
    expect(deployScript).toContain('No changes found and no new tags. Exiting')
    expect(deployScript).toContain('docker compose -f docker-compose.prod.yml --env-file .env.production build web')
    expect(deployScript).toContain('docker compose -f docker-compose.prod.yml --env-file .env.production up -d web')
  })

  it('runs production PostgreSQL inside Compose with persistent storage', () => {
    const compose = readProjectFile('docker-compose.prod.yml')

    expect(compose).toMatch(/postgres:[\s\S]*image:\s*postgres:16-bookworm/)
    expect(compose).toMatch(/postgres:[\s\S]*volumes:[\s\S]*-\s*postgres_data:\/var\/lib\/postgresql\/data/)
    expect(compose).toMatch(/postgres:[\s\S]*healthcheck:[\s\S]*pg_isready/)
    expect(compose).toMatch(/web:[\s\S]*depends_on:[\s\S]*postgres:[\s\S]*condition:\s*service_healthy/)
    expect(compose).toMatch(/migrate:[\s\S]*depends_on:[\s\S]*postgres:[\s\S]*condition:\s*service_healthy/)
    expect(compose).toContain('@postgres:5432/')
    expect(compose).toMatch(/volumes:[\s\S]*postgres_data:/)
  })

  it('keeps Prisma runtime dependencies in the slim Docker base image', () => {
    const dockerfile = readProjectFile('Dockerfile')

    expect(dockerfile).toContain('apt-get install -y --no-install-recommends')
    expect(dockerfile).toContain('ca-certificates')
    expect(dockerfile).toContain('openssl')
  })
})
