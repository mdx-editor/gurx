import React from 'react'
import { RealmContext } from './react'
import { type SignalDefinition, type CellDefinition } from './nodes'

/**
 * Returns a direct reference to the current realm. Use with caution.
 * Prefer {@link useCellValue} and {@link useSignal}.
 * If you need to specify dependencies between cells, use the initialization function of the cells/signals.
 * @category Hooks
 */
export function useRealm() {
  const realm = React.useContext(RealmContext)
  if (realm === null) {
    throw new Error('useRealm must be used within a RealmContextProvider')
  }
  return realm
}

/**
 * Returns the current value of the cell.
 * The component will be re-rendered when the cell value changes.
 * @param cell - The cell to use.
 * @example
 * ```tsx
 * const cell$ = Cell(0)
 * //...
 * function MyComponent() {
 *   const cell = useCellValue(cell$)
 *   return <div>{cell}</div>
 * }
 * ```
 * @category Hooks
 */
export function useCellValue<T>(cell: CellDefinition<T>) {
  const realm = useRealm()
  realm.register(cell)

  const cb = React.useCallback(
    (c: () => void) => {
      return realm.sub(cell, c)
    },
    [realm, cell]
  )

  return React.useSyncExternalStore(cb, () => realm.getValue(cell))
}

/**
 * @category Hooks
 */
export function useCellValues<T1>(...cells: [CellDefinition<T1>]): [T1]; // prettier-ignore
export function useCellValues<T1, T2>(...cells: [CellDefinition<T1>, CellDefinition<T2>]): [T1, T2]; // prettier-ignore
export function useCellValues<T1, T2, T3>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>]): [T1, T2, T3]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>]): [T1, T2, T3, T4]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>, CellDefinition<T5>]): [T1, T2, T3, T4, T5]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>, CellDefinition<T5>, CellDefinition<T6>]): [T1, T2, T3, T4, T5, T6]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>, CellDefinition<T5>, CellDefinition<T6>, CellDefinition<T7>]): [T1, T2, T3, T4, T5, T6, T7]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>, CellDefinition<T5>, CellDefinition<T6>, CellDefinition<T7>, CellDefinition<T8>]): [T1, T2, T3, T4, T5, T6, T7, T8]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>, CellDefinition<T5>, CellDefinition<T6>, CellDefinition<T7>, CellDefinition<T8>, CellDefinition<T9>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>, CellDefinition<T5>, CellDefinition<T6>, CellDefinition<T7>, CellDefinition<T8>, CellDefinition<T9>, CellDefinition<T10>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>, CellDefinition<T5>, CellDefinition<T6>, CellDefinition<T7>, CellDefinition<T8>, CellDefinition<T9>, CellDefinition<T10>, CellDefinition<T11>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>, CellDefinition<T5>, CellDefinition<T6>, CellDefinition<T7>, CellDefinition<T8>, CellDefinition<T9>, CellDefinition<T10>, CellDefinition<T11>, CellDefinition<T12>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13>(...cells: [CellDefinition<T1>, CellDefinition<T2>, CellDefinition<T3>, CellDefinition<T4>, CellDefinition<T5>, CellDefinition<T6>, CellDefinition<T7>, CellDefinition<T8>, CellDefinition<T9>, CellDefinition<T10>, CellDefinition<T11>, CellDefinition<T12>, CellDefinition<T13>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13]; // prettier-ignore
export function useCellValues(...cells: Array<CellDefinition<unknown>>): unknown[] {
  const realm = useRealm()
  const initial = React.useMemo(
    () => realm.getValues(cells),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const currentRef = React.useRef<unknown[]>(initial)

  const cb = React.useCallback(
    (c: () => void) => {
      const sub = (values: unknown[]) => {
        currentRef.current = values
        c()
      }
      return realm.subMultiple(cells, sub)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [realm, ...cells]
  )
  return React.useSyncExternalStore(cb, () => currentRef.current)
}

/**
 * @category Hooks
 */
export function useSignal<T>(node: CellDefinition<T> | SignalDefinition<T>) {
  const realm = useRealm()
  realm.register(node)
  return React.useCallback(
    (value: T) => {
      realm.pub(node, value)
    },
    [realm, node]
  )
}

/**
 * Returns a tuple of the current value of the cell and a publisher function.
 * The component will be re-rendered when the cell value changes.
 *
 * @remarks If you need just a publisher function, use {@link useSignal}.
 *
 * @param cell - The cell to use.
 * @returns A tuple of the current value of the cell and a publisher function.
 * @category Hooks
 */
export function useCell<T>(cell: CellDefinition<T>) {
  return [useCellValue(cell), useSignal<T>(cell)] as const
}
