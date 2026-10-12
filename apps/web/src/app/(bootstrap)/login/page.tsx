import { redirect } from 'next/navigation'

import { getCmsInitialization } from '~/lib/cms-bootstrap.server'

import LoginForm from '../LoginForm'

export default async function LoginPage() {
  const state = await getCmsInitialization()
  if (!state.initialized) redirect('/setup')
  return <LoginForm />
}
