# Spec 001 — Pedidos en tiempo real · Requisitos

**Estado:** APROBADO (2026-10-24) · **Versión:** 2.1
**Historial:** v2.1 ajusta R3.2, R3.4, R6 y RNF7 según el diseño (D-083, D-097, D-104, D-114, D-117, D-124); se aprueba junto con `diseno.md`. v2 aprobada el 2026-10-12 (commit `fd88198`). v1 aprobada el 2026-10-11 (commit `f60b2d4`). La v2 alinea el contrato con la spec del front `001-menu-cliente` (D-038, D-042 a D-060; comparativa en `alineacion-front.md`).

## Objetivo
Backend del sistema de pedidos: el cliente, desde la mesa (QR), ve la carta, envía su pedido y sigue su estado en tiempo real; el personal del restaurante recibe los pedidos al instante y los hace avanzar. Esta spec define el comportamiento de la API REST y del canal WebSocket que consumen la vista del cliente (spec del front 001) y el panel de cocina y salón (spec del front 002). El contrato sigue `plan.md` §6–§7.4 del front (D-042 a D-055). El producto apunta a varios restaurantes (D-019, D-045).

## Usuarios / roles
| Rol | Qué necesita |
|---|---|
| Cliente (sin login; se identifica por la mesa del QR y por los pedidos que guarda su dispositivo, D-044) | Ver la carta, validar su mesa, enviar un pedido sin duplicarlo, seguir sus pedidos en tiempo real y cancelarlo mientras esté `pending` (D-048) |
| Personal del restaurante (un único rol con login de Supabase Auth, D-009, D-027; pertenece a un solo restaurante, D-028) | Ver todos los pedidos de su restaurante en tiempo real y cambiar su estado |
| Frontend (vista del cliente y panel) | Contrato tipado en inglés, idéntico al del plan del front (D-043) |

## Alcance
**Incluye:**
- Carta de un restaurante con categorías, platos, grupos de opciones, opciones con adicional, etiquetas, imagen, destacados, orden y textos ES/EN (D-046).
- Validación de mesas por restaurante (D-059).
- Creación de pedidos con validación de líneas, reconfirmación de precio (D-049), idempotencia (D-050), código corto, notas e historial de estados (D-051), dentro de una transacción.
- Cambios de estado por el personal, con control de concurrencia (D-047, D-052, D-060).
- Cancelación por el personal y por el cliente (D-048, D-058).
- Lectura de pedidos con filtros (D-055).
- Canal WebSocket con el protocolo del front: eventos, heartbeat, códigos de cierre (D-042).
- Login del personal con Supabase Auth (D-009, D-056) y separación por restaurante (D-019).
- Entidades: `Restaurant`, `Table`, `Category`, `Dish`, `OptionGroup`, `Option`, `Order`, `OrderItem` (con sus opciones elegidas) y la pertenencia del personal a su restaurante.

**No incluye:**
- Las pantallas (frontend).
- Pagos, propinas y división de cuenta.
- Cuentas o login de clientes.
- ABM de la carta, de mesas, de restaurantes y de personal: se cargan por seed o desde el panel de Supabase (D-027, D-028). Tampoco la generación de los códigos QR.
- "Llamar al mozo" (`table.call_waiter`): solo queda reservado en el protocolo (R9.8).
- Horarios del restaurante (se asume siempre abierto, S11), reservas, stock.
- Notificaciones fuera de la aplicación (SMS, email, push), reportes y estadísticas.

## Requisitos funcionales

### R1 — Consultar la carta
**Historia:** Como cliente, quiero ver la carta del restaurante con sus opciones, para elegir y personalizar lo que pido.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R1.1 CUANDO se solicita `GET /api/menu?restaurant=<slug>` de un restaurante existente, EL SISTEMA DEBERÁ responder 200 con `{ categories, dishes }` según el tipo `Menu` del contrato (`plan.md` del front §6): categorías con nombre ES/EN, orden y visual; platos con categoría, orden, nombre y descripción ES/EN, `priceCents`, `imageUrl` opcional, etiquetas, `available`, `featured` y grupos de opciones (tipo `single`/`multiple`, `min`, `max`, opciones con nombre ES/EN, `priceDeltaCents` y `available`).
- R1.2 EL SISTEMA DEBERÁ incluir los platos y las opciones no disponibles marcados con `available: false`, para que el front los muestre como "Agotado" (RF13 y RF15 del front).
- R1.3 EL SISTEMA NO DEBERÁ incluir datos de otros restaurantes.
- R1.4 SI falta `restaurant` o tiene un formato inválido, ENTONCES EL SISTEMA DEBERÁ responder 400 `VALIDATION`.
- R1.5 SI el slug no corresponde a ningún restaurante, ENTONCES EL SISTEMA DEBERÁ responder 404 `NOT_FOUND`.
- R1.6 EL SISTEMA DEBERÁ responder los textos traducidos como `{ es, en? }`, con `es` obligatorio (D-046).
- R1.7 EL SISTEMA DEBERÁ permitir esta consulta sin iniciar sesión.

### R2 — Validar la mesa
**Historia:** Como cliente, quiero que la app confirme que la mesa del QR existe, para no enviar pedidos a una mesa equivocada.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R2.1 CUANDO se solicita `GET /api/tables/{tableId}?restaurant=<slug>` con una mesa existente y activa de ese restaurante, EL SISTEMA DEBERÁ responder 200 `{ id }` (D-059).
- R2.2 SI la mesa no existe, está inactiva o pertenece a otro restaurante, ENTONCES EL SISTEMA DEBERÁ responder 404 `NOT_FOUND`.
- R2.3 SI `tableId` no es un entero positivo o falta `restaurant`, ENTONCES EL SISTEMA DEBERÁ responder 400 `VALIDATION`.
- R2.4 EL SISTEMA DEBERÁ permitir esta consulta sin iniciar sesión.

### R3 — Crear un pedido
**Historia:** Como cliente, quiero enviar mi pedido una sola vez y con el precio que acepté, para que la cocina lo prepare sin errores ni duplicados.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R3.1 CUANDO se envía `POST /api/orders` con el header `Idempotency-Key` y un cuerpo `CreateOrderInput` válido (`restaurant`, `clientRequestId`, `tableId`, `items[{ lineId, dishId, quantity, selection, note? }]`, `note?`, `expectedTotalCents`), EL SISTEMA DEBERÁ registrar el pedido y responder 201 con el `Order` completo.
- R3.2 EL SISTEMA DEBERÁ validar primero `restaurant`, el header `Idempotency-Key` y `clientRequestId` (formato y coincidencia; si fallan, 400 `VALIDATION`). SI ese `clientRequestId` ya está registrado en el restaurante, ENTONCES EL SISTEMA DEBERÁ resolver según R3.10 y R3.11, sin aplicar las validaciones siguientes, aunque la carta o la mesa hayan cambiado. SI no está registrado, EL SISTEMA DEBERÁ validar en este orden y detenerse en el primer rechazo: mesa (R3.3) → forma (R3.4) → líneas (R3.5) → precio (R3.7) (`plan.md` del front §7.3, regla 6; D-083).
- R3.3 SI la mesa no existe, está inactiva o es de otro restaurante, ENTONCES EL SISTEMA DEBERÁ responder 422 `INVALID_TABLE`.
- R3.4 SI la forma es inválida (campos faltantes, ítems vacíos, más de 50 líneas, cantidad fuera de 1–20 en alguna línea, nota de línea de más de 140 caracteres visibles, nota general de más de 200, `Idempotency-Key` distinta del `clientRequestId`, `lineId` repetido en el mismo pedido), ENTONCES EL SISTEMA DEBERÁ responder 400 `VALIDATION` indicando el campo, sin exponer detalles internos (D-054, D-051, D-114). Los caracteres visibles se cuentan como los cuenta el front: un emoji vale uno.
- R3.5 SI alguna línea refiere a un plato inexistente o no disponible, a una opción inexistente o no disponible, o tiene una selección que no respeta el mínimo o el máximo de un grupo, ENTONCES EL SISTEMA DEBERÁ responder 422 `LINES_REJECTED` con `details.lines[]` (`lineId`, `dishId`, `reason` y, si aplica, `groupId`/`optionId`) y no registrar nada. Valores de `reason`: `dish_not_found`, `dish_unavailable`, `option_not_found`, `option_unavailable`, `selection_invalid`.
- R3.6 EL SISTEMA DEBERÁ calcular el importe de cada línea como (precio base del plato + adicionales de las opciones elegidas) × cantidad, y el total como la suma de las líneas, usando solo precios guardados en el sistema, en centavos enteros (D-053).
- R3.7 SI el total calculado difiere de `expectedTotalCents`, ENTONCES EL SISTEMA DEBERÁ responder 409 `PRICE_CHANGED` con `details.totalCents` y `details.priceLines[{ lineId, unitPriceCents }]`, y no registrar nada (D-049).
- R3.8 CUANDO se registra un pedido, EL SISTEMA DEBERÁ guardar estado `pending`, `createdAt` y `updatedAt`, una primera entrada en `statusHistory`, la mesa, la nota general y, por línea, una copia del nombre del plato y de las opciones en ES/EN, la cantidad, la nota, el precio unitario y el adicional de cada opción vigentes en ese momento. Esos valores no cambian si después cambia la carta (D-051).
- R3.9 CUANDO se registra un pedido, EL SISTEMA DEBERÁ asignarle un código de 4 caracteres del alfabeto `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, único entre los pedidos de ese restaurante creados en las últimas 24 horas. Ante una coincidencia, genera otro (D-051).
- R3.10 CUANDO llega un `clientRequestId` ya registrado con el mismo contenido canónico, EL SISTEMA DEBERÁ responder 200 con el pedido original, sin registrar otro ni emitir eventos (D-050).
- R3.11 CUANDO llega un `clientRequestId` ya registrado con contenido distinto, EL SISTEMA DEBERÁ responder 409 `IDEMPOTENCY_CONFLICT`.
- R3.12 EL SISTEMA DEBERÁ guardar la clave de idempotencia solo cuando el pedido se registra, y conservarla al menos 24 horas. Un rechazo (R3.3 a R3.7) no guarda la clave.
- R3.13 EL SISTEMA DEBERÁ validar cada línea por separado, sin fusionar líneas iguales: la fusión la hace el front (D-054).
- R3.14 EL SISTEMA DEBERÁ permitir crear pedidos sin iniciar sesión, y varios pedidos por mesa y por dispositivo.

### R4 — Guardado atómico
**Historia:** Como dueño, quiero que un pedido se guarde completo o no se guarde, para no tener pedidos a medias.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R4.1 CUANDO se registra un pedido, EL SISTEMA DEBERÁ guardar la cabecera, sus líneas y las opciones de cada línea en una única transacción.
- R4.2 SI falla cualquier parte del guardado, ENTONCES EL SISTEMA DEBERÁ deshacer todo, responder 500 `SERVER` con un mensaje genérico, registrar el detalle solo en los logs internos y no emitir eventos.
- R4.3 EL SISTEMA DEBERÁ publicar los eventos de un pedido solo después de confirmada la transacción (COMMIT).

### R5 — Cambiar el estado (personal)
**Historia:** Como cocinero o mozo, quiero avanzar, corregir o cancelar un pedido sin pisarme con un compañero, para que todos vean el estado real.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R5.1 CUANDO el personal autenticado envía `PATCH /api/orders/{id}/status` con `{ status, expectedStatus }` y la transición está permitida, EL SISTEMA DEBERÁ aplicar el cambio, actualizar `updatedAt`, sumar una entrada a `statusHistory` y responder 200 con el `Order`.
- R5.2 EL SISTEMA DEBERÁ manejar únicamente los estados `pending`, `accepted`, `preparing`, `ready`, `delivered` y `cancelled` (D-047).
- R5.3 EL SISTEMA DEBERÁ permitir al personal únicamente estas transiciones:
  - Avanzar un paso: `pending` → `accepted` → `preparing` → `ready` → `delivered`.
  - Retroceder un paso: `accepted` → `pending`, `preparing` → `accepted`, `ready` → `preparing` (D-025, D-060).
  - Cancelar: desde cualquier estado no final → `cancelled` (D-048).
- R5.4 MIENTRAS un pedido esté en `delivered` o `cancelled`, EL SISTEMA DEBERÁ rechazar cualquier cambio de estado.
- R5.5 CUANDO `status` es igual al estado actual, EL SISTEMA DEBERÁ responder 200 con el pedido sin cambios y sin emitir eventos (D-052).
- R5.6 SI el estado actual difiere de `expectedStatus`, ENTONCES EL SISTEMA DEBERÁ responder 409 `STATUS_CONFLICT` con `details.order` (el pedido actual) y no modificarlo (D-052).
- R5.7 SI la transición no está permitida (R5.3, R5.4), ENTONCES EL SISTEMA DEBERÁ responder 409 `INVALID_TRANSITION` y no modificar el pedido.
- R5.8 SI `status` o `expectedStatus` no pertenecen a R5.2, ENTONCES EL SISTEMA DEBERÁ responder 400 `VALIDATION`.
- R5.9 SI el pedido no existe o es de otro restaurante que el del usuario, ENTONCES EL SISTEMA DEBERÁ responder 404 `NOT_FOUND` sin revelar su existencia.
- R5.10 CUANDO dos cambios simultáneos llegan sobre el mismo pedido, EL SISTEMA DEBERÁ aplicar como máximo uno con el mismo `expectedStatus` y responder `STATUS_CONFLICT` al otro.

### R6 — Cancelación por el cliente
**Historia:** Como cliente, quiero cancelar mi pedido si la cocina todavía no lo confirmó, para no recibir algo que ya no quiero.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R6.1 CUANDO un cliente pide cancelar un pedido indicando su `clientRequestId` y el pedido está en `pending`, EL SISTEMA DEBERÁ pasarlo a `cancelled`, actualizar `updatedAt` y `statusHistory` y responder 200 con el `Order` (D-048, D-058).
- R6.2 SI el pedido no está en `pending`, ENTONCES EL SISTEMA DEBERÁ responder 409 `INVALID_TRANSITION` con el estado actual y no modificarlo.
- R6.3 SI el pedido no existe o el `clientRequestId` no coincide con el del pedido, ENTONCES EL SISTEMA DEBERÁ responder 404 `NOT_FOUND` sin revelar su existencia.
- R6.4 EL SISTEMA DEBERÁ permitir la cancelación por el cliente sin iniciar sesión.
- La ruta es `POST /api/orders/{id}/cancel` con `{ clientRequestId }` (D-097); hay que acordarla con el compañero porque no existe en el contrato actual del front.

### R7 — Eventos de pedidos
**Historia:** Como cocina, quiero ver los pedidos nuevos y cada cambio; como cliente, quiero ver el estado de mi pedido sin recargar.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R7.1 CUANDO se registra un pedido, EL SISTEMA DEBERÁ emitir `order.created` con `{ order }` a las conexiones del personal de ese restaurante y a las conexiones suscritas a la mesa del pedido.
- R7.2 CUANDO cambia el estado de un pedido (R5 o R6), EL SISTEMA DEBERÁ emitir `order.status_changed` con `{ order, previousStatus }` a los mismos destinatarios que R7.1.
- R7.3 EL SISTEMA NO DEBERÁ enviar eventos de un pedido a conexiones de otras mesas ni de otros restaurantes.
- R7.4 SI no hay nadie conectado, ENTONCES EL SISTEMA DEBERÁ registrar el pedido o el cambio igualmente; los consumidores lo recuperan con R10.

### R8 — Acceso del personal
**Historia:** Como dueño, quiero que solo mi personal cambie estados y vea todos los pedidos del restaurante.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R8.1 SI se invoca `PATCH /api/orders/{id}/status` sin un token válido de Supabase Auth, ENTONCES EL SISTEMA DEBERÁ responder 401 y no modificar el pedido.
- R8.2 SI una conexión WebSocket pide el alcance del personal sin un token válido, ENTONCES EL SISTEMA DEBERÁ rechazarla sin enviarle eventos. El código de cierre se define en el diseño.
- R8.3 SI una consulta de pedidos abarca todo el restaurante (sin `ids`, `tableId` ni `clientRequestId`) y no trae un token válido del personal de ese restaurante, ENTONCES EL SISTEMA DEBERÁ responder 401 (R10.4).
- R8.4 SI el token expira con la conexión WebSocket abierta, ENTONCES EL SISTEMA DEBERÁ dejar de enviarle eventos del restaurante hasta que se vuelva a autenticar. El mecanismo se define en el diseño.
- R8.5 EL SISTEMA DEBERÁ tratar a todo el personal con un único rol, y cada usuario del personal deberá pertenecer a exactamente un restaurante (D-027, D-028).

### R9 — Canal en tiempo real
**Historia:** Como front, quiero un canal estable con reglas claras de reconexión, para no perder ni duplicar avisos.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R9.1 EL SISTEMA DEBERÁ aceptar conexiones WebSocket en `/ws/orders` con dos alcances: por mesas (`restaurant=<slug>&tableId=12&tableId=5`) o de personal (`restaurant=<slug>&scope=staff` más el token, R8.2) (D-042, D-045).
- R9.2 EL SISTEMA DEBERÁ usar en ambos sentidos el sobre `{ v: 1, id, type, ts, payload }`, con `id` único por mensaje.
- R9.3 CUANDO una conexión se acepta, EL SISTEMA DEBERÁ enviar primero `system.welcome` con `{ connectionId, heartbeatSec, subscription }`.
- R9.4 SI los parámetros son inválidos, ENTONCES EL SISTEMA DEBERÁ cerrar con 4400; SI alguna mesa no existe en ese restaurante, ENTONCES EL SISTEMA DEBERÁ cerrar con 4404. Las conexiones de un `Origin` no permitido se rechazan.
- R9.5 EL SISTEMA DEBERÁ enviar `system.ping` cada 25 segundos y, SI no recibe `system.pong` durante dos intervalos, ENTONCES DEBERÁ cerrar la conexión con 4408.
- R9.6 SI recibe un mensaje inválido, ENTONCES EL SISTEMA DEBERÁ responder `system.error` (`BAD_MESSAGE`) sin cerrar la conexión.
- R9.7 EL SISTEMA DEBERÁ ignorar los tipos de mensaje que no conoce.
- R9.8 CUANDO recibe `table.call_waiter`, EL SISTEMA DEBERÁ responder `system.error` con `NOT_IMPLEMENTED`: queda reservado para la spec 002 del front.

### R10 — Consultar pedidos
**Historia:** Como cliente quiero recuperar mis pedidos al volver; como personal quiero resincronizar el panel después de una reconexión.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R10.1 CUANDO se solicita `GET /api/orders?restaurant=<slug>` con filtros, EL SISTEMA DEBERÁ responder 200 `Order[]` de ese restaurante. Filtros combinables: `ids=a,b`, `tableId` (repetible), `status=pending,accepted`, `since=<ISO>` (`updatedAt` posterior) y `clientRequestId=<id>`. Los ids inexistentes se omiten sin error (D-055).
- R10.2 CUANDO se filtra por `tableId` sin `ids`, `since` ni `clientRequestId`, EL SISTEMA DEBERÁ devolver solo los pedidos creados en las últimas 12 horas.
- R10.3 EL SISTEMA DEBERÁ permitir sin login las consultas que incluyan `ids`, `tableId` o `clientRequestId`. Es el riesgo aceptado en D-044.
- R10.4 Las consultas de todo el restaurante (solo `status` o `since`) requieren el token del personal (R8.3).
- R10.5 SI los filtros tienen un formato inválido, ENTONCES EL SISTEMA DEBERÁ responder 400 `VALIDATION`; SI el restaurante no existe, ENTONCES EL SISTEMA DEBERÁ responder 404 `NOT_FOUND`.

### R11 — Separación por restaurante
**Historia:** Como dueño, quiero que mi carta, mis mesas, mis pedidos y mis avisos sean solo míos.
**Prioridad:** Must

**Criterios de aceptación (EARS):**
- R11.1 EL SISTEMA DEBERÁ asociar cada categoría, plato, mesa, pedido y usuario del personal a exactamente un restaurante, identificado por un slug único.
- R11.2 EL SISTEMA DEBERÁ responder y emitir solo datos del restaurante correspondiente (R1, R2, R3, R5, R7, R9, R10).
- R11.3 SI un pedido incluye platos de otro restaurante, ENTONCES EL SISTEMA DEBERÁ rechazar esas líneas como `dish_not_found` (R3.5).

## Requisitos no funcionales
| ID | Tipo | Requisito medible |
|---|---|---|
| RNF1 | Rendimiento | `GET /api/menu` responde en menos de 500 ms (p95) con una carta de hasta 200 platos (D-032) |
| RNF2 | Rendimiento | Desde el COMMIT hasta que el evento sale hacia las conexiones suscritas pasa menos de 1 s en condiciones normales (D-032) |
| RNF3 | Escalabilidad | Pool de conexiones configurable: `DATABASE_URL` con pooling para la app y `DIRECT_URL` para las migraciones. Datos de conexión solo por variables de entorno (D-017) |
| RNF4 | Escala inicial | Un servidor, hasta 10 restaurantes y 50 pedidos activos por local al mismo tiempo, cumpliendo RNF1 y RNF2 (D-033) |
| RNF5 | Integridad | Ningún pedido con líneas incompletas ni con un total distinto de la suma de sus líneas; ningún pedido duplicado por reintento (verificable con pruebas) |
| RNF6 | Seguridad | Toda entrada externa (REST y mensajes WebSocket) se valida con Zod (D-016). Los errores no exponen detalles internos ni credenciales |
| RNF7 | Seguridad | Límite por IP: 120 por minuto en `GET /api/menu`, 20 por minuto en `POST /api/orders` y 20 por minuto en `POST /api/orders/{id}/cancel`, con contador propio (D-032, D-104, D-117) |
| RNF8 | Privacidad | No se guardan datos personales del cliente. Los pedidos se conservan indefinidamente (D-034). Las notas son texto libre del cliente. Las credenciales nunca se registran en logs |
| RNF9 | Calidad | Cada criterio R#.# tiene al menos una prueba automática (Vitest + Supertest; WebSocket con un cliente `ws` de prueba) (D-016) |
| RNF10 | Contrato | Todo en inglés (D-043): JSON en camelCase, importes en centavos enteros, fechas ISO 8601 UTC. Errores con la forma `{ code, message, details? }` y los códigos de `ServiceErrorCode` del front. Los tipos coinciden con `plan.md` del front §6–§7.4 |
| RNF11 | Consistencia | Los eventos salen solo después del COMMIT. Con `since` sobre `updatedAt` (R10.1), un consumidor que se reconecta recupera todo lo que se perdió |

## Supuestos (confirmados al aprobar la v2)
- [x] S1: Pesos argentinos (ARS) en centavos enteros, con impuestos incluidos y sin propina (D-053).
- [x] S2: El estado inicial es `pending`. Los estados son los seis de R5.2 (D-047).
- [x] S3: El contenido de un pedido no se modifica después de creado; solo cambia el estado.
- [x] S4: Los platos y las opciones no disponibles se informan en la carta con `available: false`, y no se pueden pedir.
- [x] S5: Un único rol de personal: cocina y salón tienen los mismos permisos (D-027).
- [x] S6: Del cliente no se guarda ningún dato personal. Se lo reconoce por la mesa y por los `id`/`clientRequestId` que guarda su dispositivo (D-044).
- [x] S7: El servidor siempre calcula los precios; `expectedTotalCents` solo se compara con su cálculo (D-049).
- [x] S8: Las pantallas quedan fuera de esta spec.
- [x] S9: El cliente solo puede cancelar un pedido propio en `pending`, demostrándolo con su `clientRequestId` (D-058).
- [x] S10: Todo el contrato y el código van en inglés (D-043).
- [x] S11: El restaurante está siempre abierto: no hay horarios ni cierre de cocina (como en el supuesto 7 del front).

## Interpretaciones del equipo (confirmadas al aprobar)
- I1: El código corto es único **por restaurante** en 24 horas (el front no distingue restaurantes).
- I2: El cliente solo puede consultar pedidos indicando `ids`, `tableId` o `clientRequestId`. Las consultas de todo el restaurante requieren login del personal (R8.3, R10.3, R10.4).
- I3: El `restaurant` se indica como parámetro de consulta (`?restaurant=`) en las rutas GET y en el WebSocket, y como campo del cuerpo en `POST /api/orders` (D-026 con el nombre en inglés, D-045).
- I4: El precio unitario de una línea guardado en el pedido incluye los adicionales de las opciones; cada opción guarda además su propio adicional.

## Decisiones que reemplaza la v2
- D-005, en parte: Socket.IO → `ws` (D-042).
- D-012 y D-013: español → todo en inglés (D-043).
- D-020: nombres de estados → D-047.
- D-021 y D-036: eventos en español → `order.created` y `order.status_changed` (R7).
- D-022 y D-031: UUID → mesa + dispositivo (D-044).
- D-024: cancelación → D-048.
- D-029 y D-037: lecturas → `GET /api/orders` con filtros (D-055).
- D-030: límites → D-054.
- D-034: sin notas → con notas (D-051).

## Aprobación
- [x] v1 aprobada por el usuario · Fecha: 2026-10-11
- [x] v2 aprobada por el usuario · Fecha: 2026-10-12 (incluye S1–S11 e I1–I4)
- [x] v2.1 aprobada por el usuario junto con `diseno.md` v1.1 · Fecha: 2026-10-24 (D-127)
