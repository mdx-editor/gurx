import { Action, Cell, RealmProvider, useCellValue, useCellValues, usePublisher } from '.'

const foo$ = Cell('foo', true)
const bar$ = Cell('bar', true)

const q$ = Action((r) => {
  r.sub(q$, () => {
    r.pubIn({
      [foo$]: 'baz',
      [bar$]: 'bam',
    })
  })
})

const WorldChild = () => {
  const [a, b] = useCellValues(foo$, bar$)
  const aa = useCellValue(foo$)
  const action = usePublisher(q$)
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
