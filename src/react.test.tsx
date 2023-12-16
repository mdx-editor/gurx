/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, afterEach } from 'vitest'
import { Cell } from './realm'
import { RealmProvider } from './react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { useCell } from './hooks'

describe('gurx realm react', () => {
  afterEach(cleanup)
  it('allows access to a cell value with useCell', () => {
    const cell = Cell('hello')

    const Child = () => {
      const [value] = useCell(cell)
      return <div data-testid="value">{value}</div>
    }

    render(
      <RealmProvider>
        <Child />
      </RealmProvider>
    )

    expect(screen.getByTestId('value')).toHaveTextContent('hello')
  })

  it('has working setters', () => {
    const cell = Cell('hello')
    const Child = () => {
      const [value, setValue] = useCell(cell)
      return (
        <div
          data-testid="value"
          onClick={() => {
            setValue('world')
          }}
        >
          {value}
        </div>
      )
    }

    const Test = () => (
      <RealmProvider>
        <Child />
      </RealmProvider>
    )

    const { queryByTestId } = render(<Test />)
    expect(screen.getByTestId('value')).toHaveTextContent('hello')
    fireEvent.click(queryByTestId('value')!)
    expect(screen.getByTestId('value')).toHaveTextContent('world')
  })

  /*
  it('can register init ', () => {
    const cell = Cell(2)
    const signal = Signal<number>()

    const Child = () => {
      const [value] = useCell(cell)
      const setter = useSetter(signal)
      useInit((r) => {
        r.link(
          r.pipe(
            signal,
            r.map((v) => v + 2)
          ),
          cell
        )
      })

      return (
        <div data-testid="value" onClick={() => setter(1)}>
          {value}
        </div>
      )
    }

    const Test = () => (
      <RealmProvider>
        <Child />
      </RealmProvider>
    )

    const { queryByTestId } = render(<Test />)
    expect(screen.getByTestId('value')).toHaveTextContent('2')
    fireEvent.click(queryByTestId('value')!)
    expect(screen.getByTestId('value')).toHaveTextContent('3')
  }) */
})
