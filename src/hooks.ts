import React from 'react'
import { type Realm, type CellDefinition, type SignalDefinition } from './gurx'
import { RealmContext } from './react'

export function useRealm() {
  const realm = React.useContext(RealmContext)
  if (realm === null) {
    throw new Error('useRealm must be used within a RealmContextProvider')
  }
  return realm
}

export function useCell<T>(cell: CellDefinition<T>) {
  const realm = useRealm()
  const value = React.useSyncExternalStore(
    (callback) => realm.sub(cell, callback),
    () => realm.getValue(cell)
  )
  const setter = React.useCallback(
    (value: T) => {
      realm.pub(cell, value)
    },
    [realm, cell]
  )
  return [value, setter] as const
}

export function useRealmEffect(callback: (r: Realm) => void, deps: React.DependencyList = []) {
  const realm = useRealm()

  React.useEffect(() => {
    callback(realm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realm, ...deps])
}

export function useInit(init: (realm: Realm) => void) {
  const realm = useRealm()

  React.useMemo(() => {
    init(realm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realm])
}

export function useSetter<T>(node: CellDefinition<T> | SignalDefinition<T>) {
  const realm = useRealm()
  return React.useCallback(
    (value: T) => {
      realm.pub(node, value)
    },
    [realm, node]
  )
}
