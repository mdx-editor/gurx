import { noop } from './utils'
import { type Realm, type RealmNode } from './realm'

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

/**
 * A definition of a stateful node.
 * Once a definition is referenced in the realm, it will be initialized and become a node.
 * A realm constructs a node only once per definition.
 * @typeParam T - The type of values that the node emits.
 * @category Nodes
 */
export interface CellDefinition<T> extends RealmNode<T> {
  cellDefinition: true
  distinct: Distinct<T>
  initial: T
  init: (realm: Realm) => void
}

/**
 * A definition of a stateless node.
 * Once a definition is referenced in the realm, it will be initialized and become a node.
 * A realm constructs a node only once per definition.
 * @typeParam T - The type of values that the node emits.
 * @category Nodes
 */
export interface SignalDefinition<T> extends RealmNode<T> {
  signalDefinition: true
  distinct: Distinct<T>
  init: (realm: Realm) => void
}

/**
 * @category Nodes
 */
export function Cell<T>(value: T, distinct: Distinct<T> = false, init: (r: Realm) => void = noop): CellDefinition<T> {
  const id = Symbol()
  return {
    cellDefinition: true,
    id,
    distinct,
    init,
    initial: value,
  }
}

/**
 * @category Nodes
 */
export function Signal<T>(distinct: Distinct<T> = false, init: (r: Realm) => void = noop): SignalDefinition<T> {
  return {
    signalDefinition: true,
    id: Symbol(),
    distinct,
    init,
  }
}

/**
 * @category Nodes
 */
export function Action(init: (r: Realm) => void = noop): SignalDefinition<void> {
  return {
    signalDefinition: true,
    id: Symbol(),
    distinct: false,
    init,
  }
}
