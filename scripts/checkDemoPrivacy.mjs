import { readdirSync, readFileSync } from 'node:fs'
import { join, extname } from 'node:path'

const excluded = new Set([
  '.git',
  'node_modules',
  '.next',
  'coverage',
  'test-results',
  'playwright-report',
])
const textTypes = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.md',
  '.json',
  '.yml',
  '.yaml',
  '.sql',
  '.css',
  '.svg',
])
const failures = []
let inspected = 0
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue
    const file = join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      failures.push(`${file}: symlink requires review`)
      continue
    }
    if (entry.isDirectory()) {
      if (['uploads', 'backups'].includes(entry.name))
        failures.push(`${file}: private-data directory`)
      else scan(file)
      continue
    }
    if (entry.name.startsWith('.env') && entry.name !== '.env.example')
      failures.push(`${file}: environment file`)
    if (/\.(dump|backup|bak|xlsx|csv|log)$/.test(entry.name))
      failures.push(`${file}: data export or backup`)
    if (!textTypes.has(extname(file)) || entry.name === 'package-lock.json') continue
    const content = readFileSync(file, 'utf8')
    inspected++
    const emails = content.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []
    if (emails.some((email) => !/@(?:[a-z0-9-]+\.)?example\.(?:com|net|org)$/i.test(email)))
      failures.push(`${file}: non-example email address`)
    if (
      /(?:gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(
        content
      )
    )
      failures.push(`${file}: possible credential`)
    if (file !== 'scripts/checkDemoPrivacy.mjs' && /https:\/\/[^\s'"<>]+\/pay-me\//.test(content))
      failures.push(`${file}: operational payment link`)
  }
}
scan('.')
if (failures.length) {
  console.error('Demo privacy checks failed. Review these paths (values redacted):')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else
  console.log(
    `Demo privacy checks passed: ${inspected} authored text files inspected. No environment files, data exports, non-example emails, known credential formats, or operational payment links found.`
  )
