import { map, Signal, Cell, RealmProvider, useCellValue, usePublisher } from '.'

// Create a cell with an initial value
const cell$ = Cell('foo', true)

// A signal, that will update the cell when its value changes
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
  const pushSignal = usePublisher(signal$)

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
