import { RefCount } from './RefCount'
import { SetMap } from './SetMap'
import { tap } from './utils'

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
  toString: () => symbol
}

export interface SignalDefinition<T> extends RealmNode<T> {
  signalDefinition: true
  distinct: Distinct<T>
}

type RN<T> = RealmNode<T> | CellDefinition<T> | SignalDefinition<T>

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

const NO_VALUE = Symbol('NO_VALUE')

export function realm() {
  const subscriptions = new SetMap<Subscription<unknown>>()
  const singletonSubscriptions = new Map<symbol, Subscription<unknown>>()
  const graph: RealmGraph = new SetMap()
  const state = new Map<symbol, unknown>()
  const distinctNodes = new Map<symbol, Comparator<unknown>>()

  function cellInstance<T>(value: T, distinct: Distinct<T> = false, id = Symbol()): RealmNode<T> {
    state.set(id, value)

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
    return () => nodeSubscriptions.add(subscription as Subscription<unknown>)
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

  function subMultiple<T1>(...args: [RN<T1>, Subscription<T1>]): UnsubscribeHandle
  function subMultiple<T1, T2>(...args: [RN<T1>, RN<T2>, Subscription<[T1, T2]>]): UnsubscribeHandle
  function subMultiple<T1, T2, T3>(...args: [RN<T1>, RN<T2>, RN<T3>, Subscription<[T1, T2, T3]>]): UnsubscribeHandle
  function subMultiple(...args: unknown[]): UnsubscribeHandle {
    const [subscription] = args.slice(-1) as Array<Subscription<unknown>>
    const sources = args.slice(0, -1) as Array<RN<unknown>>
    const sink = signalInstance()
    connect({
      map:
        (done) =>
        (...args) => {
          done(args)
        },
      sink,
      sources,
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
        sinkProjections.forEach((projection) => {
          if (projection.sources.has(id)) {
            projections.getOrCreate(projection.sink).add(projection)
            visit(projection.sink, insertIndex)
          } else {
            pendingPulls.getOrCreate(projection.sink).add(id)
          }
        })
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
        projections.forEach(({ sources, sink }) => {
          if (sources.has(key)) {
            refCount.decrement(sink, () => {
              participatingNodeKeys.splice(participatingNodeKeys.indexOf(sink), 1)
              nodeWillNotEmit(sink)
            })
          }
        })
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
          nodeProjections.forEach((projection) => {
            const args = [...Array.from(projection.sources), ...Array.from(projection.pulls)].map((id) => transientState.get(id))
            projection.map(done)(...args)
          })
        })
      }

      if (resolved) {
        const value = transientState.get(id)
        subscriptions.use(id, (nodeSubscriptions) => {
          nodeSubscriptions.forEach((subscription) => subscription(value))
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
  function connect<T extends unknown[] = unknown[]>({ sources, pulls = [], map, sink: { id: sink } }: RealmProjectionSpec<T>) {
    const dependency: RealmProjection<T> = {
      map,
      pulls: nodesToKeySet(pulls),
      sink,
      sources: nodesToKeySet(sources),
    }

    ;[...sources, ...pulls].forEach((node) => {
      register(node)
      graph.getOrCreate(node.id).add(dependency as RealmProjection<unknown[]>)
    })
    executionMaps.clear()
  }

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

  type Operator<I, OP> = (source: RealmNode<I>) => RealmNode<OP>

  type O<I, OP> = Operator<I, OP>

  function pipe<T> (s: RN<T>): RN<T> // prettier-ignore
  function pipe<T, O1> (s: RN<T>, o1: O<T, O1>): RN<O1> // prettier-ignore
  function pipe<T, O1, O2> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>]): RN<O2> // prettier-ignore
  function pipe<T, O1, O2, O3> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>]): RN<O3> // prettier-ignore
  function pipe<T, O1, O2, O3, O4> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>]): RN<O4> // prettier-ignore
  function pipe<T, O1, O2, O3, O4, O5> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>]): RN<O5> // prettier-ignore
  function pipe<T, O1, O2, O3, O4, O5, O6> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>]): RN<O6> // prettier-ignore
  function pipe<T, O1, O2, O3, O4, O5, O6, O7> (s: RN<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>, O<O6, O7>]): RN<O7> // prettier-ignore
  function pipe<T>(source: RN<T>, ...operators: Array<O<unknown, unknown>>): RealmNode<unknown> {
    for (const operator of operators) {
      source = operator(source)
    }
    return source
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
  function link<T>(source: RealmNode<T>, sink: RealmNode<T>) {
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
  function derive<T>(source: RealmNode<T>, initial: T) {
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
   * Operator that maps a the value of a node to a new node with a projection function.
   */
  function map<I, O>(mapFunction: (value: I) => O) {
    return ((source: RealmNode<I>) => {
      const sink = signalInstance<O>()
      connect({
        map: (done) => (value) => {
          done(mapFunction(value as I))
        },
        sink,
        sources: [source],
      })
      return sink
    }) as Operator<I, O>
  }

  /**
   * Operator that maps the output of a node to a fixed value.
   */
  function mapTo<I, O>(value: O) {
    return ((source: RealmNode<I>) => {
      const sink = signalInstance<O>()
      connect({
        map: (done) => () => {
          done(value)
        },
        sink,
        sources: [source],
      })
      return sink
    }) as Operator<I, O>
  }

  /**
   * Operator that filters the output of a node.
   * If the predicate returns false, the emission is canceled.
   */
  function filter<I, O = I>(predicate: (value: I) => boolean) {
    return ((source: RealmNode<I>) => {
      const sink = signalInstance<O>()
      connect({
        map: (done) => (value) => {
          predicate(value as I) && done(value)
        },
        sink,
        sources: [source],
      })
      return sink
    }) as Operator<I, O>
  }

  /**
   * Operator that captures the first emitted value of a node.
   * Useful if you want to execute a side effect only once.
   */
  function once<I>() {
    return ((source: RealmNode<I>) => {
      const sink = signalInstance<I>()

      let passed = false
      connect({
        map: (done) => (value) => {
          if (!passed) {
            passed = true
            done(value)
          }
        },
        sink,
        sources: [source],
      })
      return sink
    }) as Operator<I, I>
  }

  /**
   * Operator that runs with the latest and the current value of a node.
   * Works like the {@link https://rxjs.dev/api/operators/scan | RxJS scan operator}.
   */
  function scan<I, O>(accumulator: (current: O, value: I) => O, seed: O) {
    return ((source: RealmNode<I>) => {
      const sink = signalInstance<O>()
      connect({
        map: (done) => (value) => {
          done((seed = accumulator(seed, value as I)))
        },
        sink,
        sources: [source],
      })
      return sink
    }) as Operator<I, O>
  }

  /**
   * Throttles the output of a node with the specified delay.
   */
  function throttleTime<I>(delay: number) {
    return ((source: RealmNode<I>) => {
      const sink = signalInstance<I>()
      let currentValue: I | undefined
      let timeout: ReturnType<typeof setTimeout> | undefined

      sub(source, (value) => {
        currentValue = value

        if (timeout === undefined) {
          return
        }

        timeout = setTimeout(() => {
          timeout = undefined
          pub(sink, currentValue)
        }, delay)
      })

      return sink
    }) as Operator<I, I>
  }

  /**
   * Delays the output of a node with `queueMicrotask`.
   */
  function delayWithMicrotask<I>() {
    return ((source: RealmNode<I>) => {
      const sink = signalInstance<I>()
      sub(source, (value) => {
        queueMicrotask(() => {
          pub(sink, value)
        })
      })
      return sink
    }) as Operator<I, I>
  }

  /**
   * Debounces the output of a node with the specified delay.
   */
  function debounceTime<I>(delay: number) {
    return ((source: RealmNode<I>) => {
      const sink = signalInstance<I>()
      let currentValue: I | undefined
      let timeout: ReturnType<typeof setTimeout> | undefined

      sub(source, (value) => {
        currentValue = value

        if (timeout === undefined) {
          clearTimeout(timeout)
        }

        timeout = setTimeout(() => {
          pub(sink, currentValue)
        }, delay)
      })

      return sink
    }) as Operator<I, I>
  }

  /**
   * Buffers the stream of a node until the passed note emits.
   */
  function onNext<I, O>(bufNode: RN<O>) {
    return ((source: RealmNode<I>) => {
      const sink = signalInstance<O>()
      let pendingValue: I | typeof NO_VALUE = NO_VALUE
      sub(source, (value) => (pendingValue = value))
      connect({
        map: (done) => (value) => {
          if (pendingValue !== NO_VALUE) {
            done([pendingValue, value])
            pendingValue = NO_VALUE
          }
        },
        sink,
        sources: [bufNode],
      })
      return sink
    }) as Operator<I, [I, O]>
  }

  /**
   * Conditionally passes the stream of a node only if the passed note
   * has emitted before a certain duration (in seconds).
   */
  function passOnlyAfterNodeHasEmittedBefore<I>(starterNode: RN<unknown>, durationNode: RN<number>) {
    return (source: RealmNode<I>) => {
      const sink = signalInstance<I>()
      let startTime = 0
      sub(starterNode, () => (startTime = Date.now()))
      connect({
        map: (done) => (value) => {
          if (Date.now() < startTime + (state.get(durationNode.id) as number)) {
            done(value)
          }
        },
        sink,
        sources: [source],
      })
      return sink
    }
  }

  /**
   * Pulls the latest values from the passed nodes.
   * Note: The operator does not emit when the nodes emit. If you want to get that, use the `combine` function.
   */
  function withLatestFrom<I, T1> (...nodes: [RN<T1>]): (source: RN<I>) => RN<[I, T1]> // prettier-ignore
  function withLatestFrom<I, T1, T2> (...nodes: [RN<T1>, RN<T2>]): (source: RN<I>) => RN<[I, T1, T2]> // prettier-ignore
  function withLatestFrom<I, T1, T2, T3> (...nodes: [RN<T1>, RN<T2>, RN<T3>]): (source: RN<I>) => RN<[I, T1, T2, T3]> // prettier-ignore
  function withLatestFrom<I, T1, T2, T3, T4> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4]> // prettier-ignore
  function withLatestFrom<I, T1, T2, T3, T4, T5> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4, T5]> // prettier-ignore
  function withLatestFrom<I, T1, T2, T3, T4, T5, T6> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4, T5, T6]> // prettier-ignore
  function withLatestFrom<I, T1, T2, T3, T4, T5, T6, T7> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4, T5, T6, T7]> // prettier-ignore
  function withLatestFrom<I, T1, T2, T3, T4, T5, T6, T7, T8> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4, T5, T6, T7, T8]> // prettier-ignore
  function withLatestFrom<I>(...nodes: Array<RN<unknown>>) {
    return (source: RN<I>) => {
      const sink = signalInstance()
      connect({
        map:
          (done) =>
          (...args) => {
            done(args)
          },
        pulls: nodes,
        sink,
        sources: [source],
      })
      return sink
    }
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

  const definitionRegistry = new Set<symbol>()

  function registerCell<T>({ id, initial, distinct }: CellDefinition<T>): RealmNode<T> {
    if (!definitionRegistry.has(id)) {
      definitionRegistry.add(id)
      return cellInstance(initial, distinct, id)
    }
    return { id }
  }

  function registerSignal<T>({ id, distinct }: SignalDefinition<T>): RealmNode<T> {
    if (!definitionRegistry.has(id)) {
      definitionRegistry.add(id)
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

  return {
    registerCell,
    registerSignal,
    combine,
    connect,
    derive,
    getValue,
    link,
    delayWithMicrotask,
    debounceTime,
    filter,
    map,
    mapTo,
    onNext,
    scan,
    throttleTime,
    withLatestFrom,
    once,
    passOnlyAfterNodeHasEmittedBefore,
    pipe,
    pub,
    resetSingletonSubs,
    singletonSub,
    spread,
    sub,
    subMultiple,
  }
}

export function Cell<T>(value: T, distinct: Distinct<T> = false): CellDefinition<T> {
  const id = Symbol()
  return {
    cellDefinition: true,
    id,
    distinct,
    initial: value,
    toString: () => id,
  }
}

export function Signal<T>(distinct: Distinct<T> = false): SignalDefinition<T> {
  return {
    signalDefinition: true,
    id: Symbol(),
    distinct,
  }
}

export type Realm = ReturnType<typeof realm>
