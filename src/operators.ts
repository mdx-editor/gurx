import { type Operator, type RN } from './realm'

/**
 * Maps a the value of a node to a new node with a projection function.
 */
export function map<I, O>(mapFunction: (value: I) => O) {
  return ((source, { connect, signalInstance }) => {
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
 * Pulls the latest values from the passed nodes.
 * Note: The operator does not emit when the nodes emit. If you want to get that, use the `combine` function.
 */
export  function withLatestFrom<I, T1> (...nodes: [RN<T1>]): (source: RN<I>) => RN<[I, T1]> // prettier-ignore
export  function withLatestFrom<I, T1, T2> (...nodes: [RN<T1>, RN<T2>]): (source: RN<I>) => RN<[I, T1, T2]> // prettier-ignore
export  function withLatestFrom<I, T1, T2, T3> (...nodes: [RN<T1>, RN<T2>, RN<T3>]): (source: RN<I>) => RN<[I, T1, T2, T3]> // prettier-ignore
export  function withLatestFrom<I, T1, T2, T3, T4> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4]> // prettier-ignore
export  function withLatestFrom<I, T1, T2, T3, T4, T5> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4, T5]> // prettier-ignore
export  function withLatestFrom<I, T1, T2, T3, T4, T5, T6> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4, T5, T6]> // prettier-ignore
export  function withLatestFrom<I, T1, T2, T3, T4, T5, T6, T7> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4, T5, T6, T7]> // prettier-ignore
export  function withLatestFrom<I, T1, T2, T3, T4, T5, T6, T7, T8> (...nodes: [RN<T1>, RN<T2>, RN<T3>, RN<T4>, RN<T5>, RN<T6>, RN<T7>, RN<T8>]): (source: RN<I>) => RN<[I, T1, T2, T3, T4, T5, T6, T7, T8]> // prettier-ignore
export function withLatestFrom<I>(...nodes: Array<RN<unknown>>) {
  return ((source, { connect, signalInstance }) => {
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
  }) as Operator<I, unknown[]>
}

/**
 * Operator that maps the output of a node to a fixed value.
 */
export function mapTo<I, O>(value: O) {
  return ((source, { signalInstance, connect }) => {
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
export function filter<I, O = I>(predicate: (value: I) => boolean) {
  return ((source, { signalInstance, connect }) => {
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
export function once<I>() {
  return ((source, { signalInstance, connect }) => {
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
export function scan<I, O>(accumulator: (current: O, value: I) => O, seed: O) {
  return ((source, { signalInstance, connect }) => {
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
export function throttleTime<I>(delay: number) {
  return ((source, { signalInstance, sub, pub }) => {
    const sink = signalInstance<I>()
    let currentValue: I | undefined
    let timeout: ReturnType<typeof setTimeout> | null = null

    sub(source, (value) => {
      currentValue = value

      if (timeout !== null) {
        return
      }

      timeout = setTimeout(() => {
        timeout = null
        pub(sink, currentValue)
      }, delay)
    })

    return sink
  }) as Operator<I, I>
}

/**
 * Debounces the output of a node with the specified delay.
 */
export function debounceTime<I>(delay: number) {
  return ((source, { signalInstance, sub, pub }) => {
    const sink = signalInstance<I>()
    let currentValue: I | undefined
    let timeout: ReturnType<typeof setTimeout> | null = null

    sub(source, (value) => {
      currentValue = value

      if (timeout !== null) {
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
 * Delays the output of a node with `queueMicrotask`.
 */
export function delayWithMicrotask<I>() {
  return ((source, { pub, sub, signalInstance }) => {
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
 * Buffers the stream of a node until the passed note emits.
 */
export function onNext<I, O>(bufNode: RN<O>) {
  return ((source, { signalInstance, sub, connect }) => {
    const sink = signalInstance<O>()
    const bufferValue = Symbol()
    let pendingValue: I | typeof bufferValue = bufferValue
    connect({
      map: (done) => (value) => {
        if (pendingValue !== bufferValue) {
          done([pendingValue, value])
          pendingValue = bufferValue
        }
      },
      sink,
      sources: [bufNode],
    })
    sub(source, (value) => (pendingValue = value))
    return sink
  }) as Operator<I, [I, O]>
}
