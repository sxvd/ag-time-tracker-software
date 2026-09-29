import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const rootDir = resolve(__dirname, '../..')
const readProjectFile = (path: string) =>
  readFileSync(resolve(rootDir, path), 'utf8')

const run = (command: string, args: string[], options: { cwd: string, env?: NodeJS.ProcessEnv }) =>
  spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8'
  })

const initializeGitFixture = (sandboxDir: string) => {
  const repoDir = join(sandboxDir, 'app')
  mkdirSync(repoDir)
  writeFileSync(join(repoDir, 'README.fixture'), 'tracked fixture\n')
  copyFileSync(resolve(rootDir, '.gitignore'), join(repoDir, '.gitignore'))

  run('git', ['init', '--quiet'], { cwd: repoDir })
  run('git', ['config', 'user.email', 'deployment-test@airgradient.com'], { cwd: repoDir })
  run('git', ['config', 'user.name', 'Deployment Test'], { cwd: repoDir })
  run('git', ['add', '.'], { cwd: repoDir })
  run('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: repoDir })

  return repoDir
}

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
    const nuxtConfig = readProjectFile('nuxt.config.ts')

    const portMatch = compose.match(/\bPORT:\s*(\d+)/)
    expect(portMatch).not.toBeNull()

    const appPort = Number(portMatch?.[1])

    expect(appPort).toBe(5500)
    expect(reservedToolsHostPorts).not.toContain(appPort)
    expect(compose).toContain(`- "${appPort}:${appPort}"`)
    expect(compose).toContain(`http://127.0.0.1:${appPort}/tracker/api/health`)
    expect(compose).toMatch(/app-network:[\s\S]*aliases:[\s\S]*-\s*tracker/)
    expect(compose).toMatch(/app-network:[\s\S]*external:\s*true[\s\S]*name:\s*app-network/)
    expect(compose).toContain('NUXT_APP_BASE_URL: /tracker/')
    expect(compose).toContain('NUXT_ALLOW_SELF_REGISTRATION: "${NUXT_ALLOW_SELF_REGISTRATION:-true}"')
    expect(compose).not.toMatch(/GOOGLE_OIDC|auth\/google|PASSWORD_AUTH_ENABLED/)
    expect(nuxtConfig).toContain("allowSelfRegistration: process.env.NUXT_ALLOW_SELF_REGISTRATION || 'true'")
    expect(nuxtConfig).toContain('/shared\\/utils\\/breezy\\.mjs$/')
    expect(nuxtConfig).toContain('/shared\\/constants\\/categories\\.mjs$/')

    expect(dockerfile).toContain(`ENV PORT=${appPort}`)
    expect(dockerfile).toContain(`EXPOSE ${appPort}`)
    expect(dockerfile).toContain('apt-get install -y --no-install-recommends ca-certificates openssl')
    expect(envExample).toContain(`PORT="${appPort}"`)
    expect(readme).toContain(`PORT="${appPort}"`)
    expect(readme).toContain(`http://tracker:${appPort}`)
  })

  it('keeps local runtime checks on the same /tracker/ base contract', () => {
    const compose = readProjectFile('docker-compose.dev.yml')

    expect(compose.match(/NUXT_APP_BASE_URL:\s*\/tracker\//g)).toHaveLength(2)
    expect(compose.match(/NUXT_ALLOW_SELF_REGISTRATION:\s*"\$\{NUXT_ALLOW_SELF_REGISTRATION:-true\}"/g)).toHaveLength(2)
    expect(compose).not.toContain('NUXT_AI_INSIGHTS_API_KEY')
  })

  it('keeps the cron deploy script rebuild-and-start focused', () => {
    const deployScript = readProjectFile('deploy.sh')
    const migrationIndex = deployScript.indexOf('--profile tools run --rm migrate')
    const webStartIndex = deployScript.indexOf('up -d web')

    expect(deployScript).toContain('APP_DIR="${APP_DIR:-/opt/apps/tracker}"')
    expect(deployScript).toContain('Creating .env.production')
    expect(deployScript).toContain('ensure_env_secret "POSTGRES_PASSWORD"')
    expect(deployScript).toContain('ensure_env_secret "NUXT_SESSION_PASSWORD"')
    expect(deployScript).toContain('ensure_env_key "NUXT_ALLOW_SELF_REGISTRATION" "true"')
    expect(deployScript).not.toContain('ensure_env_value "NUXT_ALLOW_SELF_REGISTRATION"')
    expect(deployScript).not.toContain('NUXT_AI_INSIGHTS_API_KEY')
    expect(deployScript).not.toMatch(/GOOGLE_OIDC|auth\/google|PASSWORD_AUTH_ENABLED/)
    expect(deployScript).toContain('Configuring DATABASE_URL for Compose PostgreSQL')
    expect(deployScript).toContain('git pull --ff-only')
    expect(deployScript).toContain('--no-pull')
    expect(deployScript).not.toContain('--expected-sha')
    expect(deployScript).not.toContain('EXPECTED_SHA')
    expect(deployScript).toContain('DEPLOY_TAG')
    expect(deployScript).toContain('%Y%m%dT%H%M%SZ')
    expect(deployScript).toContain('No changes found and no new tags. Exiting')
    expect(deployScript).toContain('docker compose -f docker-compose.prod.yml --env-file .env.production build web')
    expect(deployScript).toContain('docker compose -f docker-compose.prod.yml --env-file .env.production up -d web')
    expect(migrationIndex).toBeGreaterThan(-1)
    expect(webStartIndex).toBeGreaterThan(migrationIndex)
  })

  it('requires a protected backup directory outside the Git checkout', () => {
    const sandboxDir = mkdtempSync(join(tmpdir(), 'tracker-backup-boundary-'))
    try {
      const repoDir = initializeGitFixture(sandboxDir)
      const inRepoBackupDir = join(repoDir, 'backups')
      const permissiveBackupDir = join(sandboxDir, 'permissive-backups')
      mkdirSync(inRepoBackupDir, { mode: 0o700 })
      mkdirSync(permissiveBackupDir, { mode: 0o755 })

      const insideResult = run('bash', [resolve(rootDir, 'scripts/production-backup.sh'), '--dry-run'], {
        cwd: repoDir,
        env: { ...process.env, APP_DIR: repoDir, BACKUP_DIR: inRepoBackupDir }
      })
      expect(insideResult.status).not.toBe(0)
      expect(`${insideResult.stdout}${insideResult.stderr}`).toContain('outside the Git checkout')

      const permissionsResult = run('bash', [resolve(rootDir, 'scripts/production-backup.sh'), '--dry-run'], {
        cwd: repoDir,
        env: { ...process.env, APP_DIR: repoDir, BACKUP_DIR: permissiveBackupDir }
      })
      expect(permissionsResult.status).not.toBe(0)
      expect(`${permissionsResult.stdout}${permissionsResult.stderr}`).toContain('mode 700')
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true })
    }
  })

  it('keeps backup output external, unstageable, and invisible to repository status', () => {
    const sandboxDir = mkdtempSync(join(tmpdir(), 'tracker-backup-procedure-'))
    try {
      const repoDir = initializeGitFixture(sandboxDir)
      const backupDir = join(sandboxDir, 'protected-backups')
      const binDir = join(sandboxDir, 'bin')
      mkdirSync(backupDir, { mode: 0o700 })
      mkdirSync(binDir)

      const fakeDocker = join(binDir, 'docker')
      writeFileSync(fakeDocker, `#!/bin/sh\ncase "$*" in\n  *pg_dump*) printf 'fake custom-format backup\\n' ;;\n  *pg_restore*) cat >/dev/null ;;\nesac\n`)
      chmodSync(fakeDocker, 0o755)

      const env = {
        ...process.env,
        APP_DIR: repoDir,
        BACKUP_DIR: backupDir,
        PATH: `${binDir}:${process.env.PATH || ''}`
      }
      const backupScript = resolve(rootDir, 'scripts/production-backup.sh')
      const dryRun = run('bash', [backupScript, '--dry-run'], { cwd: repoDir, env })

      expect(dryRun.status, dryRun.stderr).toBe(0)
      const plannedFile = dryRun.stdout.trim()
      expect(resolve(plannedFile).startsWith(`${realpathSync(backupDir)}/`)).toBe(true)
      expect(existsSync(plannedFile)).toBe(false)
      expect(run('git', ['status', '--porcelain'], { cwd: repoDir }).stdout).toBe('')

      const backup = run('bash', [backupScript], { cwd: repoDir, env })
      expect(backup.status, backup.stderr).toBe(0)
      const backupFile = backup.stdout.trim()
      expect(resolve(backupFile).startsWith(`${realpathSync(backupDir)}/`)).toBe(true)
      expect(readFileSync(backupFile, 'utf8')).toContain('fake custom-format backup')
      expect(statSync(backupFile).mode & 0o777).toBe(0o600)
      expect(existsSync(`${backupFile}.sha256`)).toBe(true)
      expect(statSync(`${backupFile}.sha256`).mode & 0o777).toBe(0o600)
      expect(run('git', ['status', '--porcelain'], { cwd: repoDir }).stdout).toBe('')

      const stageAttempt = run('git', ['add', backupFile], { cwd: repoDir })
      expect(stageAttempt.status).not.toBe(0)
      expect(run('git', ['status', '--porcelain'], { cwd: repoDir }).stdout).toBe('')
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true })
    }
  })

  it('ignores an accidental in-checkout backup as defense in depth', () => {
    const sandboxDir = mkdtempSync(join(tmpdir(), 'tracker-backup-ignore-'))
    try {
      const repoDir = initializeGitFixture(sandboxDir)
      const accidentalBackup = join(repoDir, 'backups', 'accidental.dump')
      mkdirSync(join(repoDir, 'backups'))
      writeFileSync(accidentalBackup, 'must not be staged\n')

      expect(run('git', ['check-ignore', '--quiet', accidentalBackup], { cwd: repoDir }).status).toBe(0)
      expect(run('git', ['status', '--porcelain'], { cwd: repoDir }).stdout).toBe('')
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true })
    }
  })

  it('leaves the checkout clean after a successful automated deployment procedure', () => {
    const sandboxDir = mkdtempSync(join(tmpdir(), 'tracker-deploy-clean-'))
    try {
      const repoDir = join(sandboxDir, 'app')
      const binDir = join(sandboxDir, 'bin')
      mkdirSync(repoDir)
      mkdirSync(binDir)
      copyFileSync(resolve(rootDir, 'deploy.sh'), join(repoDir, 'deploy.sh'))
      copyFileSync(resolve(rootDir, '.gitignore'), join(repoDir, '.gitignore'))
      chmodSync(join(repoDir, 'deploy.sh'), 0o755)

      for (const command of ['docker']) {
        const executable = join(binDir, command)
        writeFileSync(executable, '#!/bin/sh\nexit 0\n')
        chmodSync(executable, 0o755)
      }

      run('git', ['init', '--quiet'], { cwd: repoDir })
      run('git', ['config', 'user.email', 'deployment-test@airgradient.com'], { cwd: repoDir })
      run('git', ['config', 'user.name', 'Deployment Test'], { cwd: repoDir })
      run('git', ['add', '.'], { cwd: repoDir })
      run('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: repoDir })
      const result = run('bash', [join(repoDir, 'deploy.sh'), '--force', '--no-pull'], {
        cwd: repoDir,
        env: { ...process.env, APP_DIR: repoDir, DEPLOY_TAG: 'test-release', PATH: `${binDir}:${process.env.PATH || ''}` }
      })

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
      expect(existsSync(join(repoDir, 'version.json'))).toBe(false)
      expect(run('git', ['status', '--porcelain'], { cwd: repoDir }).stdout).toBe('')
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true })
    }
  })

  it('documents the automatic latest-main deployment invocation', () => {
    const readme = readProjectFile('README.md')
    const deployCommands = readme.match(/^\.\/deploy\.sh.*$/gm) || []

    expect(deployCommands).toEqual(['./deploy.sh'])
    expect(readme).toContain('[mandatory production runbook](docs/operations/production-runbook.md)')
  })

  it('runs production PostgreSQL inside Compose with persistent storage', () => {
    const compose = readProjectFile('docker-compose.prod.yml')

    expect(compose).toMatch(/postgres:[\s\S]*image:\s*postgres:16-bookworm/)
    expect(compose).toMatch(/postgres:[\s\S]*volumes:[\s\S]*-\s*postgres_data:\/var\/lib\/postgresql\/data/)
    expect(compose).toMatch(/postgres:[\s\S]*healthcheck:[\s\S]*pg_isready/)
    expect(compose).toContain('${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}')
    expect(compose).toContain('${NUXT_SESSION_PASSWORD:?NUXT_SESSION_PASSWORD is required}')
    expect(compose).not.toContain('NUXT_AI_INSIGHTS_API_KEY')
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

  it('verifies production configuration inside the Docker build', () => {
    const dockerfile = readProjectFile('Dockerfile')
    const deployScript = readProjectFile('deploy.sh')

    expect(dockerfile).toContain('RUN npm run verify:production')
    expect(deployScript).not.toContain('npm run verify:production')
  })

  it('pins the root Vue runtime required by the production Nuxt server', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      dependencies: Record<string, string>
    }
    const packageLock = JSON.parse(readProjectFile('package-lock.json')) as {
      packages: Record<string, { version?: string, dependencies?: Record<string, string> }>
    }

    expect(packageLock.packages['node_modules/nuxt']?.dependencies?.vue).toBe('^3.5.40')
    expect(packageJson.dependencies.vue).toBe('3.5.41')
    expect(packageLock.packages['node_modules/vue']?.version).toBe('3.5.41')
  })

  it('keeps the legacy tracker out of production workflows', () => {
    const dockerignore = readProjectFile('.dockerignore')
    const legacyReadmePath = resolve(rootDir, 'aq-time-tracker-software/README.md')
    const prodCompose = readProjectFile('docker-compose.prod.yml')

    expect(dockerignore).toContain('/aq-time-tracker-software')
    expect(prodCompose).not.toContain('aq-time-tracker-software')
    expect(prodCompose).not.toMatch(/node:sqlite|backend\/api\.js|standalone-main/)

    // Source workspaces keep the legacy notice; production images prove the
    // exclusion by not containing this path at all.
    if (existsSync(legacyReadmePath)) {
      const legacyReadme = readFileSync(legacyReadmePath, 'utf8')

      expect(legacyReadme).toMatch(/legacy/i)
      expect(legacyReadme).toMatch(/not.*production/i)
    }
  })

  it('passes the read-only production configuration verifier', () => {
    const result = spawnSync(
      process.execPath,
      [resolve(rootDir, 'scripts/verify-production-config.mjs')],
      { cwd: rootDir, encoding: 'utf8' }
    )

    expect(result.status, result.stderr).toBe(0)
  })
})
