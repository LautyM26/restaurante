// Lleva el foco a un aviso cuando aparece. Cuando el botón que tenía el foco (por ejemplo "Enviar pedido")
// es reemplazado por un error o por el aviso de precio, el teclado y el lector de pantalla no se quedan sin lugar.
// Es una función estable (no se crea en cada render) para que React la llame solo al montar el elemento.
export const focusOnMount = (element: HTMLElement | null) => {
  element?.focus({ preventScroll: true })
}
