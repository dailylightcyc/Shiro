'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'

import { API_URL } from '~/constants/env'
import {
  fetchCmsInitialization,
  resolvePublicCmsUrls,
} from '~/lib/cms-bootstrap'

import { buttonClass, Card, cmsRequest, Field } from './form'

export default function SetupForm({
  connectionError,
}: {
  connectionError: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(connectionError)
  const [created, setCreated] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) || '').trim()
    const password = String(data.get('password') || '')
    if (password !== data.get('confirmPassword')) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (await fetchCmsInitialization(API_URL)) {
        window.location.assign('/login')
        return
      }
      const urls = resolvePublicCmsUrls(API_URL, window.location.origin)
      await cmsRequest('/init/configs/seo', 'PATCH', {
        title: value('title'),
        description: value('description'),
        keywords: [],
      })
      await cmsRequest('/init/configs/url', 'PATCH', urls)
      // Owner creation closes all initialization routes, so it must be last.
      await cmsRequest('/init/owner', 'POST', {
        username: value('username'),
        name: value('name') || value('username'),
        mail: value('mail'),
        password,
      })
      setCreated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <>
        <h1 className="text-3xl font-semibold">初始化完成</h1>
        <Card>
          <p className="mb-6 leading-7 text-slate-600">
            管理员已保存在 MX-CMS。使用刚刚创建的用户名和密码登录，前端与 CMS
            管理后台共用这个账号。
          </p>
          <a className={buttonClass} href="/login">
            登录管理员账号
          </a>
        </Card>
      </>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-semibold">欢迎，开始配置你的站点</h1>
      <p className="mt-3 leading-7 text-slate-600">
        设置站点信息并创建 MX-CMS
        管理员。完成后即可发布内容，账号也可用于前端登录。
      </p>
      {error && (
        <div
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-4 text-red-800"
        >
          <p>{error}</p>
          {connectionError && (
            <p className="mt-2 text-sm">
              请确认 CMS 已启动且前端 API 地址正确。
              <a href="/setup" className="ml-2 underline">
                重新连接
              </a>
            </p>
          )}
        </div>
      )}
      <Card>
        <form onSubmit={submit} className="space-y-5">
          <fieldset
            disabled={busy || !!connectionError}
            className="space-y-5 disabled:opacity-50"
          >
            <legend className="mb-4 font-semibold">站点信息</legend>
            <Field
              label="站点名称"
              name="title"
              required
              autoComplete="organization"
            />
            <Field label="站点介绍" name="description" required />
            <h2 className="pt-4 font-semibold">CMS 管理员</h2>
            <Field
              label="用户名"
              name="username"
              required
              pattern="[A-Za-z0-9_.-]+"
              autoComplete="username"
            />
            <Field
              label="显示名称（可选）"
              name="name"
              autoComplete="nickname"
            />
            <Field
              label="邮箱"
              name="mail"
              type="email"
              required
              autoComplete="email"
            />
            <Field
              label="密码（至少 8 位）"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Field
              label="确认密码"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <button className={buttonClass} type="submit">
              {busy ? '正在初始化…' : '保存并创建管理员'}
            </button>
          </fieldset>
        </form>
      </Card>
    </>
  )
}
