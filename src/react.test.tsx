import { describe, it, expect, afterEach } from 'vitest'
import { RealmProvider } from './react'
import { cleanup, renderHook, render, screen } from '@testing-library/react'
import { useCell, useCellValue, useCellValues, useSignal } from './hooks'
import { mapTo } from './operators'
import { Cell, Action } from '.'

const cell = Cell('hello')
describe('gurx realm react', () => {
  afterEach(cleanup)

  it('gets a cell value with useCell', () => {
    const { result } = renderHook(useCell, { initialProps: cell, wrapper: RealmProvider })
    expect(result.current[0]).toEqual('hello')
  })

  it('has working setters', () => {
    const { result, rerender } = renderHook(useCell, { initialProps: cell, wrapper: RealmProvider })
    expect(result.current[0]).toEqual('hello')
    result.current[1]('world')
    rerender(cell)
    expect(result.current[0]).toEqual('world')
  })

  it('supports actions', () => {
    const cell = Cell('hello')

    const action = Action((r) => {
      r.link(r.pipe(action, mapTo('world')), cell)
    })

    const { result, rerender } = renderHook(
      () => {
        const proc = useSignal(action)
        const value = useCellValue(cell)
        return [value, proc] as const
      },
      { wrapper: RealmProvider }
    )
    expect(result.current[0]).toEqual('hello')
    result.current[1]()
    rerender(cell)
    expect(result.current[0]).toEqual('world')
  })

  it('supports multiple values', () => {
    const a = Cell('a')
    const b = Cell('b')
    const { result } = renderHook(() => useCellValues(a, b), { wrapper: RealmProvider })

    expect(result.current).toEqual(['a', 'b'])
  })

  describe('provider props', () => {
    it('allows setting initial cell values', () => {
      const { result } = renderHook(useCell, {
        initialProps: cell,
        wrapper: ({ children }) => {
          return <RealmProvider initWith={{ [cell.id]: 'world' }}>{children}</RealmProvider>
        },
      })
      expect(result.current[0]).toEqual('world')
    })
    it('accepts update props', () => {
      const Child = () => {
        const [value] = useCell(cell)
        return <div data-testid="cell-value">{value}</div>
      }
      const { rerender } = render(
        <RealmProvider initWith={{ [cell.id]: '1' }}>
          <Child />
        </RealmProvider>
      )

      expect(screen.getByTestId('cell-value').textContent).toEqual('1')

      rerender(
        <RealmProvider updateWith={{ [cell.id]: '2' }}>
          <Child />
        </RealmProvider>
      )

      expect(screen.getByTestId('cell-value').textContent).toEqual('2')
    })
  })
})
