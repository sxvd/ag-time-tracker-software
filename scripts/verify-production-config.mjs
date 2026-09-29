import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const readProjectFile = path => readFileSync(resolve(rootDir, path), 'utf8')

const compose = readProjectFile('docker-compose.prod.yml')
const deployScript = readProjectFile('deploy.sh')
const dockerfile = readProjectFile('Dockerfile')
const dockerignore = readProjectFile('.dockerignore')

const buildIndex = deployScript.indexOf('build web')
const migrationIndex = deployScript.indexOf('--profile tools run --rm migrate')
const webStartIndex = deployScript.indexOf('up -d web')
const candidateVerificationCount = deployScript.match(/verify_candidate/g)?.length || 0

const checks = [
  ['production PostgreSQL password is required', compose.includes('${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}')],
  ['production session password is required', compose.includes('${NUXT_SESSION_PASSWORD:?NUXT_SESSION_PASSWORD is required}')],
  ['AI insights runtime key is absent from production Compose', !compose.includes('NUXT_AI_INSIGHTS_API_KEY')],
  ['AI insights runtime key is absent from deployment setup', !deployScript.includes('NUXT_AI_INSIGHTS_API_KEY')],
  ['application base URL is /tracker/', compose.includes('NUXT_APP_BASE_URL: /tracker/')],
  ['application port is 5500', /\bPORT:\s*5500\b/.test(compose) && compose.includes('- "5500:5500"')],
  ['application healthcheck uses /tracker/', compose.includes('http://127.0.0.1:5500/tracker/api/health')],
  ['Docker runner exposes port 5500', dockerfile.includes('ENV PORT=5500') && dockerfile.includes('EXPOSE 5500')],
  ['Docker network alias is tracker', /aliases:\s*\n\s*-\s*tracker\b/.test(compose)],
  ['PostgreSQL data uses a persistent volume', compose.includes('postgres_data:/var/lib/postgresql/data') && /volumes:\s*[\s\S]*\bpostgres_data:/.test(compose)],
  ['migration service uses Prisma migrate deploy', compose.includes('"prisma", "migrate", "deploy"')],
  ['deployment builds before migration', buildIndex >= 0 && migrationIndex > buildIndex],
  ['deployment migrates before starting web', migrationIndex >= 0 && webStartIndex > migrationIndex],
  ['deployment synchronization is fast-forward only', deployScript.includes('git pull --ff-only') && !deployScript.includes('git pull 2>&1')],
  ['deployment requires an immutable reviewed SHA', deployScript.includes('--expected-sha is required') && deployScript.includes('Deployment candidate mismatch')],
  ['deployment rechecks the candidate before migration and startup', candidateVerificationCount >= 4],
  ['legacy tracker is excluded from the image', dockerignore.split(/\r?\n/).includes('/aq-time-tracker-software')],
  ['legacy tracker is absent from production Compose', !compose.includes('aq-time-tracker-software')]
]

const failures = checks.filter(([, passed]) => !passed).map(([label]) => label)

if (failures.length > 0) {
  console.error('Production configuration verification failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exitCode = 1
} else {
  console.log(`Production configuration verified (${checks.length} checks).`)
}
