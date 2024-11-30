import { Action, Cell, RealmProvider, useCellValue, useCellValues, usePublisher } from './index'

const foo$ = Cell('foo', (r) => {
  r.sub(foo$, (v) => {
    console.log('foo', v)
  })
})

const bar$ = Cell('bar')

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
        type="button"
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
    <RealmProvider initWith={{ [foo$]: 'foo' }} updateWith={{ [foo$]: 'foo' }}>
      <WorldChild />
    </RealmProvider>
  )
}
