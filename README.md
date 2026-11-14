# Blog Application

A full-stack blog platform with authentication, publishing workflows, comments, taxonomy management, and an admin interface.

## Features

- User registration and JWT authentication
- Draft and published posts with ownership checks
- Local draft backup and recovery, plus bounded autosave for existing posts
- Optimistic post concurrency (`version`) and idempotent post/comment retries
- Per-post bylines: username, custom display name, or anonymous
- Markdown editor with headings, lists, links, tables, and sanitized rendering
- Categories and tags with filtering
- Admin-only category/tag management at `/admin/taxonomy`
- Guest and member comments
- Pagination and post filtering
- RSS feed, XML sitemap, robots.txt, and per-post SEO metadata
- Responsive React client with light/dark styling
- Security headers, CORS allowlisting, rate limiting, request IDs, and health checks

## Stack

| Layer | Technology |
| --- | --- |
| Client | React 19, TypeScript, Vite, React Router |
| Server | Node.js, Express 5, TypeScript, Zod |
| Database | PostgreSQL |
| Auth | JWT, bcryptjs |
| Testing | Vitest, Supertest, Newman, Playwright |
| CI | GitHub Actions |

## Project structure

```text
.
├── client/                     React frontend
├── e2e/                        Playwright browser tests
├── server/                     Express API
│   ├── db/migrations/          SQL migrations
│   ├── scripts/                Admin bootstrap scripts
│   ├── src/                    API source
│   └── tests/                  Vitest/Supertest tests
├── postman/                    Postman collection and environment
└── .github/workflows/ci.yml    CI pipeline
```

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`)
- npm
- PostgreSQL 14+ (CI uses PostgreSQL 16)

## Local setup

### 1. Create the database

Create the application database:

```powershell
createdb -U postgres blog_db
```

Alternatively, create `blog_db` using pgAdmin. The test database (`blog_db_test` by default) is created automatically when tests run.

### 2. Configure and start the server

```powershell
cd server
npm install
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead.

Edit `server/.env` and set at minimum:

- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`
- `JWT_SECRET` (at least 32 characters)

Then apply migrations:

```powershell
npm run db:migrate
```

Seed an admin account:

```powershell
$env:ADMIN_USERNAME="admin"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="change-me"
npm run seed-admin
```

You can also place the `ADMIN_*` values in `.env` before running `npm run seed-admin`.

Start the API:

```powershell
npm run dev
```

The API runs at `http://localhost:3000`.

To promote an existing user instead:

```powershell
npm run promote-admin -- user@example.com
```

The promoted user must log in again to receive a token with the `admin` role.

To reset a user's password locally:

```powershell
npm run reset-password -- user@example.com
```

You will be prompted for the new password twice. Existing JWT sessions remain valid until they expire.

### 3. Start the client

In a second terminal:

```powershell
cd client
npm install
npm run dev
```

The client runs at `http://localhost:5173`.

By default, the client calls `http://localhost:3000`. To use a different API URL, create `client/.env.local`:

```text
VITE_API_URL=http://localhost:3000
```

## Configuration

### Server environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test`, or `production` |
| `PORT` | No | `3000` | API port |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error`, or `silent` |
| `TRUST_PROXY` | No | `false` | Set `true` when running behind a reverse proxy |
| `DB_USER` | Yes | - | PostgreSQL user |
| `DB_PASSWORD` | Yes | - | PostgreSQL password |
| `DB_HOST` | No | `localhost` | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_NAME` | Yes | - | Application database |
| `DB_POOL_MAX` | No | `10` | Maximum PostgreSQL pool size |
| `TEST_DB_NAME` | No | `blog_db_test` | Test database name |
| `JWT_SECRET` | Yes | - | JWT signing secret, minimum 32 characters |
| `JWT_EXPIRES_IN` | No | `7d` | Token lifetime |
| `CORS_ORIGINS` | Production | local dev origins | Comma-separated allowed browser origins |
| `JSON_BODY_LIMIT` | No | `100kb` | Maximum JSON request body size |
| `CLIENT_DIST_PATH` | No | - | Serve the built client from this directory |
| `ADMIN_USERNAME` | Seed only | - | Admin username for `seed-admin` |
| `ADMIN_EMAIL` | Seed only | - | Admin email for `seed-admin` |
| `ADMIN_PASSWORD` | Seed only | - | Admin password for `seed-admin` |

### Client environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | No | Dev: `http://localhost:3000` | Backend API base URL; production builds use same-origin by default |

## Commands

### Server

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with file watching |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled API |
| `npm run typecheck` | Typecheck source and tests |
| `npm run format` | Format files with Prettier |
| `npm run format:check` | Verify formatting |
| `npm run db:migrate` | Apply pending migrations |
| `npm run seed-admin` | Create or reset an admin from `ADMIN_*` variables |
| `npm run promote-admin -- <email-or-username>` | Promote an existing user |
| `npm run reset-password -- <email-or-username>` | Set a new password for an existing user |
| `npm test` | Run server tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:api` | Run the Newman API collection against a running server |

### Client

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Typecheck and build for production |
| `npm run typecheck` | Typecheck the client |
| `npm run lint` | Run oxlint |
| `npm run preview` | Preview the production build |

### Browser E2E

Playwright tests live in `e2e/`. They start the compiled server on port `3100` and serve the built client from the same origin.

From the repository root:

```powershell
npm install
npm run test:e2e:install
npm run test:e2e
```

Build both packages and apply migrations before the first run:

```powershell
cd client; npm run build
cd ..\server; npm run build; npm run db:migrate
```

The tests use the admin credentials `postman_admin@example.com` / `password123` by default. Override them with `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, and `E2E_ADMIN_USERNAME`. The server reads database settings from `server/.env` locally, or from the process environment in CI.

## API overview

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/` | Public database check, or SPA when `CLIENT_DIST_PATH` is set |
| `GET` | `/health/live` | Public liveness check |
| `GET` | `/health/ready` | Public readiness check |
| `GET` | `/sitemap.xml` | Public sitemap of published posts |
| `GET` | `/rss.xml` | Public RSS feed of published posts |
| `GET` | `/robots.txt` | Public crawler rules and sitemap reference |
| `POST` | `/api/auth/register` | Public |
| `POST` | `/api/auth/login` | Public |
| `GET` | `/api/auth/me` | Authenticated |
| `GET` | `/api/categories` | Public |
| `GET` | `/api/categories/:slug` | Public |
| `POST` | `/api/categories` | Admin |
| `PATCH` | `/api/categories/:id` | Admin |
| `DELETE` | `/api/categories/:id` | Admin |
| `GET` | `/api/tags` | Public |
| `GET` | `/api/tags/:slug` | Public |
| `POST` | `/api/tags` | Admin |
| `PATCH` | `/api/tags/:id` | Admin |
| `DELETE` | `/api/tags/:id` | Admin |
| `GET` | `/api/posts` | Public published posts |
| `GET` | `/api/posts/mine` | Authenticated |
| `GET` | `/api/posts/:slug` | Public; draft access for owner |
| `POST` | `/api/posts` | Authenticated |
| `PATCH` | `/api/posts/:id` | Owner |
| `DELETE` | `/api/posts/:id` | Owner |
| `GET` | `/api/posts/:slug/comments` | Public |
| `POST` | `/api/posts/:slug/comments` | Public or authenticated |
| `DELETE` | `/api/comments/:id` | Comment owner |

`PATCH /api/posts/:id` must include the current post `version`. A stale version returns `409` with the current post in `details.current`. Post and comment creation accept an optional UUID `clientRequestId`; retrying with the same ID returns the previously created row instead of creating a duplicate. Post slugs stay stable after creation.

## Testing

Run server tests:

```powershell
cd server
npm test
```

Tests use `TEST_DB_NAME` (default `blog_db_test`) and apply migrations automatically.

Run API smoke tests against a running server:

```powershell
cd server
npm run test:api
```

Before running Newman, seed an admin whose credentials match the `adminEmail` and `adminPassword` collection variables. The Postman collection is in `postman/blog-api.postman_collection.json`.

Run browser E2E tests from the repository root:

```powershell
npm run test:e2e
```

See [Browser E2E](#browser-e2e) for setup details.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests. It:

- Starts PostgreSQL 16
- Installs server and client dependencies
- Checks server formatting and typechecking
- Runs the server test suite
- Typechecks, lints, and builds the client
- Builds the server
- Applies migrations
- Seeds an admin
- Starts the production build
- Runs Newman API smoke tests
- Installs Chromium and runs Playwright browser tests

On pushes to `main`, the `deploy-staging` job deploys to Fly.io after the test job passes. It requires a `FLY_API_TOKEN` repository secret.

The workflow only runs after the repository is pushed to GitHub.

## Staging deployment on Fly.io

The repository includes a multi-stage `Dockerfile`, `fly.toml`, and a CI deploy job. The image builds the React client and serves it from the Express API on the same origin.

One-time setup:

```powershell
fly apps create thuantran-blog-staging
fly postgres create --name thuan-tran-blog-db --region sin --initial-cluster-size 1
```

Set the staging secrets using the database password from the previous command:

```powershell
fly secrets set -a thuantran-blog-staging `
  DB_USER=postgres `
  DB_PASSWORD="<database-password>" `
  DB_HOST=thuan-tran-blog-db.internal `
  DB_PORT=5432 `
  DB_NAME=postgres `
  JWT_SECRET="<at-least-32-random-characters>" `
  JWT_EXPIRES_IN=7d `
  CORS_ORIGINS=https://thuantran-blog-staging.fly.dev `
  TRUST_PROXY=true
```

Deploy once, then seed the admin:

```powershell
fly deploy --remote-only
fly secrets set -a thuantran-blog-staging ADMIN_USERNAME=admin ADMIN_EMAIL=you@example.com ADMIN_PASSWORD="<strong-password>"
fly ssh console -a thuantran-blog-staging -C "npm run seed-admin"
fly secrets unset -a thuantran-blog-staging ADMIN_USERNAME ADMIN_EMAIL ADMIN_PASSWORD
```

Enable automatic staging deploys by creating a deploy token and adding it to GitHub as `FLY_API_TOKEN`:

```powershell
fly tokens create deploy -a thuantran-blog-staging
```

If `thuantran-blog-staging` is unavailable, change the `app` value in `fly.toml` and the URLs above. The staging site is `https://thuantran-blog-staging.fly.dev`.

### Database backups

The staging Postgres cluster uses Fly WAL archiving to Tigris. It keeps a 7-day recovery window and creates full backups every 24 hours.

```powershell
fly postgres backup config show -a thuan-tran-blog-db
fly postgres backup list -a thuan-tran-blog-db
fly postgres backup create -a thuan-tran-blog-db
```

Restore into a new Postgres app, then point the application at it:

```powershell
fly postgres backup restore <restore-app-name> -a thuan-tran-blog-db --restore-target-name <backup-id>
```

Fly Postgres is unmanaged; test the restore path before using it for production data.

## Production notes

- Set `NODE_ENV=production`.
- Set `CORS_ORIGINS` to the deployed client origin. It is required in production and must use HTTPS outside localhost.
- Use a unique `JWT_SECRET` of at least 32 characters. Placeholder and example values are rejected in production.
- Keep real secrets in `server/.env` locally and in Fly secrets when deployed. Never commit `.env`, private keys, or credential files.
- Run `npm run check:secrets` before committing. CI runs the same scan on every push and pull request.
- Set `TRUST_PROXY=true` when the API is behind a trusted reverse proxy.
- Set `CLIENT_DIST_PATH` to serve the built client from the API on the same origin.
- Run `npm run db:migrate` before starting a new deployment.
- Serve the API over HTTPS through a reverse proxy.
- Use `/health/live` for process checks and `/health/ready` for database-backed readiness checks.
- Build and start the server with `npm run build` and `npm start`.
- Build the client with `npm run build` and serve `client/dist`.

Authentication currently stores JWTs in browser `localStorage`. For a higher-security production setup, consider moving to `httpOnly`, `Secure`, `SameSite` cookies with CSRF protection.
