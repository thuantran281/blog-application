import { adminCredentials, expect, loginViaUi, test } from './fixtures'

test.describe('authentication', () => {
  test('redirects guests to login and returns them to the protected page', async ({ page }) => {
    await page.goto('/write')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill(adminCredentials.email)
    await page.getByLabel('Password').fill(adminCredentials.password)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/write$/)
    await expect(page.getByRole('heading', { name: 'Write something new' })).toBeVisible()
    await expect(page.locator('.user-chip')).toHaveText(adminCredentials.username)
  })

  test('shows an error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill(adminCredentials.email)
    await page.getByLabel('Password').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page.locator('.error')).toHaveText('Invalid email or password')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('logs out and protects private routes again', async ({ page }) => {
    await loginViaUi(page)
    await page.getByRole('button', { name: 'Log out' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()

    await page.goto('/my-posts')
    await expect(page).toHaveURL(/\/login$/)
  })
})
