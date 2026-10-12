'use client'

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

import { API_URL } from '~/constants/env'
import { resolvePublicCmsUrls } from '~/lib/cms-bootstrap'
import type { GitHubOwner } from '~/lib/github-projects'
import { saveGitHubBinding } from '~/lib/github-projects'

import { buttonClass, Card, cmsRequest, Field } from './form'

export default function DashboardForm() {
  const [username, setUsername] = useState('')
  const [savedUsername, setSavedUsername] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [adminUrl, setAdminUrl] = useState('')

  useEffect(() => {
    let active = true
    setAdminUrl(resolvePublicCmsUrls(API_URL, window.location.origin).adminUrl)
    cmsRequest('/owner')
      .then((owner: GitHubOwner) => {
        if (!active) return
        const github = String(
          (owner.socialIds ?? owner.social_ids)?.github || '',
        )
        setUsername(github)
        setSavedUsername(github)
        setReady(true)
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !ready) return
    setBusy(true)
    setError(null)
    setSuccess(false)
    try {
      const login = await saveGitHubBinding(username, cmsRequest)
      setUsername(login)
      setSavedUsername(login)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold">站点管理</h1>
      <p className="mt-3 leading-7 text-slate-600">
        使用 CMS 管理员账号管理站点与项目。
      </p>
      <Card>
        <h2 className="mb-3 text-xl font-semibold">绑定 GitHub</h2>
        <p className="mb-5 leading-7 text-slate-600">
          保存 GitHub
          用户名后，项目页会自动同步该账号的公开仓库。留空保存可解除绑定。
        </p>
        <form onSubmit={save} className="space-y-5">
          <Field
            label="GitHub 用户名或个人主页"
            name="github"
            placeholder="octocat 或 https://github.com/octocat"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              setSuccess(false)
            }}
            disabled={!ready || busy}
            autoComplete="off"
          />
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="text-teal-700">
              {savedUsername
                ? '绑定已保存，项目页会同步公开仓库。'
                : 'GitHub 绑定已解除。'}
            </p>
          )}
          <button
            className={buttonClass}
            disabled={!ready || busy}
            type="submit"
          >
            {busy ? '正在保存…' : '保存绑定'}
          </button>
        </form>
      </Card>
      <nav className="mt-6 flex flex-wrap gap-5 text-teal-800">
        <a href="/projects">查看项目</a>
        <a href={adminUrl || '/login'}>进入 CMS 后台</a>
        <a href="/">返回站点</a>
      </nav>
    </>
  )
}
