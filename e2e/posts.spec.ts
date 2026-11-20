import type { Page } from '@playwright/test'
import { createPostViaApi, expect, loginViaUi, test } from './fixtures'

function getEditor(page: Page) {
  return page.getByRole('textbox', { name: 'Content' })
}

async function setEditorContent(page: Page, markdown: string) {
  const editor = getEditor(page)
  await editor.click()
  await editor.fill(markdown)
}

async function getStoredDraft(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((item) => item.startsWith('blog-draft:'))
    const raw = key ? window.localStorage.getItem(key) : null

    if (!raw) {
      return null
    }

    const draft = JSON.parse(raw) as { title?: string; content?: string }
    return { title: draft.title, content: draft.content }
  })
}

test.describe('posts and comments', () => {
  test('creates, edits, and deletes a post through the UI', async ({ page, e2eRun }) => {
    const title = `${e2eRun.prefix} browser post`
    const updatedTitle = `${e2eRun.prefix} updated post`

    await loginViaUi(page)
    await page.goto('/write')

    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Excerpt').fill('A post created by the Playwright browser test.')
    await setEditorContent(page, 'Written through the browser editor.')
    await page.getByLabel('Status').selectOption('published')
    await page.getByRole('button', { name: 'Create post' }).click()

    await expect(page).toHaveURL(/\/posts\//)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('Written through the browser editor.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible()

    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/edit$/)
    await expect(page.getByLabel('Title')).toHaveValue(title)
    await expect(getEditor(page)).toContainText('Written through the browser editor.')

    await page.getByLabel('Title').fill(updatedTitle)
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL(/\/posts\//)
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: updatedTitle })).toHaveCount(0)
  })

  test('recovers a locally saved draft after a reload', async ({ page, e2eRun }) => {
    const title = `${e2eRun.prefix} recovered draft`
    const draftContent = 'This draft has not been submitted to the server.'

    await loginViaUi(page)
    await page.goto('/write')

    await page.getByLabel('Title').fill(title)
    await setEditorContent(page, draftContent)
    await expect(page.getByText('Draft stored locally.')).toBeVisible()
    await expect.poll(() => getStoredDraft(page)).toEqual({ title, content: draftContent })

    await page.reload()

    await expect(page.getByText('Local draft found')).toBeVisible()
    await page.getByRole('button', { name: 'Recover draft' }).click()
    await expect(page.getByLabel('Title')).toHaveValue(title)
    await expect(getEditor(page)).toContainText(draftContent)
  })

  test('renders Markdown and sanitizes raw HTML on the post page', async ({
    page,
    request,
    e2eRun,
  }) => {
    const title = `${e2eRun.prefix} markdown post`
    const post = await createPostViaApi(request, {
      title,
      content: [
        '## Markdown heading',
        '',
        '| Column A | Column B |',
        '| --- | --- |',
        '| One | Two |',
        '',
        '**Bold text** and [a link](https://example.com).',
        '',
        '<script>window.__E2E_XSS__ = true</script>',
      ].join('\n'),
    })

    await page.goto(`/posts/${post.slug}`)

    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Markdown heading', level: 2 })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'One' })).toBeVisible()
    await expect(page.getByText('Bold text', { exact: true })).toBeVisible()
    await expect(page.locator('.post-content script')).toHaveCount(0)

    const xssValue = await page.evaluate(
      () => (window as unknown as { __E2E_XSS__?: boolean }).__E2E_XSS__,
    )
    expect(xssValue).toBeUndefined()
  })

  test('searches published posts from the shared header', async ({ page, request, e2eRun }) => {
    const searchTerm = `needle${Date.now()}`
    const matchingTitle = `${e2eRun.prefix} ${searchTerm}`
    const otherTitle = `${e2eRun.prefix} unrelated`

    await createPostViaApi(request, {
      title: matchingTitle,
      content: 'A post that should appear in search results.',
      excerpt: `Contains ${searchTerm}`,
    })
    await createPostViaApi(request, {
      title: otherTitle,
      content: 'A post that should not appear in search results.',
    })

    await page.goto('/')

    const searchbox = page.getByRole('searchbox', { name: 'Search posts' })
    await searchbox.fill(searchTerm)
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page).toHaveURL(new RegExp(`q=${searchTerm}`))
    await expect(page.getByRole('link', { name: matchingTitle })).toBeVisible()
    await expect(page.getByRole('link', { name: otherTitle })).toHaveCount(0)
    await expect(searchbox).toHaveValue(searchTerm)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(searchbox).toHaveValue('')
  })

  test('allows a guest to comment on a published post', async ({ page, request, e2eRun }) => {
    const title = `${e2eRun.prefix} comment post`
    const comment = 'A guest comment from Playwright.'
    const post = await createPostViaApi(request, {
      title,
      content: 'A published post with a comment form.',
    })

    await page.goto(`/posts/${post.slug}`)

    await page.getByLabel('Your name').fill('E2E Guest')
    await page.getByLabel('Comment', { exact: true }).fill(comment)
    await page.getByRole('button', { name: 'Post comment' }).click()

    await expect(page.getByText(comment)).toBeVisible()
    await expect(page.locator('.comment')).toContainText('E2E Guest')

    await page.reload()
    await expect(page.getByText(comment)).toBeVisible()
  })
})
