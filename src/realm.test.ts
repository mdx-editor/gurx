import { describe, it, expect, beforeEach, vi, expectTypeOf } from 'vitest'
import { realm, Cell, type Realm, Signal, Action } from './realm'

describe('gurx cells/signals', () => {
  let r: Realm
  beforeEach(() => {
    r = realm()
  })

  it('registers cells so that their value is accessed', () => {
    const cell = Cell('hello')
    expect(r.getValue(cell)).toEqual('hello')
    r.pub(cell, 'world')
    r.registerCell(cell)
    expect(r.getValue(cell)).toEqual('world')
  })

  it('registers signals', () => {
    const signal = Signal<string>()
    const callback = vi.fn()
    r.sub(signal, callback)
    r.pub(signal, 'hello')
    expect(callback).toHaveBeenCalledWith('hello')
  })

  it('implicitly registers cells used with combine', () => {
    const foo = Cell('foo')
    const bar = Cell('bar')
    const fooBar = r.combine(foo, bar)

    const callback = vi.fn()
    r.sub(fooBar, callback)
    r.pub(foo, 'foo2')
    expect(callback).toHaveBeenCalledWith(['foo2', 'bar'])
  })

  it('accepts initial cell values', () => {
    const cell = Cell('foo')
    r = realm({ [cell.id]: 'bar' })
    expect(r.getValue(cell)).toEqual('bar')
  })

  it('supports init function for cells', () => {
    const a = Cell(2)
    const b = Cell(2, true, (r) => {
      r.link(b, a)
    })
    r.pub(b, 3)
    expect(r.getValue(a)).toEqual(3)
  })

  it('supports init function for Signals', () => {
    const a = Cell(2)
    const b = Signal(true, (r) => {
      r.link(b, a)
    })
    r.pub(b, 3)
    expect(r.getValue(a)).toEqual(3)
  })

  it('supports init function for Actions', () => {
    const a = Cell(2)
    const b = Action((r) => {
      r.pub(a, 3)
    })
    r.pub(b)
    expect(r.getValue(a)).toEqual(3)
  })

  it('gets multiple values', () => {
    const a = Cell(2)
    const b = Cell('foo')
    const result = r.getValues([a, b])
    expectTypeOf(result).toMatchTypeOf<[number, string]>()
    expect(result).toEqual([2, 'foo'])
  })
})

describe('realm features', () => {
  let r: Realm

  beforeEach(() => {
    r = realm()
  })

  it('supports pub/sub', () => {
    const n = Signal()
    const spy = vi.fn()
    r.sub(n, spy)
    r.pub(n, 'foo')
    expect(spy).toHaveBeenCalledWith('foo')
  })

  it('supports undefined initial value', () => {
    const n = Cell<string | undefined>(undefined, true)
    const q = Cell(1, true)
    const tc = Cell<number>(0, true)
    r.link(
      r.pipe(
        r.combine(n, q),
        r.filter(([data]) => data !== undefined),
        r.map(([data]) => data?.length)
      ),
      tc
    )

    const spy = vi.fn()
    r.sub(tc, spy)
    r.pub(n, 'foo')
    expect(spy).toHaveBeenCalledWith(3)
  })

  it('connects nodes', () => {
    const a = Signal<number>()
    const b = Signal<number>()
    r.connect<[number]>({
      map: (done) => (value) => {
        done(value * 2)
      },
      sink: b,
      sources: [a],
    })

    const spy = vi.fn()
    r.sub(b, spy)
    r.pub(a, 2)
    expect(spy).toHaveBeenCalledWith(4)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('publishes once with diamond dependencies', () => {
    const a = Signal<number>()
    const b = Signal<number>()
    const c = Signal<number>()
    const d = Signal<number>()
    // const e = r.node<number>()

    r.connect<[number]>({
      map: (done) => (value) => {
        done(value * 2)
      },
      sink: b,
      sources: [a],
    })

    r.connect<[number]>({
      map: (done) => (value) => {
        done(value * 3)
      },
      sink: c,
      sources: [a],
    })

    r.connect<[number, number]>({
      map: (done) => (b, c) => {
        done(b + c)
      },
      sink: d,
      sources: [b, c],
    })

    const spy = vi.fn()
    r.sub(d, spy)
    r.pub(a, 2)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(10)
  })

  it('handles multiple conditional execution paths', () => {
    const a = Signal<number>()
    const b = Signal<number>()
    const c = Signal<number>()
    const d = Signal<number>()

    r.connect<[number]>({
      map: (done) => (value) => {
        if (value % 2 === 0) {
          done(value)
        }
      },
      sink: c,
      sources: [a],
    })

    r.connect<[number]>({
      map: (done) => (value) => {
        if (value % 2 === 0) {
          done(value)
        }
      },
      sink: c,
      sources: [b],
    })

    r.connect<[number]>({
      map: (done) => (value) => {
        done(value * 2)
      },
      sink: d,
      sources: [c],
    })

    const spy = vi.fn()
    r.sub(c, spy)
    const spy2 = vi.fn()
    r.sub(d, spy2)

    r.pubIn({
      [a.id]: 2,
      [b.id]: 3,
    })
    expect(spy).toHaveBeenCalledWith(2)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledWith(4)
    expect(spy2).toHaveBeenCalledTimes(1)

    r.pubIn({
      [a.id]: 3,
      [b.id]: 4,
    })
    expect(spy).toHaveBeenCalledWith(4)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy2).toHaveBeenCalledWith(8)
    expect(spy2).toHaveBeenCalledTimes(2)
  })

  it('handles pull dependencies', () => {
    const a = Signal<number>()
    const b = Signal<number>()
    const c = Signal<number>()
    const d = Signal<number>()
    const e = Signal<number>()
    const f = Signal<number>()
    const g = Signal<number>()
    const h = Signal<number>()

    r.connect<[number]>({
      map: (done) => (value) => {
        done(value + 1)
      },
      sink: b,
      sources: [a],
    })

    r.connect<[number]>({
      map: (done) => (value) => {
        done(value + 1)
      },
      sink: c,
      sources: [b],
    })

    r.connect<[number]>({
      map: (done) => (value) => {
        done(value + 1)
      },
      sink: d,
      sources: [c],
    })

    r.connect<[number]>({
      map: (done) => (value) => {
        done(value + 1)
      },
      sink: e,
      sources: [d],
    })

    r.connect<[number, number]>({
      map: (done) => (a, e) => {
        done(a + e + 1)
      },
      pulls: [e],
      sink: f,
      sources: [a],
    })

    r.connect<[number]>({
      map: (done) => (value) => {
        done(value + 1)
      },
      sink: g,
      sources: [f],
    })

    r.connect<[number]>({
      map: (done) => (value) => {
        done(value + 1)
      },
      sink: h,
      sources: [g],
    })

    const spy = vi.fn()
    r.sub(f, spy)
    r.pub(a, 1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(7)
  })

  it('supports conditional connections', () => {
    const a = Signal<number>()
    const b = Signal<number>()

    r.connect<[number]>({
      map: (done) => (value) => {
        value % 2 === 0 && done(value)
      },
      sink: b,
      sources: [a],
    })

    const spy = vi.fn()
    r.sub(b, spy)
    r.pub(a, 1)
    r.pub(a, 2)
    r.pub(a, 3)
    r.pub(a, 4)

    expect(spy).toHaveBeenCalledWith(2)
    expect(spy).not.toHaveBeenCalledWith(3)
    expect(spy).not.toHaveBeenCalledWith(1)
    expect(spy).toHaveBeenCalledWith(4)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('canceled connection cancels further execution', () => {
    const a = Signal<number>()
    const b = Signal<number>()
    const c = Signal<number>()
    const d = Signal<number>()

    r.connect<[number]>({
      map: (done) => (value) => {
        value % 2 === 0 && done(value)
      },
      sink: b,
      sources: [a],
    })

    r.connect({
      map: (done) => (value) => {
        done(value)
      },
      sink: c,
      sources: [b],
    })

    r.connect({
      map: (done) => (value) => {
        done(value)
      },
      sink: d,
      sources: [c],
    })

    const spy = vi.fn()
    r.sub(d, spy)
    r.pub(a, 1)
    r.pub(a, 2)
    r.pub(a, 3)
    r.pub(a, 4)

    expect(spy).toHaveBeenCalledWith(2)
    expect(spy).not.toHaveBeenCalledWith(3)
    expect(spy).not.toHaveBeenCalledWith(1)
    expect(spy).toHaveBeenCalledWith(4)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('supports publishing in multiple nodes with a single call', () => {
    const a = Signal<number>()
    const b = Signal<number>()
    const c = Signal<number>()

    r.connect<[number, number]>({
      map: (done) => (a, b) => {
        done(a + b)
      },
      sink: c,
      sources: [a, b],
    })

    const spy = vi.fn()
    r.sub(c, spy)
    r.pubIn({ [a.id]: 2, [b.id]: 3 })

    expect(spy).toHaveBeenCalledWith(5)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('pulls from stateful nodes', () => {
    const a = Cell('foo')
    const b = Signal()
    const c = Signal()

    r.connect<[number, number]>({
      map: (done) => (b, a) => {
        done(a + b)
      },
      pulls: [a],
      sink: c,
      sources: [b],
    })

    const spy = vi.fn()
    r.sub(c, spy)
    r.pub(b, 'bar')
    expect(spy).toHaveBeenCalledWith('foobar')
  })

  it('does not recall subscriptions for distinct stateful nodes', () => {
    const a = Cell('foo', true)
    const spy = vi.fn()
    r.sub(a, spy)
    r.pub(a, 'foo')

    expect(spy).toHaveBeenCalledTimes(0)
  })

  it('does not recall subscriptions for distinct stateful child nodes', () => {
    const a = Cell('bar')
    const b = Cell('foo', true)
    const spy = vi.fn()
    r.connect({
      map: (value) => value,
      sink: b,
      sources: [a],
    })
    r.sub(b, spy)
    r.pub(a, 'foo')
    r.pub(a, 'foo')

    expect(spy).toHaveBeenCalledTimes(0)
  })

  it('supports custom comparator when distinct flag is set', () => {
    const a = Cell({ id: 'foo' }, (current, next) => current.id === next.id)
    const spy = vi.fn()
    r.sub(a, spy)
    r.pub(a, { id: 'foo' })

    expect(spy).toHaveBeenCalledTimes(0)
  })

  it('supports subscribing to multiple nodes', () => {
    const a = Cell('bar')
    const b = Cell('foo', true)
    const spy = vi.fn()
    r.connect({
      map: (value) => value,
      sink: b,
      sources: [a],
    })

    r.subMultiple([a, b], spy)

    r.pubIn({
      [a.id]: 'qux',
      [b.id]: 'mu',
    })

    expect(spy).toHaveBeenCalledWith(['qux', 'mu'])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('pubs subscription for multiple keys when one is updated', () => {
    const a = Cell('1')
    const b = Cell('2')
    const spy = vi.fn()
    r.subMultiple([a, b], spy)
    r.pub(a, '2')
    expect(spy).toHaveBeenCalledWith(['2', '2'])
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('singleton subscription', () => {
  it('calls the subscription', () => {
    const r = realm()
    const a = Signal<number>()
    const spy1 = vi.fn()
    r.singletonSub(a, spy1)
    r.pub(a, 2)
    expect(spy1).toHaveBeenCalledWith(2)
  })

  it('replaces the subscription', () => {
    const r = realm()
    const a = Signal<number>()
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    r.singletonSub(a, spy1)
    r.pub(a, 2)
    r.singletonSub(a, spy2)
    r.pub(a, 3)
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(1)
  })

  it('returns an unsubscribe handler', () => {
    const r = realm()
    const a = Signal<number>()
    const spy1 = vi.fn()
    const unsub = r.singletonSub(a, spy1)
    r.pub(a, 2)
    unsub()
    r.pub(a, 3)
    expect(spy1).toHaveBeenCalledTimes(1)
  })
})

/*
describe.skip("performance", () => {
  it("reuses calculated paths", () => {
    const r = realm();
    const MAX_DEPTH = 10;
    let subCalledCount = 0;
    let nodeCount = 0;
    const recursivelyAddTwoChildren = (parent: NodeKey, depth = 0) => {
      const n1 = r.node();
      const n2 = r.node();
      nodeCount++;
      r.connect({ sources: [parent], sink: n1.key, map: (done) => (value) => done(value * 2) });
      r.connect({ sources: [parent], sink: n2.key, map: (done) => (value) => done(value * 3) });
      if (depth < MAX_DEPTH) {
        recursivelyAddTwoChildren(n1.key, depth + 1);
        recursivelyAddTwoChildren(n2.key, depth + 1);
      } else {
        r.sub(n1.key, () => subCalledCount++);
        r.sub(n2.key, () => subCalledCount++);
      }
    };

    const root = r.node("root");
    recursivelyAddTwoChildren(root.key);

    const t0 = performance.now();
    for (let index = 0; index < 100; index++) {
      r.pub({ root: 2 });
    }

    const t1 = performance.now();
    console.log("Took", (t1 - t0).toFixed(4), "milliseconds to publish");

    console.log({ subCalledCount, nodeCount });
  });
});
*/
