import type { NoteModel } from '@mx-space/api-client'
import { RequestError } from '@mx-space/api-client'
import { createFetch } from 'ofetch'
import { describe, expect, it, vi } from 'vitest'

import { createApiClient, createFetchAdapter } from './shared'

vi.mock('~/constants/env', () => ({ API_URL: 'http://cms.test/api/v3' }))

const id = '9007199254740993123'
const refId = '9007199254740993124'
const createdAt = '2026-10-11T12:00:00.000Z'

function cmsClient(body: unknown, status = 200) {
  const fetch = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  const client = createApiClient(
    createFetchAdapter(
      createFetch({ fetch, defaults: { retry: 0, credentials: 'include' } }),
    ),
  )
  return { client, fetch }
}

// Fixtures follow MX-CMS's ResponseInterceptor and public controllers. The
// real SDK and ofetch decoder run together so serialization drift is visible.
describe('MX-CMS v3 API contract', () => {
  it('unwraps aggregate data and leaves resource IDs as strings', async () => {
    const { client } = cmsClient({
      data: {
        user: { id, name: 'Owner' },
        latest_note_id: { id: refId, nid: 42 },
        theme: { config: { site: { title: 'Blog' } } },
        comment_options: { disable_comment: false, allow_guest_comment: true },
      },
    })
    const result = await client.aggregate.getAggregateData('shiro')
    expect(result.user.id).toBe(id)
    expect(result.latestNoteId).toEqual({ id: refId, nid: 42 })
    expect(result.commentOptions?.allowGuestComment).toBe(true)
    expect(result.$serialized).not.toHaveProperty('data')
  })

  it('preserves user-defined theme and article metadata keys', async () => {
    const theme = {
      config: {
        module: {
          rss: { custom_elements: [{ follow_challenge: [{ feedId: '123' }] }] },
        },
      },
    }
    const { client } = cmsClient({ data: { theme } })
    expect((await client.aggregate.getAggregateData('shiro')).theme).toEqual(
      theme,
    )
    const meta = { custom_field: { 'my-key': true } }
    const { client: posts } = cmsClient({ data: { id, meta } })
    expect((await posts.post.getPost('tech', 'hello')).meta).toEqual(meta)
  })

  it('preserves reader and presence identities while decoding their fields', async () => {
    const { client } = cmsClient({
      data: {
        readers: { reader_1: { display_name: 'Reader' } },
        presence: { guest_1: { reader_id: 'reader_1' } },
      },
    })
    const response = await client.activity.getPresence('post')
    expect(response.readers).toEqual({ reader_1: { displayName: 'Reader' } })
    expect(response.presence).toEqual({ guest_1: { readerId: 'reader_1' } })
  })

  it('carries detail meta into serialized article views and preserves enrichment URL keys', async () => {
    const url = 'https://example.com/a_b/my-page'
    const { client } = cmsClient({
      data: {
        id,
        title: 'Translated',
        created_at: createdAt,
        read_count: 7,
        like_count: 2,
        meta: { cover: url },
      },
      meta: {
        interaction: { is_liked: true },
        translation: {
          [id]: {
            article: {
              is_translated: true,
              source_lang: 'zh',
              target_lang: 'en',
              translated_at: createdAt,
              available_translations: ['en', 'ja'],
            },
          },
        },
        insights: { has_in_locale: true },
        enrichments: { [url]: { title: 'Card', preview_image: { url } } },
        related: [{ id: refId, title: 'Related', slug: 'other' }],
      },
    })
    const response = await client.post.getPost('tech', 'hello')
    const serialized = JSON.stringify(response.$serialized)
    const view = JSON.parse(serialized)
    expect(view).toMatchObject({
      id,
      createdAt,
      readCount: 7,
      likeCount: 2,
      isLiked: true,
      isTranslated: true,
      hasInsightsInLocale: true,
      translationMeta: { targetLang: 'en' },
    })
    expect(view.enrichments[url].previewImage.url).toBe(url)
    expect(view.related[0].id).toBe(refId)
    expect(view).not.toHaveProperty('$meta')
  })

  it('returns native flat note details with adjacent navigation', async () => {
    const { client } = cmsClient({
      data: {
        id,
        nid: 42,
        title: 'Note',
        created_at: createdAt,
        next: { id: refId, nid: 41 },
        prev: null,
      },
      meta: { interaction: { is_liked: true } },
    })
    const result = await client.note.getNoteByNid(42)
    expect(result.$serialized).toMatchObject({
      id,
      nid: 42,
      next: { id: refId, nid: 41 },
      prev: null,
      isLiked: true,
    })
    expect(result.$serialized).not.toHaveProperty('data')
  })

  it('decodes pagination from meta and applies per-item interaction', async () => {
    const { client } = cmsClient({
      data: [{ id, created_at: createdAt, title: 'Post' }],
      meta: {
        pagination: { page: 2, size: 10, total: 25, total_pages: 3 },
        interaction: { [id]: { is_liked: true } },
      },
    })
    const result = await client.post.getList(2, 10, { sortBy: 'createdAt' })
    expect(result.pagination).toEqual({
      page: 2,
      size: 10,
      total: 25,
      totalPages: 3,
    })
    expect(result.pagination.page < result.pagination.totalPages).toBe(true)
    expect(result.$serialized.data[0]).toMatchObject({ id, isLiked: true })
  })

  it('keeps unpaginated arrays, including empty arrays', async () => {
    const { client } = cmsClient({ data: [] })
    expect((await client.topic.getAll()).$serialized).toEqual([])
    expect((await client.recently.getList()).$serialized).toEqual([])
    expect((await client.project.getAll()).$serialized).toEqual([])
    expect((await client.category.getAllTags()).$serialized).toEqual([])
  })

  it('unwraps configured login providers as a native array', async () => {
    const { client, fetch } = cmsClient({ data: ['github', 'google'] })
    const result = await client.proxy.auth.providers.get<string[]>()
    expect(result.$serialized).toEqual(['github', 'google'])
    expect(String(fetch.mock.calls[0][0])).toBe(
      'http://cms.test/api/v3/auth/providers',
    )
  })

  it('keeps timeline and note-window responses in their native shapes', async () => {
    const { client } = cmsClient({
      data: { notes: [{ id, created_at: createdAt }] },
    })
    expect(
      (await client.aggregate.getTimeline()).$serialized.notes?.[0],
    ).toMatchObject({ id, createdAt })
    const { client: notes } = cmsClient({
      data: [{ id, nid: 42, created_at: createdAt }],
    })
    expect(
      (await notes.note.proxy.list(id).get<NoteModel[]>()).$serialized,
    ).toEqual([{ id, nid: 42, createdAt }])
  })

  it('collects embedded comment readers without changing thread IDs or nullable anchors', async () => {
    const { client } = cmsClient({
      data: [
        {
          id,
          ref_id: refId,
          reader_id: 'reader_1',
          reader: { name: 'Reader' },
          anchor: null,
          replies: [
            {
              id: refId,
              parent_comment_id: id,
              reader_id: 'reader_2',
              reader: { name: 'Other' },
            },
          ],
        },
      ],
      meta: { pagination: { page: 1, size: 10, total: 1, total_pages: 1 } },
    })
    const response = await client.comment.getByRefId(refId)
    expect(response.$serialized.data[0]).toMatchObject({
      id,
      refId,
      anchor: null,
    })
    expect(response.readers['reader_1'].name).toBe('Reader')
    expect(response.readers['reader_2'].name).toBe('Other')
    expect(response.data[0].replies[0].parentCommentId).toBe(id)
  })

  it('uses the CMS guest and authenticated comment routes', async () => {
    const { client, fetch } = cmsClient({ data: { id, ref_id: refId } })
    await client.comment.guestComment(refId, {
      author: 'Guest',
      mail: 'guest@example.com',
      text: 'Hello',
    })
    await client.comment.guestReply(id, {
      author: 'Guest',
      mail: 'guest@example.com',
      text: 'Reply',
    })
    await client.comment.readerComment(refId, { text: 'Reader' })
    await client.comment.readerReply(id, { text: 'Reply' })
    await client.comment
      .proxy('owner-reply')(id)
      .post({ data: { text: 'Owner' } })
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      `http://cms.test/api/v3/comments/guest/${refId}`,
      `http://cms.test/api/v3/comments/guest/reply/${id}`,
      `http://cms.test/api/v3/comments/reader/${refId}`,
      `http://cms.test/api/v3/comments/reader/reply/${id}`,
      `http://cms.test/api/v3/comments/owner-reply/${id}`,
    ])
  })

  it('forwards request headers, credentials and Next cache options', async () => {
    const { client, fetch } = cmsClient({ data: { enable: true } })
    await client.proxy.subscribe.status.get({
      headers: { 'x-lang': 'en' },
      cache: 'no-store',
      next: { revalidate: 10 },
    })
    const options = fetch.mock.calls[0][1]
    expect(new Headers(options?.headers).get('x-lang')).toBe('en')
    expect(options).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
      next: { revalidate: 10 },
    })
  })

  it('lets fetch generate multipart boundaries', async () => {
    const { client, fetch } = cmsClient({ data: { url: '/image.png' } })
    const form = new FormData()
    form.append('file', new Blob(['image']), 'image.png')
    await client.proxy.objects.upload.post({ data: form })
    const options = fetch.mock.calls[0][1]
    expect(options?.body).toBe(form)
    expect(new Headers(options?.headers).has('content-type')).toBe(false)
  })

  it('uses built-in search and unwraps subscription status', async () => {
    const { client, fetch } = cmsClient({
      data: {
        data: [],
        pagination: { page: 1, size: 10, total: 0, total_pages: 0 },
      },
    })
    await client.search.searchAll('test')
    expect(String(fetch.mock.calls[0][0])).toBe(
      'http://cms.test/api/v3/search?keyword=test',
    )
    const { client: subscribe } = cmsClient({
      data: { enable: true, bit_map: { post_c: 1 }, allow_types: ['post_c'] },
    })
    expect((await subscribe.subscribe.check()).enable).toBe(true)
  })

  it('exposes the CMS error code, message and details', async () => {
    const { client } = cmsClient(
      {
        error: {
          code: 'NOTE_FORBIDDEN',
          message: 'Password required',
          details: { ref_id: id },
        },
      },
      403,
    )
    const error = await client.note
      .getNoteByNid(42)
      .catch((error: unknown) => error)
    expect(error).toBeInstanceOf(RequestError)
    expect(error).toMatchObject({
      status: 403,
      code: 'NOTE_FORBIDDEN',
      message: 'Password required',
      details: { ref_id: id },
    })
  })
})
