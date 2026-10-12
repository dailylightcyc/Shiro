import { redirect } from 'next/navigation'

import { getCmsInitialization } from '~/lib/cms-bootstrap.server'

import SetupForm from '../SetupForm'

export default async function SetupPage() {
  const state = await getCmsInitialization()
  if (state.initialized) redirect('/login')
  return <SetupForm connectionError={state.error} />
}
