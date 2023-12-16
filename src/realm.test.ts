/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { realm, Cell, type Realm, Signal } from './realm'

describe('gurx realm cells', () => {
  let r: Realm
  beforeEach(() => {
    r = realm()
  })

  it('registers cells so that their value is accessed', () => {
    const cell = Cell('hello')
    const v = r.getValue(cell)
    expect(v).toEqual('hello')
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
  // distinct
  // signals and effects
})
