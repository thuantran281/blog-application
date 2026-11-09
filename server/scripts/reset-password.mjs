import 'dotenv/config'
import * as readline from 'node:readline'
import { Writable } from 'node:stream'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const identifier = process.argv[2]?.trim()

if (!identifier) {
  console.error('Usage: npm run reset-password -- <email-or-username>')
  process.exit(1)
}

function createHiddenPrompt() {
  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutedOutput,
    terminal: process.stdin.isTTY === true,
  })

  let pending

  rl.on('SIGINT', () => {
    rl.close()
    process.stdout.write('\n')
    process.exit(130)
  })

  rl.on('close', () => {
    if (pending) {
      pending.reject(new Error('Input closed before a password was entered.'))
      pending = undefined
    }
  })

  return {
    ask(question) {
      process.stdout.write(question)

      return new Promise((resolve, reject) => {
        pending = { resolve, reject }

        rl.question('', (answer) => {
          pending = undefined
          process.stdout.write('\n')
          resolve(answer)
        })
      })
    },
    close() {
      pending = undefined
      rl.close()
    },
  }
}

const prompt = createHiddenPrompt()
let password
let confirmation

try {
  password = await prompt.ask('New password: ')
  confirmation = await prompt.ask('Confirm new password: ')
} catch (err) {
  prompt.close()
  console.error(err.message)
  process.exit(1)
} finally {
  prompt.close()
}

if (password !== confirmation) {
  console.error('Passwords do not match.')
  process.exit(1)
}

if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
  console.error('Password must be 8-72 characters and at most 72 UTF-8 bytes.')
  process.exit(1)
}

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
})

try {
  const passwordHash = await bcrypt.hash(password, 10)

  let result = await pool.query(
    `UPDATE users
     SET password_hash = $2
     WHERE lower(email) = lower($1)
     RETURNING username, email`,
    [identifier, passwordHash],
  )

  if (result.rowCount === 0) {
    result = await pool.query(
      `UPDATE users
       SET password_hash = $2
       WHERE username = $1
       RETURNING username, email`,
      [identifier, passwordHash],
    )
  }

  const user = result.rows[0]

  if (!user) {
    console.error(`No user found for "${identifier}"`)
    process.exitCode = 1
  } else {
    console.log(`Password reset for ${user.username} <${user.email}>.`)
    console.log(
      'Existing JWT sessions remain valid until they expire. Log in with the new password.',
    )
  }
} catch (err) {
  console.error('Failed to reset password:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
