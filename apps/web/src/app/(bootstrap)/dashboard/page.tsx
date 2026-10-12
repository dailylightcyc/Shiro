import { redirect } from 'next/navigation'

import { getCmsInitialization } from '~/lib/cms-bootstrap.server'
import { apiClient } from '~/lib/request'

import DashboardForm from '../DashboardForm'

export const metadata = { title: '站点管理 · Shiro' }

export default async function DashboardPage() {
  const state = await getCmsInitialization()
  if (!state.initialized) redirect('/setup')
  const loggedIn = await apiClient.owner.checkTokenValid().catch(() => null)
  if (!loggedIn?.ok) redirect('/login')
  return <DashboardForm />
}
