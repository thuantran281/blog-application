const baseUrl = (
  process.env.SITE_URL ??
  process.argv[2] ??
  'https://thuantran-blog-staging.fly.dev'
).replace(/\/+$/, '')

const checks = [
  {
    path: '/health/live',
    status: 200,
    contentType: 'application/json',
    includes: '"status":"ok"',
  },
  {
    path: '/health/ready',
    status: 200,
    contentType: 'application/json',
    includes: '"status":"ok"',
  },
  {
    path: '/',
    status: 200,
    contentType: 'text/html',
    includes: '<title>Inkwell',
  },
  {
    path: '/sitemap.xml',
    status: 200,
    contentType: 'application/xml',
    includes: '<urlset',
  },
  {
    path: '/rss.xml',
    status: 200,
    contentType: 'application/rss+xml',
    includes: '<rss',
  },
  {
    path: '/robots.txt',
    status: 200,
    contentType: 'text/plain',
    includes: 'Sitemap:',
  },
]

let failures = 0

for (const check of checks) {
  const url = new URL(check.path, `${baseUrl}/`)
  const startedAt = Date.now()

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent': 'inkwell-monitor/1.0',
      },
    })
    const contentType = response.headers.get('content-type') ?? ''
    const body = await response.text()
    const durationMs = Date.now() - startedAt
    const problems = []

    if (response.status !== check.status) {
      problems.push(`expected status ${check.status}, got ${response.status}`)
    }

    if (!contentType.includes(check.contentType)) {
      problems.push(`expected content type ${check.contentType}, got ${contentType || 'none'}`)
    }

    if (!body.includes(check.includes)) {
      problems.push(`response did not include ${JSON.stringify(check.includes)}`)
    }

    if (problems.length > 0) {
      failures += 1
      console.error(`FAIL ${check.path} (${durationMs}ms): ${problems.join('; ')}`)
      continue
    }

    console.log(`OK   ${check.path} (${durationMs}ms)`)
  } catch (error) {
    failures += 1
    console.error(`FAIL ${check.path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} of ${checks.length} checks failed for ${baseUrl}`)
  process.exit(1)
}

console.log(`\nAll ${checks.length} checks passed for ${baseUrl}`)
