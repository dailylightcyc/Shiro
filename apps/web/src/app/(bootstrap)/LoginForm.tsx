'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'

import { API_URL } from '~/constants/env'
import { authClient } from '~/lib/authjs'
import { resolvePublicCmsUrls } from '~/lib/cms-bootstrap'

import { buttonClass, Card, cmsRequest, Field } from './form'

export default function LoginForm() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const adminUrl =
    typeof window === 'undefined'
      ? ''
      : resolvePublicCmsUrls(API_URL, window.location.origin).adminUrl

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const result = await authClient.signIn.username({
        username: String(data.get('username') || '').trim(),
        password: String(data.get('password') || ''),
      })
      if (result.error) throw new Error(result.error.message || '登录失败')
      const session = await cmsRequest('/auth/session')
      if (session?.role !== 'owner') throw new Error('当前账号不是 CMS 管理员')
      setLoggedIn(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold">
        {loggedIn ? '登录成功' : '登录 MX-CMS 管理员'}
      </h1>
      <p className="mt-3 leading-7 text-slate-600">
        使用初始化时创建的 CMS 用户名和密码。
      </p>
      <Card>
        {loggedIn ? (
          <div className="flex flex-wrap gap-4">
            <a className={buttonClass} href="/">
              查看站点
            </a>
            <a className={buttonClass} href={adminUrl}>
              进入 CMS 后台
            </a>
            <a className={buttonClass} href="/dashboard">
              绑定 GitHub
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <Field
              label="CMS 用户名"
              name="username"
              required
              autoComplete="username"
              disabled={busy}
            />
            <Field
              label="密码"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={busy}
            />
            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}
            <button className={buttonClass} disabled={busy} type="submit">
              {busy ? '正在登录…' : '登录'}
            </button>
          </form>
        )}
      </Card>
    </>
  )
}
