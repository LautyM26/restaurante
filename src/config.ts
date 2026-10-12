// Constantes de la aplicación. Un solo lugar para los valores de negocio.
export const RESTAURANT = { name: 'Fogón', currency: 'ARS' } as const

/** Cantidad máxima por línea del pedido. */
export const MAX_QTY = 20
/** Largo máximo (en caracteres visibles) de la nota de un plato. */
export const NOTE_MAX = 140
/** Largo máximo (en caracteres visibles) de la nota general del pedido. */
export const ORDER_NOTE_MAX = 200
/** Ventana, en horas, de los pedidos que el dispositivo recuerda en "Mis pedidos". */
export const MY_ORDERS_WINDOW_H = 12
/** Ventana, en horas, dentro de la cual el código corto de un pedido no se repite. */
export const CODE_UNIQUE_WINDOW_H = 24
/** Duración del aviso (Toast), en milisegundos. */
export const TOAST_MS = 4000
