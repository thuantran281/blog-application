import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const skippedFiles = new Set(['package-lock.json', 'client/package-lock.json', 'server/package-lock.json'])

const patterns = [
  { name: 'AWS access key', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: 'Private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  {
    name: 'GitHub token',
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  { name: 'Fly.io token', regex: /\bFlyV1\s+[A-Za-z0-9_-]{20,}/g },
  { name: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: 'OpenAI key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'Database URL with credentials', regex: /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/g },
  {
    name: 'Tigris URL with credentials',
    regex: /\bhttps?:\/\/[^\s:@/]+:[^\s@/]+@fly\.storage\.tigris\.dev\b/g,
  },
  {
    name: 'Secret assignment',
    regex:
      /(?:\$env:)?\b(DB_PASSWORD|JWT_SECRET|ADMIN_PASSWORD|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|S3_ARCHIVE_CONFIG|FLY_API_TOKEN|GITHUB_TOKEN)\s*[=:]\s*([^\s`]+)/g,
  },
]

const placeholderPattern =
  /^(?:<.*>|\$\{.*|your[-_].*|change[-_ ]?me.*|replace[-_ ]?with.*|example.*|placeholder.*|test.*|ci-only.*|dummy.*|sample.*|todo.*|password123|postgres|admin|root|secret|env\..*|process\.env.*|z\..*)$/i

function isPlaceholder(value) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '').trim()
  return !trimmed || placeholderPattern.test(trimmed)
}

const findings = []

for (const file of files) {
  if (skippedFiles.has(file)) {
    continue
  }

  if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith('.env.example')) {
    findings.push({ file, line: 0, rule: 'Tracked environment file' })
    continue
  }

  let content

  try {
    content = readFileSync(path.join(root, file), 'utf8')
  } catch {
    continue
  }

  if (content.includes('\0')) {
    continue
  }

  const lines = content.split(/\r?\n/)

  for (const pattern of patterns) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      pattern.regex.lastIndex = 0
      const match = pattern.regex.exec(line)

      if (!match) {
        continue
      }

      if (pattern.name === 'Secret assignment' && isPlaceholder(match[2])) {
        continue
      }

      findings.push({ file, line: index + 1, rule: pattern.name })
    }
  }
}

if (findings.length > 0) {
  console.error('Potential committed secrets found:')

  for (const finding of findings) {
    const location = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file
    console.error(`- ${location}: ${finding.rule}`)
  }

  process.exit(1)
}

console.log(`Secret scan passed (${files.length} tracked files).`)
