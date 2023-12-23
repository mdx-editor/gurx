import { RefCount } from './RefCount'
import { SetMap } from './SetMap'
import { noop, tap } from './utils'

export type LongTuple<K> =
  | []
  | [K]
  | [K, K]
  | [K, K, K]
  | [K, K, K, K]
  | [K, K, K, K, K]
  | [K, K, K, K, K, K]
  | [K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K]
  | [K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface RealmNode<_ = unknown> {
  id: symbol
}

/**
 * A function which determines if two values are equal.
 * Implement custom comparators when the distinctUntilChanged operator needs to work on non-primitive objects.
 * @returns true if values should be considered equal.
 */
export type Comparator<T> = (current: T, next: T) => boolean

export type Distinct<T> = boolean | Comparator<T>

export interface CellDefinition<T> extends RealmNode<T> {
  cellDefinition: true
  distinct: Distinct<T>
  initial: T
  init: (realm: Realm) => void
}

export interface SignalDefinition<T> extends RealmNode<T> {
  signalDefinition: true
  distinct: Distinct<T>
  init: (realm: Realm) => void
}

export type RN<T> = RealmNode<T> | CellDefinition<T> | SignalDefinition<T>

export type Subscription<T> = (value: T) => unknown

export type UnsubscribeHandle = () => void

type ProjectionFunc<T extends unknown[] = unknown[]> = (done: (...values: unknown[]) => void) => (...args: T) => void

export interface RealmProjection<T extends unknown[] = unknown[]> {
  sources: Set<symbol>
  pulls: Set<symbol>
  sink: symbol
  map: ProjectionFunc<T>
}

export interface RealmProjectionSpec<T extends unknown[] = unknown[]> {
  sources: Array<RN<unknown>>
  pulls?: Array<RN<unknown>>
  sink: RN<unknown>
  map: ProjectionFunc<T>
}

type NodesFromValuesRec<T extends unknown[], Acc extends unknown[]> = T extends [infer Head, ...infer Tail]
  ? NodesFromValuesRec<Tail, [...Acc, Head extends unknown ? RealmNode<Head> : never]>
  : Acc

export type NodesFromValues<T extends unknown[]> = T extends unknown[] ? NodesFromValuesRec<T, []> : never

/**
 * A comparator function to determine if two values are equal. Used by distinctUntilChanged  operator.
 */
export function defaultComparator<T>(current: T, next: T) {
  return current === next
}

export type RealmGraph = SetMap<RealmProjection>

export type Operator<I, OP> = (source: RN<I>, realm: Realm) => RealmNode<OP>

export function realm(initialValues: Record<symbol, unknown> = {}) {
  const subscriptions = new SetMap<Subscription<unknown>>()
  const singletonSubscriptions = new Map<symbol, Subscription<unknown>>()
  const graph: RealmGraph = new SetMap()
  const state = new Map<symbol, unknown>()
  for (const id of Object.getOwnPropertySymbols(initialValues)) {
    state.set(id, initialValues[id])
  }
  const distinctNodes = new Map<symbol, Comparator<unknown>>()

  function cellInstance<T>(value: T, distinct: Distinct<T> = false, id = Symbol()): RealmNode<T> {
    if (!state.has(id)) {
      state.set(id, value)
    }

    if (distinct !== false) {
      distinctNodes.set(id, distinct === true ? defaultComparator : (distinct as Comparator<unknown>))
    }
    return { id }
  }

  function signalInstance<T>(distinct: Distinct<T> = false, id = Symbol()): RealmNode<T> {
    if (distinct !== false) {
      distinctNodes.set(id, distinct === true ? defaultComparator : (distinct as Comparator<unknown>))
    }
    return { id }
  }

  function sub<T>(node: RN<T>, subscription: Subscription<T>): UnsubscribeHandle {
    register(node)
    const nodeSubscriptions = subscriptions.getOrCreate(node.id)
    nodeSubscriptions.add(subscription as Subscription<unknown>)
    return () => nodeSubscriptions.delete(subscription as Subscription<unknown>)
  }

  function singletonSub<T>(node: RealmNode<T>, subscription: Subscription<T> | undefined): UnsubscribeHandle {
    register(node)
    const id = node.id
    if (subscription === undefined) {
      singletonSubscriptions.delete(id)
    } else {
      singletonSubscriptions.set(id, subscription as Subscription<unknown>)
    }
    return () => singletonSubscriptions.delete(id)
  }

  function resetSingletonSubs() {
    singletonSubscriptions.clear()
  }

  function subMultiple<T1>(nodes: [RN<T1>], subscription: Subscription<[T1]>): UnsubscribeHandle
  function subMultiple<T1, T2>(nodes: [RN<T1>, RN<T2>], subscription: Subscription<[T1, T2]>): UnsubscribeHandle
  function subMultiple<T1, T2, T3>(nodes: [RN<T1>, RN<T2>, RN<T3>], subscription: Subscription<[T1, T2, T3]>): UnsubscribeHandle
  function subMultiple(nodes: Array<RN<unknown>>, subscription: Subscription<unknown[]>): UnsubscribeHandle
  function subMultiple(nodes: Array<RN<unknown>>, subscription: Subscription<any>): UnsubscribeHandle {
    const sink = signalInstance()
    connect({
      map:
        (done) =>
        (...args) => {
          done(args)
        },
      sink,
      sources: nodes,
    })
    return sub(sink, subscription)
  }

  function calculateExecutionMap(ids: symbol[]) {
    const participatingNodes: symbol[] = []
    const visitedNodes = new Set()
    const pendingPulls = new SetMap<symbol>()
    const refCount = new RefCount()
    const projections = new SetMap<RealmProjection>()

    function visit(id: symbol, insertIndex = 0) {
      refCount.increment(id)

      if (visitedNodes.has(id)) {
        return
      }

      pendingPulls.use(id, (pulls) => {
        insertIndex = Math.max(...Array.from(pulls).map((key) => participatingNodes.indexOf(key))) + 1
      })

      graph.use(id, (sinkProjections) => {
        for (const projection of sinkProjections) {
          if (projection.sources.has(id)) {
            projections.getOrCreate(projection.sink).add(projection)
            visit(projection.sink, insertIndex)
          } else {
            pendingPulls.getOrCreate(projection.sink).add(id)
          }
        }
      })

      visitedNodes.add(id)
      participatingNodes.splice(insertIndex, 0, id)
    }

    ids.forEach(visit)

    return { participatingNodes, pendingPulls, projections, refCount }
  }

  type ExecutionMap = ReturnType<typeof calculateExecutionMap>

  const executionMaps = new Map<symbol | symbol[], ExecutionMap>()

  function getExecutionMap(ids: symbol[]) {
    let key: symbol | symbol[] = ids
    if (ids.length === 1) {
      key = ids[0]
      const existingMap = executionMaps.get(key)
      if (existingMap !== undefined) {
        return existingMap
      }
    } else {
      for (const [key, existingMap] of executionMaps.entries()) {
        if (key instanceof Array && key.length === ids.length && key.every((id) => ids.includes(id))) {
          return existingMap
        }
      }
    }

    const map = calculateExecutionMap(ids)
    executionMaps.set(key, map)
    return map
  }

  function pubIn(values: Record<symbol, unknown>) {
    const ids = Reflect.ownKeys(values) as symbol[]
    const map = getExecutionMap(ids)
    const refCount = map.refCount.clone()
    const participatingNodeKeys = map.participatingNodes.slice()
    const transientState = new Map<symbol, unknown>(state)

    function nodeWillNotEmit(key: symbol) {
      graph.use(key, (projections) => {
        for (const { sources, sink } of projections) {
          if (sources.has(key)) {
            refCount.decrement(sink, () => {
              participatingNodeKeys.splice(participatingNodeKeys.indexOf(sink), 1)
              nodeWillNotEmit(sink)
            })
          }
        }
      })
    }

    while (true) {
      const nextId = participatingNodeKeys.shift()
      if (nextId === undefined) {
        break
      }
      const id = nextId
      let resolved = false
      const done = (value: unknown) => {
        const dnRef = distinctNodes.get(id)
        if (dnRef !== undefined && dnRef(transientState.get(id), value)) {
          resolved = false
          return
        }
        resolved = true
        transientState.set(id, value)
        if (state.has(id)) {
          state.set(id, value)
        }
      }
      if (Object.prototype.hasOwnProperty.call(values, id)) {
        done(values[id])
      } else {
        map.projections.use(id, (nodeProjections) => {
          for (const projection of nodeProjections) {
            const args = [...Array.from(projection.sources), ...Array.from(projection.pulls)].map((id) => transientState.get(id))
            projection.map(done)(...args)
          }
        })
      }

      if (resolved) {
        const value = transientState.get(id)
        subscriptions.use(id, (nodeSubscriptions) => {
          for (const subscription of nodeSubscriptions) {
            subscription(value)
          }
        })
        singletonSubscriptions.get(id)?.(value)
      } else {
        nodeWillNotEmit(id)
      }
    }
  }

  function nodesToKeySet(nodes: RealmNode[]) {
    return new Set(nodes.map((s) => s.id))
  }

  /**
   * A low-level utility that connects multiple nodes to a sink node with a map function.
   * The nodes can be active (sources) or passive (pulls).
   */
  function connect<T extends unknown[] = unknown[]>({ sources, pulls = [], map, sink }: RealmProjectionSpec<T>) {
    const dependency: RealmProjection<T> = {
      map,
      pulls: nodesToKeySet(pulls),
      sink: register(sink).id,
      sources: nodesToKeySet(sources),
    }

    for (const node of [...sources, ...pulls]) {
      register(node)
      graph.getOrCreate(node.id).add(dependency as RealmProjection<unknown[]>)
    }

    executionMaps.clear()
  }

  function pub(node: RN<unknown>): void
  function pub<T1>(...args: [RN<T1>, T1]): void
  function pub<T1, T2>(...args: [RN<T1>, T1, RN<T2>, T2]): void
  function pub<T1, T2, T3>(...args: [RN<T1>, T1, RN<T2>, T2, RN<T3>, T3]): void
  function pub<T1, T2, T3, T4>(...args: [RN<T1>, T1, RN<T2>, T2, RN<T3>, T3, T4]): void
  function pub(...args: unknown[]): void {
    const map: Record<symbol, unknown> = {}
    for (let index = 0; index < args.length; index += 2) {
      const node = args[index] as RN<unknown>
      register(node)
      map[node.id] = args[index + 1]
    }
    pubIn(map)
  }

  type O<I, OP> = Operator<I, OP>

  function combineOperators<T>(...o: []): (s: RN<T>) => RN<T> // prettier-ignore
  function combineOperators<T, O1>(...o: [O<T, O1>]): (s: RN<T>) => RN<O1> // prettier-ignore
  function combineOperators<T, O1, O2>(...o: [O<T, O1>, O<O1, O2>]): (s: RN<T>) => RN<O2> // prettier-ignore
  function combineOperators<T, O1, O2, O3>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>]): (s: RN<T>) => RN<O3> // prettier-ignore
  function combineOperators<T, O1, O2, O3, O4>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>]): (s: RN<T>) => RN<O4> // prettier-ignore
  function combineOperators<T, O1, O2, O3, O4, O5>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>]): (s: RN<T>) => RN<O5> // prettier-ignore
  function combineOperators<T, O1, O2, O3, O4, O5, O6>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>]): (s: RN<T>) => RN<O6> // prettier-ignore
  function combineOperators<T, O1, O2, O3, O4, O5, O6, O7>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>, O<O6, O7>]): (s: RN<T>) => RN<O7> // prettier-ignore
  function combineOperators<T>(...o: Array<O<unknown, unknown>>): (s: RN<T>) => RN<unknown>
  function combineOperators<T>(...o: Array<O<unknown, unknown>>): (s: RN<T>) => RN<unknown> {
    return (source: RN<T>) => {
      for (const op of o) {
        source = op(source, result)
      }
      return source
    }
  }

  function pipe<T> (s: RN<T>): RN<T> // prettier-ignore
  function pipe<T, O1> (s: RN<T>, o1: O<T, O1>): RN<O1> // prettier-ignore
  function pipe<T, O1, O2> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>]): RN<O2> // prettier-ignore
  function pipe<T, O1, O2, O3> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>]): RN<O3> // prettier-ignore
  function pipe<T, O1, O2, O3, O4> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>]): RN<O4> // prettier-ignore
  function pipe<T, O1, O2, O3, O4, O5> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>]): RN<O5> // prettier-ignore
  function pipe<T, O1, O2, O3, O4, O5, O6> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>]): RN<O6> // prettier-ignore
  function pipe<T, O1, O2, O3, O4, O5, O6, O7> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>, O<O6, O7>]): RN<O7> // prettier-ignore
  function pipe<T>(source: RN<T>, ...operators: Array<O<unknown, unknown>>): RealmNode<unknown>
  function pipe<T>(source: RN<T>, ...operators: Array<O<unknown, unknown>>): RealmNode<unknown> {
    return combineOperators(...operators)(source)
  }

  // function sinkTo<T>(s: RN<T>): RN<T>
  function transformer<In>(...o: []): (s: RN<In>) => RN<In> // prettier-ignore
  function transformer<In, Out>(...o: [O<In, Out>]): (s: RN<Out>) => RN<In> // prettier-ignore
  function transformer<In, Out, O1>(...o: [O<In, O1>, O<O1, Out>]): (s: RN<Out>) => RN<In> // prettier-ignore
  function transformer<In, Out, O1, O2>(...o: [O<In, O1>, O<O1, O2>, O<O2, Out>]): (s: RN<Out>) => RN<In> // prettier-ignore
  function transformer<In, Out, O1, O2, O3>(...o: [O<In, O1>, O<O1, O2>, O<O2, O3>, O<O3, Out>]): (s: RN<Out>) => RN<In> // prettier-ignore
  function transformer<In, Out, O1, O2, O3, O4>(...o: [O<In, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, Out>]): (s: RN<Out>) => RN<In> // prettier-ignore
  function transformer<In, Out, O1, O2, O3, O4, O5>(...o: [O<In, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, Out>]): (s: RN<Out>) => RN<In> // prettier-ignore
  function transformer<In, Out>(...operators: Array<O<unknown, unknown>>): (s: RN<Out>) => RN<In> {
    return (sink: RN<In>) => {
      return tap(signalInstance<In>(), (source) => {
        link(pipe(source, ...operators), sink)
        return source
      })
    }
  }

  function spread<T extends LongTuple<unknown>>(source: RN<T>, initialValues: T): NodesFromValues<T> {
    return initialValues.map((initialValue, index) => {
      // the distinct argument is hardcoded,
      // figure out better API
      return tap(cellInstance(initialValue, true), (sink) => {
        connect({
          map: (done) => (sourceValue) => {
            done((sourceValue as T)[index])
          },
          sink,
          sources: [source],
        })
      })
    }) as unknown as NodesFromValues<T>
  }

  /**
   * Links the output of a node to another node.
   */
  function link<T>(source: RN<T>, sink: RN<T>) {
    connect({
      map: (done) => (value) => {
        done(value)
      },
      sink,
      sources: [source],
    })
  }

  /**
   * Constructs a new stateful node from an existing source.
   * The source can be node(s) that get transformed from a set of operators.
   * @example
   * ```tsx
   * const a = r.node(1)
   * const b = r.derive(r.pipe(a, r.o.map((v) => v * 2)), 2)
   * ```
   */
  function derive<T>(source: RN<T>, initial: T) {
    return tap(cellInstance(initial, true), (sink) => {
      connect({
        map: (done) => (value) => {
          done(value)
        },
        sink,
        sources: [source],
      })
    })
  }

  /**
   * Combines the values from multiple nodes into a single node
   * that emits an array of the latest values the nodes.
   * When one of the source nodes emits a value, the combined node
   * emits an array of the latest values from each node.
   * @example
   * ```tsx
   * const a = r.node(1)
   * const b = r.node(2)
   * const ab = r.combine(a, b)
   * r.sub(ab, ([a, b]) => console.log(a, b))
   * r.pub(a, 2)
   * r.pub(b, 3)
   * ```
   */
  function combine<T1> (...nodes: [RN<T1>]): RN<T1> // prettier-ignore
  function combine<T1, T2> (...nodes: [RN<T1>, RN<T2>]): RN<[T1, T2]> // prettier-ignore
  function combine<T1, T2, T3> (...nodes: [RN<T1>, RN<T2>, RN<T3>]): RN<[T1, T2, T3]> // prettier-ignore
  function combine<T1, T2, T3, T4> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>]): RN<[T1, T2, T3, T4]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>]): RN<[T1, T2, T3, T4, T5]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>]): RN<[T1, T2, T3, T4, T5, T6]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6, T7> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>]): RN<[T1, T2, T3, T4, T5, T6, T7]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6, T7, T8> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>]): RN<[T1, T2, T3, T4, T5, T6, T7, T8]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6, T7, T8, T9> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>]): RN<[T1, T2, T3, T4, T5, T6, T7, T8, T9]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>]): RN<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>, RN<T11>]): RN<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>, RN<T11>, RN<T12>, RN<T13>]): RN<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>, RN<T11>, RN<T12>, RN<T13>, RN<T14>]): RN<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>, RN<T11>, RN<T12>, RN<T13>, RN<T14>, RN<T15>]): RN<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15]> // prettier-ignore
  function combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>, RN<T11>, RN<T12>, RN<T13>, RN<T14>, RN<T15>, RN<T16>]): RN<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16]> // prettier-ignore
  function combine(...sources: Array<RN<unknown>>): RN<unknown> {
    return tap(signalInstance(), (sink) => {
      connect({
        map:
          (done) =>
          (...args) => {
            done(args)
          },
        sink,
        sources,
      })
    })
  }

  /**
   * Gets the current value of a node. The node must be stateful.
   * @param node - the node instance.
   */
  function getValue<T>(node: RN<T>): T {
    register(node)
    return state.get(node.id) as T
  }

  /**
   * Gets the current value of a node. The node must be stateful.
   * @param node - the node instance.
   */
  function getValues<T1>(nodes: [RN<T1>]): [T1] // prettier-ignore
  function getValues<T1, T2>(nodes: [RN<T1>, RN<T2>]): [T1, T2] // prettier-ignore
  function getValues<T1, T2, T3>(nodes: [RN<T1>, RN<T2>, RN<T3>]): [T1, T2, T3] // prettier-ignore
  function getValues<T1, T2, T3, T4>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>]): [T1, T2, T3, T4]; // prettier-ignore
  function getValues<T1, T2, T3, T4, T5>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>]): [T1, T2, T3, T4, T5]; // prettier-ignore
  function getValues<T1, T2, T3, T4, T5, T6>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>]): [T1, T2, T3, T4, T5, T6]; // prettier-ignore
  function getValues<T1, T2, T3, T4, T5, T6, T7>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>]): [T1, T2, T3, T4, T5, T6, T7]; // prettier-ignore
  function getValues<T1, T2, T3, T4, T5, T6, T7, T8>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>]): [T1, T2, T3, T4, T5, T6, T7, T8]; // prettier-ignore
  function getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9]; // prettier-ignore
  function getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]; // prettier-ignore
  function getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>, RN<T11>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11]; // prettier-ignore
  function getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>, RN<T11>, RN<T12>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12]; // prettier-ignore
  function getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13>(nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>, RN<T9>, RN<T10>, RN<T11>, RN<T12>, RN<T13>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13]; // prettier-ignore
  function getValues(nodes: Array<RN<unknown>>): unknown[]
  function getValues(nodes: Array<RN<unknown>>): unknown[] {
    return nodes.map((node) => {
      register(node)
      return state.get(node.id)
    })
  }

  const definitionRegistry = new Set<symbol>()

  function registerCell<T>({ id, initial, distinct, init }: CellDefinition<T>): RealmNode<T> {
    if (!definitionRegistry.has(id)) {
      definitionRegistry.add(id)
      init(result)
      return cellInstance(initial, distinct, id)
    }
    return { id }
  }

  function registerSignal<T>({ id, distinct, init }: SignalDefinition<T>): RealmNode<T> {
    if (!definitionRegistry.has(id)) {
      definitionRegistry.add(id)
      init(result)
      return signalInstance(distinct, id)
    }
    return { id }
  }

  function register(node: RN<unknown>) {
    if ('cellDefinition' in node) {
      return registerCell(node)
    } else if ('signalDefinition' in node) {
      return registerSignal(node)
    }

    return node
  }

  function changeWith<T, K>(cell: CellDefinition<T>, source: RN<K>, map: (cellValue: T, signalValue: K) => T) {
    connect({
      sources: [source],
      pulls: [cell],
      sink: cell,
      map: (done) => (signalValue: K, cellValue: T) => {
        done(map(cellValue, signalValue))
      },
    })
  }

  const result = {
    changeWith,
    register,
    registerCell,
    registerSignal,
    combine,
    connect,
    derive,
    getValue,
    getValues,
    link,
    pipe,
    transformer,
    pub,
    pubIn,
    resetSingletonSubs,
    singletonSub,
    spread,
    sub,
    subMultiple,
    signalInstance,
    cellInstance,
  }
  return result
}

export function Cell<T>(value: T, distinct: Distinct<T> = false, init: (r: Realm) => void = noop): CellDefinition<T> {
  const id = Symbol()
  return {
    cellDefinition: true,
    id,
    distinct,
    init,
    initial: value,
  }
}

export function Signal<T>(distinct: Distinct<T> = false, init: (r: Realm) => void = noop): SignalDefinition<T> {
  return {
    signalDefinition: true,
    id: Symbol(),
    distinct,
    init,
  }
}

export function Action(init: (r: Realm) => void = noop): SignalDefinition<void> {
  return {
    signalDefinition: true,
    id: Symbol(),
    distinct: false,
    init,
  }
}

export type Realm = ReturnType<typeof realm>
