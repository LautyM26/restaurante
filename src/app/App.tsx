import { RESTAURANT } from '../config'

// Mínimo de T1: solo el landmark principal. T4 y T5 montan aquí los providers y la app del cliente.
export function App() {
  return (
    <main className="px-4 pt-6">
      <h1 className="font-display text-5xl font-extrabold uppercase">{RESTAURANT.name}</h1>
    </main>
  )
}
