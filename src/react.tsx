import React from 'react'
import { type Realm, realm } from './realm'

export const RealmContext = React.createContext<Realm | null>(null)

export interface RealmProviderProps {
  children: React.ReactNode
  initWith?: Record<string, unknown>
  updateWith?: Record<string, unknown>
}

export const RealmProvider: React.FC<RealmProviderProps> = ({ children, initWith, updateWith = {} }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const theRealm = React.useMemo(() => realm(initWith), [])

  React.useEffect(() => {
    theRealm.pubIn(updateWith)
  }, [updateWith, theRealm])

  return <RealmContext.Provider value={theRealm}>{children}</RealmContext.Provider>
}
