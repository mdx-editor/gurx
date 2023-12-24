import { RefCount } from './RefCount'
import { SetMap } from './SetMap'
import { type O } from './operators'
import { tap, noop } from './utils'

/**
 * Represents a typed reference to a node.
 * @typeParam T - The type of values that the node emits.
 * @category Nodes
 */
export type NodeRef<T = unknown> = symbol & { valType: T }

/**
 * A function that is called when a node emits a value.
 * @typeParam T - The type of values that the node emits.
 */
export type Subscription<T> = (value: T) => unknown

/**
 * The resulting type of a subscription to a node. Can be used to cancel the subscription.
 */
export type UnsubscribeHandle = () => void

export type ProjectionFunc<T extends unknown[] = unknown[]> = (done: (...values: unknown[]) => void) => (...args: T) => void

interface RealmProjection<T extends unknown[] = unknown[]> {
  sources: Set<symbol>
  pulls: Set<symbol>
  sink: symbol
  map: ProjectionFunc<T>
}

/**
 * A comparator function to determine if two values are equal, Works for primitive values.
 * The default comparator for distinct nodes.
 * @category Nodes
 */
export function defaultComparator<T>(current: T, next: T) {
  return current === next
}

interface ExecutionMap {
  participatingNodes: symbol[]
  pendingPulls: SetMap<symbol>
  projections: SetMap<RealmProjection>
  refCount: RefCount
}

/**
 * A function which determines if two values are equal.
 * Implement custom comparators for distinct nodes that contain non-primitive values.
 * @param previous - The value that previously passed through the node. can be undefined if the node has not emitted a value yet.
 * @param current - The value currently passing.
 * @typeParam T - The type of values that the comparator compares.
 * @returns true if values should be considered equal.
 * @category Nodes
 */
export type Comparator<T> = (previous: T | undefined, current: T) => boolean

/**
 * A type for the distinct parameter to the {@link Cell} and {@link Signal} constructors.
 * @typeParam T - The type of values that the node emits.
 * @category Nodes
 */
export type Distinct<T> = boolean | Comparator<T>

interface CellDefinition<T> {
  type: 'cell'
  distinct: Distinct<T>
  initial: T
  init: (realm: Realm) => void
}

interface SignalDefinition<T> {
  type: 'signal'
  distinct: Distinct<T>
  init: (realm: Realm) => void
}

const nodeDefs$$ = new Map<symbol, CellDefinition<any> | SignalDefinition<any>>()

/**
 * A realm is a directed acyclic graph of nodes.
 * The realm is responsible for initializing cells and signals based on their definitions.
 * The actual node state is stored in the realm.
 */
export class Realm {
  private readonly subscriptions = new SetMap<Subscription<unknown>>()
  private readonly singletonSubscriptions = new Map<symbol, Subscription<unknown>>()
  private readonly graph = new SetMap<RealmProjection>()
  private readonly state = new Map<symbol, unknown>()
  private readonly distinctNodes = new Map<symbol, Comparator<unknown>>()
  private readonly executionMaps = new Map<symbol | symbol[], ExecutionMap>()
  private readonly definitionRegistry = new Set<symbol>()

  constructor(initialValues: Record<symbol, unknown> = {}) {
    for (const id of Object.getOwnPropertySymbols(initialValues)) {
      this.state.set(id, initialValues[id])
    }
  }

  private cellInstance<T>(value: T, distinct: Distinct<T> = false, node = Symbol()): NodeRef<T> {
    if (!this.state.has(node)) {
      this.state.set(node, value)
    }

    if (distinct !== false) {
      this.distinctNodes.set(node, distinct === true ? defaultComparator : (distinct as Comparator<unknown>))
    }
    return node as NodeRef<T>
  }

  signalInstance<T>(distinct: Distinct<T> = false, node = Symbol()): NodeRef<T> {
    if (distinct !== false) {
      this.distinctNodes.set(node, distinct === true ? defaultComparator : (distinct as Comparator<unknown>))
    }
    return node as NodeRef<T>
  }

  sub<T>(node: NodeRef<T>, subscription: Subscription<T>): UnsubscribeHandle {
    this.register(node)
    const nodeSubscriptions = this.subscriptions.getOrCreate(node)
    nodeSubscriptions.add(subscription as Subscription<unknown>)
    return () => nodeSubscriptions.delete(subscription as Subscription<unknown>)
  }

  singletonSub<T>(node: NodeRef<T>, subscription: Subscription<T> | undefined): UnsubscribeHandle {
    this.register(node)
    if (subscription === undefined) {
      this.singletonSubscriptions.delete(node)
    } else {
      this.singletonSubscriptions.set(node, subscription as Subscription<unknown>)
    }
    return () => this.singletonSubscriptions.delete(node)
  }

  resetSingletonSubs = () => {
    this.singletonSubscriptions.clear()
  }

  subMultiple<T1>(nodes: [NodeRef<T1>], subscription: Subscription<[T1]>): UnsubscribeHandle
  subMultiple<T1, T2>(nodes: [NodeRef<T1>, NodeRef<T2>], subscription: Subscription<[T1, T2]>): UnsubscribeHandle
  subMultiple<T1, T2, T3>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>], subscription: Subscription<[T1, T2, T3]>): UnsubscribeHandle
  subMultiple(nodes: Array<NodeRef<unknown>>, subscription: Subscription<any>): UnsubscribeHandle
  subMultiple(nodes: Array<NodeRef<unknown>>, subscription: Subscription<any>): UnsubscribeHandle {
    const sink = this.signalInstance()
    this.connect({
      map:
        (done) =>
        (...args) => {
          done(args)
        },
      sink,
      sources: nodes,
    })
    return this.sub(sink, subscription)
  }

  private calculateExecutionMap(ids: symbol[]) {
    const participatingNodes: symbol[] = []
    const visitedNodes = new Set()
    const pendingPulls = new SetMap<symbol>()
    const refCount = new RefCount()
    const projections = new SetMap<RealmProjection>()

    const visit = (id: symbol, insertIndex = 0) => {
      refCount.increment(id)

      if (visitedNodes.has(id)) {
        return
      }

      pendingPulls.use(id, (pulls) => {
        insertIndex = Math.max(...Array.from(pulls).map((key) => participatingNodes.indexOf(key))) + 1
      })

      this.graph.use(id, (sinkProjections) => {
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

  private getExecutionMap(ids: symbol[]) {
    let key: symbol | symbol[] = ids
    if (ids.length === 1) {
      key = ids[0]
      const existingMap = this.executionMaps.get(key)
      if (existingMap !== undefined) {
        return existingMap
      }
    } else {
      for (const [key, existingMap] of this.executionMaps.entries()) {
        if (key instanceof Array && key.length === ids.length && key.every((id) => ids.includes(id))) {
          return existingMap
        }
      }
    }

    const map = this.calculateExecutionMap(ids)
    this.executionMaps.set(key, map)
    return map
  }

  pubIn(values: Record<symbol, unknown>) {
    const ids = Reflect.ownKeys(values) as symbol[]
    const map = this.getExecutionMap(ids)
    const refCount = map.refCount.clone()
    const participatingNodeKeys = map.participatingNodes.slice()
    const transientState = new Map<symbol, unknown>(this.state)

    const nodeWillNotEmit = (key: symbol) => {
      this.graph.use(key, (projections) => {
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
        const dnRef = this.distinctNodes.get(id)
        if (dnRef !== undefined && dnRef(transientState.get(id), value)) {
          resolved = false
          return
        }
        resolved = true
        transientState.set(id, value)
        if (this.state.has(id)) {
          this.state.set(id, value)
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
        this.subscriptions.use(id, (nodeSubscriptions) => {
          for (const subscription of nodeSubscriptions) {
            subscription(value)
          }
        })
        this.singletonSubscriptions.get(id)?.(value)
      } else {
        nodeWillNotEmit(id)
      }
    }
  }

  /**
   * A low-level utility that connects multiple nodes to a sink node with a map function.
   * The nodes can be active (sources) or passive (pulls).
   */
  connect<T extends unknown[] = unknown[]>({
    sources,
    pulls = [],
    map,
    sink,
  }: {
    /**
     * The source nodes that emit values to the sink node. The values will be passed as arguments to the map function.
     */
    sources: Array<NodeRef<unknown>>
    /**
     * The nodes which values will be pulled. The values will be passed as arguments to the map function.
     */
    pulls?: Array<NodeRef<unknown>>
    /**
     * The sink node that will receive the result of the map function.
     */
    sink: NodeRef<unknown>
    /**
     * The projection function that will be called when any of the source nodes emits.
     */
    map: ProjectionFunc<T>
  }) {
    const dependency: RealmProjection<T> = {
      map,
      pulls: new Set(pulls),
      sink: this.register(sink),
      sources: new Set(sources),
    }

    for (const node of [...sources, ...pulls]) {
      this.register(node)
      this.graph.getOrCreate(node).add(dependency as RealmProjection<unknown[]>)
    }

    this.executionMaps.clear()
  }

  pub(node: NodeRef<unknown>): void
  pub<T1>(...args: [NodeRef<T1>, T1]): void
  pub<T1, T2>(...args: [NodeRef<T1>, T1, NodeRef<T2>, T2]): void
  pub<T1, T2, T3>(...args: [NodeRef<T1>, T1, NodeRef<T2>, T2, NodeRef<T3>, T3]): void
  pub<T1, T2, T3, T4>(...args: [NodeRef<T1>, T1, NodeRef<T2>, T2, NodeRef<T3>, T3, T4]): void
  pub(...args: unknown[]): void
  pub(...args: unknown[]) {
    const map: Record<symbol, unknown> = {}
    for (let index = 0; index < args.length; index += 2) {
      const node = args[index] as NodeRef<unknown>
      this.register(node)
      map[node] = args[index + 1]
    }
    this.pubIn(map)
  }

  private combineOperators<T>(...o: []): (s: NodeRef<T>) => NodeRef<T> // prettier-ignore
  private combineOperators<T, O1>(...o: [O<T, O1>]): (s: NodeRef<T>) => NodeRef<O1> // prettier-ignore
  private combineOperators<T, O1, O2>(...o: [O<T, O1>, O<O1, O2>]): (s: NodeRef<T>) => NodeRef<O2> // prettier-ignore
  private combineOperators<T, O1, O2, O3>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>]): (s: NodeRef<T>) => NodeRef<O3> // prettier-ignore
  private combineOperators<T, O1, O2, O3, O4>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>]): (s: NodeRef<T>) => NodeRef<O4> // prettier-ignore
  private combineOperators<T, O1, O2, O3, O4, O5>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>]): (s: NodeRef<T>) => NodeRef<O5> // prettier-ignore
  private combineOperators<T, O1, O2, O3, O4, O5, O6>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>]): (s: NodeRef<T>) => NodeRef<O6> // prettier-ignore
  private combineOperators<T, O1, O2, O3, O4, O5, O6, O7>(...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>, O<O6, O7>]): (s: NodeRef<T>) => NodeRef<O7> // prettier-ignore
  private combineOperators<T>(...o: Array<O<unknown, unknown>>): (s: NodeRef<T>) => NodeRef<unknown>
  private combineOperators<T>(...o: Array<O<unknown, unknown>>): (s: NodeRef<T>) => NodeRef<unknown> {
    return (source: NodeRef<unknown>) => {
      for (const op of o) {
        source = op(source, this)
      }
      return source
    }
  }

  pipe<T> (s: NodeRef<T>): NodeRef<T> // prettier-ignore
  pipe<T, O1> (s: NodeRef<T>, o1: O<T, O1>): NodeRef<O1> // prettier-ignore
  pipe<T, O1, O2> (s: NodeRef<T>, ...o: [O<T, O1>, O<O1, O2>]): NodeRef<O2> // prettier-ignore
  pipe<T, O1, O2, O3> (s: NodeRef<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>]): NodeRef<O3> // prettier-ignore
  pipe<T, O1, O2, O3, O4> (s: NodeRef<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>]): NodeRef<O4> // prettier-ignore
  pipe<T, O1, O2, O3, O4, O5> (s: NodeRef<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>]): NodeRef<O5> // prettier-ignore
  pipe<T, O1, O2, O3, O4, O5, O6> (s: NodeRef<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>]): NodeRef<O6> // prettier-ignore
  pipe<T, O1, O2, O3, O4, O5, O6, O7> (s: NodeRef<T>, ...o: [O<T, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, O6>, O<O6, O7>]): NodeRef<O7> // prettier-ignore
  pipe<T>(source: NodeRef<T>, ...operators: Array<O<unknown, unknown>>): NodeRef<unknown>
  pipe<T>(source: NodeRef<T>, ...operators: Array<O<unknown, unknown>>): NodeRef<unknown> {
    return this.combineOperators(...operators)(source)
  }

  transformer<In>(...o: []): (s: NodeRef<In>) => NodeRef<In> // prettier-ignore
  transformer<In, Out>(...o: [O<In, Out>]): (s: NodeRef<Out>) => NodeRef<In> // prettier-ignore
  transformer<In, Out, O1>(...o: [O<In, O1>, O<O1, Out>]): (s: NodeRef<Out>) => NodeRef<In> // prettier-ignore
  transformer<In, Out, O1, O2>(...o: [O<In, O1>, O<O1, O2>, O<O2, Out>]): (s: NodeRef<Out>) => NodeRef<In> // prettier-ignore
  transformer<In, Out, O1, O2, O3>(...o: [O<In, O1>, O<O1, O2>, O<O2, O3>, O<O3, Out>]): (s: NodeRef<Out>) => NodeRef<In> // prettier-ignore
  transformer<In, Out, O1, O2, O3, O4>(...o: [O<In, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, Out>]): (s: NodeRef<Out>) => NodeRef<In> // prettier-ignore
  transformer<In, Out, O1, O2, O3, O4, O5>(...o: [O<In, O1>, O<O1, O2>, O<O2, O3>, O<O3, O4>, O<O4, O5>, O<O5, Out>]): (s: NodeRef<Out>) => NodeRef<In> // prettier-ignore
  transformer<In, Out>(...operators: Array<O<unknown, unknown>>): (s: NodeRef<Out>) => NodeRef<In>
  transformer<In, Out>(...operators: Array<O<unknown, unknown>>): (s: NodeRef<Out>) => NodeRef<In> {
    return (sink: NodeRef<Out>) => {
      return tap(this.signalInstance<In>(), (source) => {
        this.link(this.pipe(source, ...operators), sink)
        return source
      })
    }
  }

  /**
   * Links the output of a node to another node.
   */
  link<T>(source: NodeRef<T>, sink: NodeRef<T>) {
    this.connect({
      map: (done) => (value) => {
        done(value)
      },
      sink,
      sources: [source],
    })
  }

  /**
   * Combines the values from multiple nodes into a single node
   * that emits an array of the latest values the nodes.
   * When one of the source nodes emits a value, the combined node
   * emits an array of the latest values from each node.
   */
  combine<T1> (...nodes: [NodeRef<T1>]): NodeRef<T1> // prettier-ignore
  combine<T1, T2> (...nodes: [NodeRef<T1>, NodeRef<T2>]): NodeRef<[T1, T2]> // prettier-ignore
  combine<T1, T2, T3> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>]): NodeRef<[T1, T2, T3]> // prettier-ignore
  combine<T1, T2, T3, T4> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>]): NodeRef<[T1, T2, T3, T4]> // prettier-ignore
  combine<T1, T2, T3, T4, T5> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>]): NodeRef<[T1, T2, T3, T4, T5]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>]): NodeRef<[T1, T2, T3, T4, T5, T6]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6, T7> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>]): NodeRef<[T1, T2, T3, T4, T5, T6, T7]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6, T7, T8> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>]): NodeRef<[T1, T2, T3, T4, T5, T6, T7, T8]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6, T7, T8, T9> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>]): NodeRef<[T1, T2, T3, T4, T5, T6, T7, T8, T9]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>]): NodeRef<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>]): NodeRef<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>, NodeRef<T12>, NodeRef<T13>]): NodeRef<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>, NodeRef<T12>, NodeRef<T13>, NodeRef<T14>]): NodeRef<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>, NodeRef<T12>, NodeRef<T13>, NodeRef<T14>, NodeRef<T15>]): NodeRef<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15]> // prettier-ignore
  combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16> (...nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>, NodeRef<T12>, NodeRef<T13>, NodeRef<T14>, NodeRef<T15>, NodeRef<T16>]): NodeRef<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16]> // prettier-ignore
  combine(...sources: Array<NodeRef<unknown>>): NodeRef<unknown> {
    return tap(this.signalInstance(), (sink) => {
      this.connect({
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
  getValue<T>(node: NodeRef<T>): T {
    this.register(node)
    return this.state.get(node) as T
  }

  getValues<T1>(nodes: [NodeRef<T1>]): [T1] // prettier-ignore
  getValues<T1, T2>(nodes: [NodeRef<T1>, NodeRef<T2>]): [T1, T2] // prettier-ignore
  getValues<T1, T2, T3>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>]): [T1, T2, T3] // prettier-ignore
  getValues<T1, T2, T3, T4>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>]): [T1, T2, T3, T4]; // prettier-ignore
  getValues<T1, T2, T3, T4, T5>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>]): [T1, T2, T3, T4, T5]; // prettier-ignore
  getValues<T1, T2, T3, T4, T5, T6>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>]): [T1, T2, T3, T4, T5, T6]; // prettier-ignore
  getValues<T1, T2, T3, T4, T5, T6, T7>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>]): [T1, T2, T3, T4, T5, T6, T7]; // prettier-ignore
  getValues<T1, T2, T3, T4, T5, T6, T7, T8>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>]): [T1, T2, T3, T4, T5, T6, T7, T8]; // prettier-ignore
  getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9]; // prettier-ignore
  getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]; // prettier-ignore
  getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11]; // prettier-ignore
  getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>, NodeRef<T12>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12]; // prettier-ignore
  getValues<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13>(nodes: [NodeRef<T1>, NodeRef<T2>, NodeRef<T3>, NodeRef<T4>, NodeRef<T5>, NodeRef<T6>, NodeRef<T7>, NodeRef<T8>, NodeRef<T9>, NodeRef<T10>, NodeRef<T11>, NodeRef<T12>, NodeRef<T13>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13]; // prettier-ignore
  getValues<T>(nodes: Array<NodeRef<T>>): unknown[]
  getValues(nodes: Array<NodeRef<unknown>>) {
    return nodes.map((node) => {
      this.register(node)
      return this.state.get(node)
    })
  }

  register(node: NodeRef<unknown>) {
    const definition = nodeDefs$$.get(node)
    // anonymous node
    if (definition === undefined) {
      return node
    }

    if (!this.definitionRegistry.has(node)) {
      this.definitionRegistry.add(node)
      definition.init(this)
      if (definition.type === 'cell') {
        return this.cellInstance(definition.initial, definition.distinct, node)
      } else {
        return this.signalInstance(definition.distinct, node)
      }
    } else {
      return node
    }
  }

  changeWith<T, K>(cell: NodeRef<T>, source: NodeRef<K>, map: (cellValue: T, signalValue: K) => T) {
    this.connect({
      sources: [source],
      pulls: [cell],
      sink: cell,
      map: (done) => (signalValue: K, cellValue: T) => {
        done(map(cellValue, signalValue))
      },
    })
  }
}

/**
 * @category Nodes
 */
export function Cell<T>(value: T, distinct: Distinct<T> = false, init: (r: Realm) => void = noop): NodeRef<T> {
  return tap(Symbol(), (id) => {
    nodeDefs$$.set(id, { type: 'cell', distinct, initial: value, init })
  }) as NodeRef<T>
}

/**
 * @category Nodes
 */
export function Signal<T>(distinct: Distinct<T> = false, init: (r: Realm) => void = noop): NodeRef<T> {
  return tap(Symbol(), (id) => {
    nodeDefs$$.set(id, { type: 'signal', distinct, init })
  }) as NodeRef<T>
}

/**
 * @category Nodes
 */
export function Action(init: (r: Realm) => void = noop): NodeRef<void> {
  return tap(Symbol(), (id) => {
    nodeDefs$$.set(id, { type: 'signal', distinct: false, init })
  }) as NodeRef<void>
}
