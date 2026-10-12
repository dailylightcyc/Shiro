import type { InputHTMLAttributes, PropsWithChildren } from 'react'

import { API_URL } from '~/constants/env'

export const trailingSlash = /\/$/

export const buttonClass =
  'rounded-lg bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-50'

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  )
}

export function Card({ children }: PropsWithChildren) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {children}
    </div>
  )
}

export async function cmsRequest(path: string, method = 'GET', data?: unknown) {
  const response = await fetch(`${API_URL.replace(trailingSlash, '')}${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      body?.error?.message || body?.message || 'CMS 请求失败，请稍后重试',
    )
  }
  return body?.data ?? body
}
