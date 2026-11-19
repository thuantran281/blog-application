import { adminCredentials, expect, test } from './fixtures'

test.describe('accessibility', () => {
  test('skip link moves focus to main content', async ({ page }) => {
    await page.goto('/')

    await page.keyboard.press('Tab')

    const skipLink = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skipLink).toBeFocused()

    await page.keyboard.press('Enter')

    await expect(page.locator('#main-content')).toBeFocused()
  })

  test('login form can be completed with the keyboard', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').focus()
    await expect(page.getByLabel('Email')).toBeFocused()
    await page.keyboard.type(adminCredentials.email)

    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Password')).toBeFocused()
    await page.keyboard.type(adminCredentials.password)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Log in' })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
  })
})
