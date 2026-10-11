import RSS from 'rss'

import { apiClient } from '~/lib/request'

export const dynamic = 'force-dynamic'
export const revalidate = 86400 // 1 day

export async function GET() {
  const [agg, thinking] = await Promise.all([
    apiClient.aggregate.getAggregateData(undefined, {
      next: { revalidate: 86400 },
    }),
    apiClient.recently.getList({
      size: 20,
    }),
  ])

  const { title, description } = agg.seo

  const now = new Date()
  const feed = new RSS({
    title: `思考 - ${title}`,
    description,
    site_url: agg.url.webUrl,
    feed_url: `${agg.url.webUrl}/thinking/feed`,
    language: 'zh-CN',
    generator: 'Shiro (https://github.com/Innei/Shiro)',
    pubDate: now.toUTCString(),
  })

  for (const t of thinking) {
    feed.item({
      title: new Date(t.createdAt).toLocaleDateString(),
      description:
        `${t.content}\n\n${t.ref?.title ? `引用：${t.ref.title}` : ''}\n\n` +
        ` <p style='text-align: right'>
      <a href='${`${agg.url.webUrl}/thinking/${t.id}`}'>看完了？说点什么呢</a>
      </p>`,
      url: `${agg.url.webUrl}/thinking`,
      guid: t.id,
      date: t.createdAt,
    })
  }

  return new Response(feed.xml(), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'max-age=60, s-maxage=86400',
      'CDN-Cache-Control': 'max-age=86400',
      'Cloudflare-CDN-Cache-Control': 'max-age=86400',
      'Vercel-CDN-Cache-Control': 'max-age=86400',
    },
  })
}
