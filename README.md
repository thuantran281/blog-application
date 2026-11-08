# Blog Application

A full-stack blog platform with authentication, publishing workflows, comments, taxonomy management, and an admin interface.

## Features

- User registration and JWT authentication
- Draft and published posts with ownership checks
- Per-post bylines: username, custom display name, or anonymous
- Categories and tags with filtering
- Admin-only category/tag management at `/admin/taxonomy`
- Guest and member comments
- Pagination and post filtering
- Responsive React client with light/dark styling
- Security headers, CORS allowlisting, rate limiting, request IDs, and health checks

## Stack

| Layer | Technology |
| --- | --- |
| Client | React 19, TypeScript, Vite, React Router |
| Server | Node.js, Express 5, TypeScript, Zod |
| Database | PostgreSQL |
| Auth | JWT, bcryptjs |
| Testing | Vitest, Supertest, Newman |
| CI | GitHub Actions |

## Project structure

```text
.
├── client/                     React frontend
├── server/                     Express API
│   ├── db/migrations/          SQL migrations
│   ├── scripts/                Admin bootstrap scripts
│   ├── src/                    API source
│   └── tests/                  Vitest/Supertest tests
├── postman/                    Postman collection and environment
└── .github/workflows/ci.yml    CI pipeline
```

## Prerequisites

- Node.js 20.19+ (or a newer LTS release)
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
| `ADMIN_USERNAME` | Seed only | - | Admin username for `seed-admin` |
| `ADMIN_EMAIL` | Seed only | - | Admin email for `seed-admin` |
| `ADMIN_PASSWORD` | Seed only | - | Admin password for `seed-admin` |

### Client environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | No | `http://localhost:3000` | Backend API base URL |

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

## API overview

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/` | Public database check |
| `GET` | `/health/live` | Public liveness check |
| `GET` | `/health/ready` | Public readiness check |
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

The workflow only runs after the repository is pushed to GitHub.

## Production notes

- Set `NODE_ENV=production`.
- Set `CORS_ORIGINS` to the deployed client origin. It is required in production.
- Use a unique `JWT_SECRET` of at least 32 characters.
- Set `TRUST_PROXY=true` when the API is behind a trusted reverse proxy.
- Run `npm run db:migrate` before starting a new deployment.
- Serve the API over HTTPS through a reverse proxy.
- Use `/health/live` for process checks and `/health/ready` for database-backed readiness checks.
- Build and start the server with `npm run build` and `npm start`.
- Build the client with `npm run build` and serve `client/dist`.

Authentication currently stores JWTs in browser `localStorage`. For a higher-security production setup, consider moving to `httpOnly`, `Secure`, `SameSite` cookies with CSRF protection.
