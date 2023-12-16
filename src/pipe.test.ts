/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { describe, it, expect, vi } from 'vitest'

import { realm, Signal, Cell } from './realm'
import { noop } from './utils'

async function awaitCall(cb: () => unknown, delay: number) {
  return await new Promise((resolve) => {
    setTimeout(() => {
      cb()
      resolve(undefined)
    }, delay)
  })
}

describe('pipe', () => {
  it('maps node values', () => {
    const r = realm()
    const a = Signal<number>()

    const b = r.pipe(
      a,
      r.map((val: number) => val * 2)
    )
    const spy = vi.fn()
    r.sub(b, spy)
    r.pub(a, 2)
    expect(spy).toHaveBeenCalledWith(4)
  })

  it('filters node values', () => {
    const r = realm()
    const a = Signal<number>()

    const b = r.pipe(
      a,
      r.filter((val: number) => val % 2 === 0)
    )

    const spy = vi.fn()
    r.sub(b, spy)
    r.pub(a, 2)
    r.pub(a, 3)
    r.pub(a, 4)
    expect(spy).toHaveBeenCalledWith(4)
    expect(spy).not.toHaveBeenCalledWith(3)
    expect(spy).toHaveBeenCalledWith(2)
  })

  it('pulls values in withLatestFrom', () => {
    const r = realm()
    const a = Cell('foo')
    const b = Cell('bar')

    const c = r.pipe(a, r.withLatestFrom(b))

    const spy = vi.fn()
    r.sub(c, spy)

    r.pub(a, 'baz')
    expect(spy).toHaveBeenCalledWith(['baz', 'bar'])
    r.pub(b, 'qux')
    expect(spy).toHaveBeenCalledTimes(1)
    r.pub(a, 'foo')
    expect(spy).toHaveBeenCalledWith(['foo', 'qux'])
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('maps to fixed value with mapTo', () => {
    const r = realm()
    const a = Signal<number>()

    const b = r.pipe(a, r.mapTo('bar'))

    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 2)
    expect(spy).toHaveBeenCalledWith('bar')
  })

  it('accumulates with scan', () => {
    const r = realm()
    const a = Signal<number>()

    const b = r.pipe(
      a,
      r.scan((acc, value) => acc + value, 1)
    )

    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 2)
    expect(spy).toHaveBeenCalledWith(3)

    r.pub(a, 3)
    expect(spy).toHaveBeenCalledWith(6)
  })

  it('onNext publishes only once, when the trigger signal emits', () => {
    const r = realm()
    const a = Signal<number>()
    const b = Signal<number>()

    const c = r.pipe(a, r.onNext(b))

    const spy = vi.fn()
    r.sub(c, spy)

    r.pub(a, 2)
    expect(spy).toHaveBeenCalledTimes(0)

    r.pub(b, 3)
    expect(spy).toHaveBeenCalledWith([2, 3])
    expect(spy).toHaveBeenCalledTimes(1)

    // next publish should not retrigger the sub
    r.pub(b, 4)
    expect(spy).toHaveBeenCalledTimes(1)

    // a new value should activate the triggering again
    r.pub(a, 2)
    r.pub(b, 4)
    expect(spy).toHaveBeenCalledWith([2, 4])
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('once publishes only once', () => {
    const r = realm()
    const a = Signal<number>()
    const b = Signal<number>()

    r.link(r.pipe(a, r.once()), b)

    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 1)
    r.pub(a, 2)
    expect(spy).toHaveBeenCalledWith(1)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('throttleTime delays the execution', async () => {
    const r = realm()
    const a = Signal<number>()
    const b = r.pipe(a, r.throttleTime(60))
    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 1)

    await awaitCall(() => r.pub(a, 2), 20) // +20
    await awaitCall(() => r.pub(a, 3), 30) // +30
    expect(spy).toHaveBeenCalledTimes(0)
    await awaitCall(noop, 20) // +20 = 80

    expect(spy).toHaveBeenCalledWith(3)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('debounceTime bounces the execution', async () => {
    const r = realm()
    const a = Signal<number>()
    const b = r.pipe(a, r.debounceTime(60))
    const spy = vi.fn()
    r.sub(b, spy)

    r.pub(a, 1)

    await awaitCall(() => r.pub(a, 2), 20) // +20
    await awaitCall(() => r.pub(a, 3), 30) // +30
    expect(spy).toHaveBeenCalledTimes(0)
    await awaitCall(noop, 70)

    expect(spy).toHaveBeenCalledWith(3)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('combines node values', () => {
    const r = realm()
    const a = Cell<number>(0)
    const b = Cell<number>(0)
    const d = Cell<number>(6)

    const c = r.combine(a, b, d)

    const spy = vi.fn()
    r.sub(c, spy)
    r.pubIn({ [a.id]: 3, [b.id]: 4 })
    expect(spy).toHaveBeenCalledWith([3, 4, 6])
    expect(spy).toHaveBeenCalledTimes(1)
    r.pub(d, 7)
    expect(spy).toHaveBeenCalledWith([3, 4, 7])
  })

  it('derives node values', () => {
    const r = realm()
    const a = Cell<number>(0)
    const b = r.derive(
      r.pipe(
        a,
        r.map((val) => val * 2)
      ),
      2
    )
    const spy = vi.fn()
    r.sub(b, spy)
    r.pub(a, 3)
    expect(spy).toHaveBeenCalledWith(6)
  })

  it('supports value-less signals', () => {
    const a = Signal()
    const b = Cell(1)
    const r = realm()

    r.link(
      r.pipe(
        a,
        r.withLatestFrom(b),
        r.map(([_, b]) => b + 1)
      ),
      b
    )
    expect(r.getValue(b)).toBe(1)
    r.pub(a)
    expect(r.getValue(b)).toBe(2)
  })
})