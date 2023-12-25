# Push-based state management 

Welcome to the README of Gurx, an extensible typescript-native reactive state management library for complex web applications and components. 

## Motivation

- **Push-based** - Gurx implements a push-based state model, meaning that the values flow through the graph as they change, and the components are re-rendered when the values they depend on change. This is in contrast to pull-based libraries like Jotai or Redux, where the values are pulled from the store when the components are rendered. 

- **Open** - the node definition based approach lets you extend the logic of the state management by connecting more nodes and interactions to the existing ones. This lets you partition your state management logic into smaller, more manageable pieces and even build a plugin system on top of it. 

- **Optimized** - any Gurx node are marked as distinct by default, meaning that it will push through its subscribers only when a value different than the previous one is published. This allows you to avoid expensive computations and re-renders. 

- **Multi publish/subscribe** - you can subscribe to multiple nodes at once, and you can publish to multiple nodes at once. A multi-push will execute a single traversal of the node graph, and will re-render the components only once, given that they are subscribed through a single point. 

- **Type-safe** - the library gives you the right types within the node operators and the React hooks.

- **Testable** - you can easily initiate a realm and interact with your nodes outside of React. This makes it easy to unit-test your state management logic. 

- **React friendly** - Gurx has a Realm provider component and set of hooks that allow you to access the values and to publish new values in the given nodes. Under the hood, the hooks use `useSyncExternalStore`.

## Conceptual Overview

The library is based on the concept node **definitions**, which are instantiated into **nodes** within a graph-based structure called a **Realm**. The nodes are connected to each other through **dependencies** and **transformations** that describe how the values that flow through the nodes map and transform. 

### Cells, Signals, and Actions

Gurx has three types of node definitions: **cells**, **signals**, and **actions**. The cells are stateful, which means that the values that flow through them are stored in the realm between computations. The signals are stateless - you can publish a value through a signal that will trigger the specified computations and you can subscribe to signal updates, but you can't query the current value of a signal. Finally, the actions are value-less signals - they are meant to trigger some recalculation without a parameter. 

### The Realm

The cells, signals, and actions are just blueprints **and** references to nodes within a realm that will be created. The actual instantiation and interaction (publishing, subscribing, etc.) with them happens through a Realm instance. A realm is initially empty; it creates their node instances when you subscribe or publish to them through it. If a cell/signal refers to other nodes in its initialization function, the realm will automatically recursively include those nodes as well. 

Each cell/signal has a single instance in a realm. If you subscribe to a cell/signal multiple times, the realm will return the same instance. In practices, you don't have to care about the distinction between an instance and a definition - under the hood, they both use symbol as a reference.

## Installation

```sh
npm install @mdxeditor/gurx
```

## Defining Cells and Signals

The first step in building your state management logic is to define the cells and signals that will hold the values and their relationships. Unlike other state management libraries, Gurx doesn't have the concept of a store. Instead, the cells and signals definitions are declared on the module level. A cell is defined by calling the `Cell` function, which accepts an initial value, a distinct flag, and an initialization function that can be used to connect the cell to other nodes using the realm instance which starts it. The `Signal` function is the same, but with the initial value argument. 

Note: You can name the node references with a dollar sign suffix, to indicate that they are reactive. Most likely, you will reference their values in the body of the operators/React components without the dollar sign suffix.

```ts
const myCell$ = Cell(
  // initial value
  0,
  // the r is the realm instance that starts the cell
  (r) => {
    r.sub(myCell$, (value) => {
      console.log('myCell$ changed to', value)
    })
  }
  // distinct flag, true by default
  true
)

// Since signals have no initial value, you need to specify the type of data that will flow through them
const mySignal$ = Signal<number>(
  // the r is the realm instance that starts the cell
  (r) => {
    r.sub(mySignal$, (value) => {
      console.log('mySignal$ changed to', value)
    })
    // publishing a value through a signal will publish it into $myCell as well
    r.link(mySignal$, myCell$)
  },
  // distinct flag
  true
)
```

If the node passes non-primitive values, but you still want to optimize re-rendering, you can pass a custom comparator function as the `distinct` argument. 

## Working with nodes

By themselves, the node definitions won't do anything. The actual work happens when a realm instance is created and you start interacting with node refs returned from `Cell`/`Signal`.

### Publishing and subscribing, and getting the current values

Following the example above, we can create a realm instance and publish a value through the signal using `pub` and `sub`:

```ts
const realm = new Realm()

realm.sub(myCell$, (value) => {
  console.log('a subscription from the outside', value)
})

realm.pub(mySignal$, 1)
```

Note: In addition to `pub`/`sub`, the realm supports both publishing and subscribing to multiple nodes at once with its `pubIn` and `subMultiple` methods. You can also use exclusive, "singleton" subscriptions through the `singletonSub` method - these are useful for event handling mechanism.

Since the cells are stateful, you can also get their current value for a given realm instance using the `getValue`/`getValues` methods at any moment:

```ts
r.getValue(myCell$) // 1
```

While perfectly fine, and sometimes necessary, getting the values moves the data outside of the reactive realm paradigm. You should use those as the final endpoint of your state management.

## Linking, combining and transforming nodes

The examples so far have referred to the most basic way of connecting nodes - the `link` method. It's a one-way connection that pushes the values from the source node to the target node. The bread and butter of Gurx are the operators that allow you to create more complex relationships between the nodes. The operators are used with the realm's `pipe` method. The below example will add `1` to the value that flows through `mySignal$` and publish it to `myCell$`:

```ts
// use this in the initialization function of mySignal$
r.link(r.pipe(mySignal$, map((x) => x + 1)), myCell$)
```

`map` and `filter` are the most basic operators. Gurx includes additional ones like `mapTo`, `throttleTime` and `withLatestFrom`. An operator can be a conditional, like `filter`, or even asynchronous, like `throttleTime` or `handlePromise`. You can create your own custom operators by implementing the `Operator` interface.

## Using in React

Gurx includes a `RealmProvider` React component and a set of hooks that allow you to access the values and to publish new values in the given nodes. Referring to a node in the hooks automatically initiates it in the nearest realm.

```tsx
const foo$ = Cell('foo', true)

function Foo() {
  const foo = useCellValue(foo$)
  return (<div>{foo}</div>)
}

export function App() {
  return (
    <RealmProvider><Foo /></RealmProvider>
  )
}
```

Additional hooks include `usePublisher`, `useCellValues`, and the low-level `useRealm` that returns the realm instance from the provider. 

## Next steps

The README is meant to give you a breath-first overview of the library. More details about the operators, hooks, and realm capabilities can be found in the API Reference.

