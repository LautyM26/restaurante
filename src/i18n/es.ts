// Diccionario en español: es la FUENTE de las claves. `en.ts` debe tener exactamente las mismas
// (si falta o sobra una, `npm run build` falla). Plural: `clave_one` / `clave_other` (ver `t()`).
// Textos de interfaz sin rayas largas. Las tareas siguientes (T5 en adelante) usan estas claves.
export const es = {
  // Selector de idioma
  'lang.label': 'Idioma',

  // Portada y mesa
  'hero.title': 'Pedí desde\ntu mesa',
  'hero.subtitle': 'Elegí tus platos, personalizalos y mandá el pedido directo a la cocina.',
  'hero.cta': 'Ver la carta',
  'table.badge': 'Mesa {n}',
  'table.notice': 'Para pedir, escaneá el código QR de tu mesa o pedile ayuda al personal.',
  'table.checking': 'Verificando tu mesa',
  'table.unverified': 'No pudimos verificar tu mesa. Revisá tu conexión.',

  // Comunes
  'common.retry': 'Reintentar',

  // Plato
  'dish.add': 'Agregar',
  'dish.soldOut': 'Agotado',
  'dish.required_one': 'Elegí 1 opción',
  'dish.required_other': 'Elegí {count} opciones',
  'dish.maxReached': 'Podés elegir hasta {max}',
  'dish.added': 'Agregado: {name} × {qty}',

  // Pedido en curso
  'cart.maxPerDish': 'Máximo 20 por plato',
  'cart.view': 'Ver pedido',
  'cart.remove': 'Quitar',
  'cart.send': 'Enviar pedido',
  'cart.sending': 'Enviando pedido',
  'cart.edit': 'Editar pedido',
  'cart.error.network': 'No pudimos enviar el pedido. Revisá tu conexión y probá de nuevo.',
  'cart.error.unresolved': 'No sabemos si el pedido llegó. Reintentá: no se va a duplicar.',
  'cart.error.validation': 'No pudimos procesar el pedido. Revisá cantidades y notas.',
  'cart.line.dish_unavailable': 'Este plato ya no está disponible. Quitalo para continuar.',
  'cart.line.dish_not_found': 'Este plato ya no está en la carta. Quitalo para continuar.',
  'cart.line.option_unavailable': 'Una opción elegida ya no está disponible. Quitá el plato y volvé a agregarlo.',
  'cart.line.option_not_found': 'Una opción elegida ya no existe. Quitá el plato y volvé a agregarlo.',
  'cart.line.selection_invalid': 'Las opciones de este plato cambiaron. Quitalo y volvé a agregarlo.',
  'cart.price.title': 'El total cambió',
  'cart.price.body': 'Antes {old}, ahora {new}.',
  'cart.price.accept': 'Aceptar y enviar',
  'cart.price.review': 'Revisar pedido',

  // Mis pedidos
  'orders.title': 'Mis pedidos',
  'orders.table': 'Mesa {n}',
  'orders.sent': 'Pedido enviado',
  'orders.more': 'Pedir algo más',
  'orders.empty': 'Todavía no enviaste pedidos desde este celular.',
  'orders.cancelled': 'Este pedido fue cancelado. Consultá con el personal.',
  'orders.delayed': 'Tu pedido está tardando, avisá al mozo.',
  'orders.announce': 'Pedido {code}: {status}',
  'orders.active_one': 'Mis pedidos, 1 activo',
  'orders.active_other': 'Mis pedidos, {count} activos',
  'orders.news': 'Hay novedades en tus pedidos',

  // Estados del pedido
  'status.pending': 'Enviado',
  'status.accepted': 'Confirmado',
  'status.preparing': 'En preparación',
  'status.ready': 'Listo para servir',
  'status.delivered': 'Entregado',
  'status.cancelled': 'Cancelado',

  // Carta
  'menu.error': 'No pudimos cargar la carta.',
  'menu.offline': 'Estás sin conexión.',
  'menu.empty': 'La carta no está disponible en este momento. Consultá al personal.',
}

/** Clave exacta del diccionario (incluidas las formas `_one` / `_other`). */
export type MessageKey = keyof typeof es
