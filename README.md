# Push-based state management 

Works with React, can be used as standalone library, useful when you test your state management logic.

Gurx lets you specify your application state management logic as stateful nodes (cells), stateless nodes (signals), and dependencies and transformations between the values that flow through them. In the react world, a provider and a set of hooks allow you to access the values and to push new values in the given cells / signals.

Under the hood, the cells and signals are arranged in a graph (a Realm) based on the dependencies and transformations you specify. When a cell or signal changes, the graph is traversed to find all the cells and signals that depend on the changed value. The new values are then pushed through the graph, and the components that depend on them are re-rendered.

## Hello world

```tsx
import { map, Signal, Cell, RealmProvider, useCellValue, useSignal } from '.'

// Create a cell with an initial value, and flag that says it should act as distinct. 
const cell$ = Cell('foo', true)

// A distinct signal that will update the cell when its value changes. 
// The second argument is a function that takes a Realm instance and allows you to link the signal to other cells and signals. 
const signal$ = Signal<number>(true, (r) => {
  r.link(
    r.pipe(
      signal$,
      map((signal) => `Signal${signal}`)
    ),
    cell$
  )
})

const Comp = () => {
  const cell = useCellValue(cell$)
  const pushSignal = useSignal(signal$)

  return (
    <div>
      <button
        onClick={() => {
          pushSignal(1)
        }}
      >
        click
      </button>

      {cell}
    </div>
  )
}

export const App = () => {
  return (
    <RealmProvider>
      <Comp />
    </RealmProvider>
  )
}
```

## Operators 

Gurx exports a set of operators like `map`, `filter`, `mapTo`, etc. The realm instance also exposes a `pipe` method that allows you to chain operators together, a combine function that lets you combine multiple signals into one, and a `link` method that allows you to link a signal to a cell or another signal.

## Hooks 

// TODO

## More
See the tests for more examples. 
