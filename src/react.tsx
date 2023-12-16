import React from 'react'
import { type Realm, realm, tap, noop } from './gurx'

export const RealmContext = React.createContext<Realm | null>(null)

export interface RealmProviderProps {
  children: React.ReactNode
  init?: (realm: Realm) => void
}

export const RealmProvider: React.FC<RealmProviderProps> = ({ children, init = noop }) => {
  const instance = React.useMemo(
    () => tap(realm(), init), // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  return <RealmContext.Provider value={instance}>{children}</RealmContext.Provider>
}
