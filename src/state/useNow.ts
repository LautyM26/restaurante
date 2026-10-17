// La hora actual como estado, refrescada cada `intervalMs` (RF48): sirve para que un aviso que depende del
// tiempo ("tu pedido está tardando") aparezca solo al cumplirse el plazo, sin recargar la página.
import { useEffect, useState } from 'react'

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
