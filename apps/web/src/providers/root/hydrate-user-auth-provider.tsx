'use client'

import { useEffect } from 'react'

import { setIsOwnerLogged } from '~/atoms/hooks/owner'

export const HydrateuserAuthProvider = (props: { isLogged: boolean }) => {
  useEffect(() => setIsOwnerLogged(props.isLogged), [props.isLogged])
  return null
}
