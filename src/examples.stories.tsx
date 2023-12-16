import { Action, Cell, RealmProvider, useCellValue, useCellValues, useSignal } from '.'

const foo = Cell('foo', true)
const bar = Cell('bar', true)
const q = Action((r) => {
  r.sub(q, () => {
    r.pubIn({
      [foo.id]: 'baz',
      [bar.id]: 'bam',
    })
  })
})

const WorldChild = () => {
  const [a, b] = useCellValues(foo, bar)
  const aa = useCellValue(foo)
  const action = useSignal(q)
  console.log('render', { a, b })
  return (
    <div>
      <button
        onClick={() => {
          action()
        }}
      >
        click
      </button>
      {a} {b} {aa}
    </div>
  )
}

export const Hello = () => {
  return (
    <RealmProvider>
      <WorldChild />
    </RealmProvider>
  )
}