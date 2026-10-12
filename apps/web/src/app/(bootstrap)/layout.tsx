import type { Metadata } from 'next'
import { PublicEnvScript } from 'next-runtime-env'
import type { PropsWithChildren } from 'react'

export const metadata: Metadata = {
  title: 'Shiro · MX-CMS',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default function BootstrapLayout({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <head>
        <PublicEnvScript />
      </head>
      <body
        className="m-0 bg-slate-50 text-slate-900"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-12">
          <p className="mb-3 text-sm font-semibold tracking-widest text-teal-700">
            SHIRO / MX-CMS
          </p>
          {children}
        </main>
      </body>
    </html>
  )
}
