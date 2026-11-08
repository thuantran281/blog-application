import bcrypt from 'bcryptjs'
import pool from '../config/db.js'
import type { AuthUser, UserRole } from '../types/auth.js'

const SALT_ROUNDS = 10

const PUBLIC_COLUMNS = 'id, username, email, role, created_at, updated_at'

export interface User extends AuthUser {
  created_at: Date
  updated_at: Date
}

export interface UserWithPassword extends User {
  password_hash: string
}

export class AuthConflictError extends Error {
  constructor(message = 'Username or email already in use') {
    super(message)
    this.name = 'AuthConflictError'
  }
}

interface CreateUserParams {
  username: string
  email: string
  password: string
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  )
}

export async function createUser({ username, email, password }: CreateUserParams): Promise<User> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  try {
    const result = await pool.query<User>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PUBLIC_COLUMNS}`,
      [username, email, passwordHash, 'member' satisfies UserRole],
    )

    const user = result.rows[0]

    if (!user) {
      throw new Error('Insert did not return a user')
    }

    return user
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AuthConflictError()
    }

    throw err
  }
}

export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const result = await pool.query<UserWithPassword>(
    `SELECT ${PUBLIC_COLUMNS}, password_hash
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email],
  )

  return result.rows[0] ?? null
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT ${PUBLIC_COLUMNS}
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id],
  )

  return result.rows[0] ?? null
}

export function verifyPassword(user: UserWithPassword, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash)
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  }
}
