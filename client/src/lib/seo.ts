import { useEffect } from 'react'
import type { Post } from '../types'

export const SITE_NAME = 'Inkwell'
export const DEFAULT_TITLE = `${SITE_NAME} — Blog`
export const DEFAULT_DESCRIPTION =
  'Inkwell is a community blog for sharing stories, ideas, and drafts.'

const MANAGED_ATTRIBUTE = 'data-seo-managed'

export interface PageMeta {
  enabled?: boolean
  title: string
  description: string
  canonicalPath: string
  type?: 'website' | 'article'
  publishedAt?: string | null
  modifiedAt?: string | null
  author?: string | null
  noIndex?: boolean
}

export function plainText(markdown: string, maxLength: number): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[ \t]*[-*+] /gm, ' ')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

export function postDescription(post: Post): string {
  return post.excerpt?.trim() || plainText(post.content, 280) || DEFAULT_DESCRIPTION
}

function removeManagedTags() {
  document.head.querySelectorAll(`[${MANAGED_ATTRIBUTE}]`).forEach((node) => node.remove())
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
  element.setAttribute(MANAGED_ATTRIBUTE, 'true')
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }

  element.setAttribute('href', href)
  element.setAttribute(MANAGED_ATTRIBUTE, 'true')
}

export function usePageMeta({
  enabled = true,
  title,
  description,
  canonicalPath,
  type = 'website',
  publishedAt = null,
  modifiedAt = null,
  author = null,
  noIndex = false,
}: PageMeta) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const origin = window.location.origin
    const canonicalUrl = new URL(canonicalPath, origin).toString()

    document.title = title
    document.head
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', description)

    removeManagedTags()
    setCanonical(canonicalUrl)
    setMeta('property', 'og:site_name', SITE_NAME)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', canonicalUrl)
    setMeta('name', 'twitter:card', 'summary')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)

    if (author) {
      setMeta('name', 'author', author)
      setMeta('property', 'article:author', author)
    }

    if (publishedAt) {
      setMeta('property', 'article:published_time', publishedAt)
    }

    if (modifiedAt) {
      setMeta('property', 'article:modified_time', modifiedAt)
    }

    if (noIndex) {
      setMeta('name', 'robots', 'noindex, nofollow')
    }

    return () => {
      document.title = DEFAULT_TITLE
      document.head
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', DEFAULT_DESCRIPTION)
      removeManagedTags()
    }
  }, [
    enabled,
    title,
    description,
    canonicalPath,
    type,
    publishedAt,
    modifiedAt,
    author,
    noIndex,
  ])
}
