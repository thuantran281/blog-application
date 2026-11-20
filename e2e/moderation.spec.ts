import { createPostViaApi, expect, loginViaUi, test } from './fixtures'

test.describe('comment moderation', () => {
  test('visitor reports are reviewable and removable by an admin', async ({
    page,
    request,
    e2eRun,
  }) => {
    const post = await createPostViaApi(request, {
      title: `${e2eRun.prefix} moderation post`,
      content: 'A post with a comment that needs review.',
    })
    const commentText = `Report me ${Date.now()}`

    await page.goto(`/posts/${post.slug}`)
    await page.getByLabel('Your name').fill('Spammer')
    await page.getByLabel('Comment', { exact: true }).fill(commentText)
    await page.getByRole('button', { name: 'Post comment' }).click()

    const comment = page.locator('.comment').filter({ hasText: commentText })
    await expect(comment).toBeVisible()

    await comment.getByRole('button', { name: 'Report' }).click()
    await expect(comment.getByRole('button', { name: 'Reported' })).toBeDisabled()

    await loginViaUi(page)
    await page.goto('/admin/moderation')

    const reported = page.locator('.comment').filter({ hasText: commentText })
    await expect(reported).toBeVisible()
    await expect(reported.getByText('1 report')).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await reported.getByRole('button', { name: 'Delete comment' }).click()
    await expect(reported).toHaveCount(0)

    await page.goto(`/posts/${post.slug}`)
    await expect(page.getByText(commentText)).toHaveCount(0)
  })
})
