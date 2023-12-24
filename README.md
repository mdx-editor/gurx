# Push-based state management 

Welcome to the README of Gurx, an extensible typescript-native reactive state management library for complex web applications and components. 

## Motivation

- **Push-based** - Gurx implements a push-based state model, meaning that the values flow through the graph as they change, and the components are re-rendered when the values they depend on change. This is in contrast to pull-based libraries like Jotai or Redux, where the values are pulled from the store when the components are rendered. 

- **Open** - the node definition based approach lets you extend the logic of the state management by connecting more nodes and interactions to the existing ones. This lets you partition your state management logic into smaller, more manageable pieces and even build a plugin system on top of it. 

- **Optimized** - any Gurx node can be marked as distinct, meaning that it will push through its subscribers only when a new value arrives. This allows you to avoid expensive computations and re-renders. 

- **Multi publish/subscribe** - you can subscribe to multiple nodes at once, and you can publish to multiple nodes at once. A multi-push will execute a single traversal of the node graph, and will re-render the components only once, given that they are subscribed through a single point. 

- **Type-safe** - the library gives you the right types within the node operators and the React hooks.

- **Testable** - you can easily initiate a realm and interact with your nodes outside of React. This makes it easy to unit-test your state management logic. 

- **React friendly** - Gurx has a Realm provider component and set of hooks that allow you to access the values and to publish new values in the given nodes. Under the hood, the hooks use `useSyncExternalStore`.

## Conceptual Overview

The library is based on the concept node **definitions**, which are instantiated into **nodes** within a graph-based structure called a **Realm**. The nodes are connected to each other through **dependencies** and **transformations** that describe how the values that flow through the nodes map and transform. 

### Cells, Signals, and Actions

Gurx has three types of node definitions: **cells**, **signals**, and **actions**. The cells are stateful, which means that the values that flow through them are stored in the realm between computations. The signals are stateless - you can publish a value through a signal that will trigger the specified computations and you can subscribe to signal updates, but you can't query the current value of a signal. Finally, the actions are value-less signals - they are meant to trigger some recalculation without a parameter. 

### The Realm

The cells, signals, and actions are just blueprints **and** references to nodes within a realm that will be created. The actual instantiation and interaction (publishing, subscribing, etc) with them happens through a Realm instance. A realm is initially empty; it creates their node instances when you subscribe or publish to them through it. If a cell/signal refers to other nodes in its initialization function, the realm will automatically recursively include those nodes as well. 

Each cell/signal has a single instance in a realm. If you subscribe to a cell/signal multiple times, the realm will return the same instance. In practices, you don't have to care about the distinction between an instance and a definition - under the hood, they both use symbol as a reference.

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
