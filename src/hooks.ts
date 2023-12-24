import React from 'react'
import { RealmContext } from './react'
import { type NodeRef } from './realm'

/**
 * Returns a direct reference to the current realm. Use with caution.
 *
 * If possible, design your logic in a reactive manner, and use {@link useCellValue} and {@link useSignal} to access the output of the realm.
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
 * Gets the current value of the cell. The component is re-rendered when the cell value changes.
 *
 * @remark If you need the values of multiple nodes from the realm and those nodes might change in the same computiation, you can `useCellValues` to reduce re-renders.
 *
 * @returns The current value of the cell.
 * @typeParam T - the type of the value that the cell caries.
 * @param cell - The cell to use.
 *
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
export function useCellValue<T>(cell: NodeRef<T>) {
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
 * Retreives the values of the passed cells.
 * The component is re-rendered each time any of the referred cells changes its value.
 * @category Hooks
 *
 * @example
 * ```tsx
 * const foo$ = Cell('foo')
 * const bar$ = Cell('bar')
 * //...
 * function MyComponent() {
 *   const [foo, bar] = useCellValues(foo$, bar$)
 *   return <div>{foo} - {bar}</div>
 * }
 * ```
 */
export function useCellValues<T1>(...cells: [NodeRef<T1>]): [T1]; // prettier-ignore
export function useCellValues<T1, T2>(...cells: [NodeRef<T1>, NodeRef<T2>]): [T1, T2]; // prettier-ignore
export function useCellValues<T1, T2, T3>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>]): [T1, T2, T3]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>]): [T1, T2, T3, T4]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>]): [T1, T2, T3, T4, T5]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>]): [T1, T2, T3, T4, T5, T6]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>]): [T1, T2, T3, T4, T5, T6, T7]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>]): [T1, T2, T3, T4, T5, T6, T7, T8]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>, NodeRef<T12>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12]; // prettier-ignore
export function useCellValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13>(...cells: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>, NodeRef<T12>, NodeRef<T13>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13]; // prettier-ignore
export function useCellValues(...cells: Array<NodeRef<unknown>>): unknown[] {
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
 * Returns a function that publishes its passed argument into the specified node.
 * @example
 * ```tsx
 * const signal$ = Signal<number>(true, (r) => {
 *  r.sub(signal$, (value) => console.log(`${value} was published in the signal`))
 * })
 * //...
 * function MyComponent() {
 *  const publishIntoSignal = useSignal(signal$);
 *  return <button onClick={() => publishIntoSignal(2)}>Push a value into the signal</button>
 * }
 * ```
 * @category Hooks
 */
export function useSignal<T>(node: NodeRef<T>) {
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
 * Returns a tuple of the current value of the cell and a publisher function (similar to useState).
 * The component will be re-rendered when the cell value changes.
 *
 * @remarks If you need just a publisher function, use {@link useSignal}.
 *
 * @param cell - The cell to use.
 * @returns A tuple of the current value of the cell and a publisher function.
 * @category Hooks
 */
export function useCell<T>(cell: NodeRef<T>) {
  return [useCellValue(cell), useSignal<T>(cell)] as const
}
