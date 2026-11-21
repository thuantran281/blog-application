import { expect, loginViaUi, test } from './fixtures'

test.describe('admin users page', () => {
  test('redirects guests to login', async ({ page }) => {
    await page.goto('/admin/users')

    await expect(page).toHaveURL(/\/login$/)
  })

  test('redirects non-admin members home', async ({ page }) => {
    const username = `member_${Date.now()}${Math.random().toString(36).slice(2, 7)}`

    await page.goto('/register')
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Email').fill(`${username}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm password').fill('password123')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/$/)
  })

  test('lets an admin open the user management page', async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/admin/users')

    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Search users' })).toBeVisible()
  })
})
