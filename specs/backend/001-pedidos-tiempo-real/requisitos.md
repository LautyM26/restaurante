# Spec 001 — Pedidos en tiempo real · Requisitos

**Estado:** APROBADO (2026-10-11) · **Versión:** 1

## Objetivo
Permitir que los clientes de un restaurante vean el menú, envíen un pedido y sigan su estado en tiempo real, y que el personal del restaurante vea los pedidos entrantes en tiempo real y los avance de estado. Esta spec cubre el **backend**: el comportamiento de la API REST y de los eventos de tiempo real que consumen la Vista Cliente y la Vista Restaurante (esas vistas son del frontend). El producto apunta a varios restaurantes (D-019).

## Usuarios / roles
| Rol | Qué necesita |
|---|---|
| Cliente (sin login, D-009; se identifica con un UUID anónimo, D-022) | Ver el menú, enviar un pedido, cancelarlo mientras esté pendiente y recibir avisos sobre el estado de su comida |
| Personal del restaurante (cocinero / encargado / dueño; un único rol con login, D-009, D-027; pertenece a un solo restaurante, D-028) | Ver la cola de pedidos de su restaurante en tiempo real, avanzar o retroceder su estado y cancelarlos |
| Frontend (Vista Cliente / Vista Restaurante) | Consumir la API y los eventos con un contrato claro (nombres en español, D-012) |

## Alcance
**Incluye:**
- Consulta del menú de un restaurante (productos disponibles), indicado por slug (D-026).
- Creación de un pedido: cálculo del total en el servidor, estado inicial `pendiente`, guardado atómico (todo o nada), límites de cantidades (D-030).
- Cambio de estado por el personal: avanzar un paso, retroceder un paso y cancelar (D-023, D-024, D-025).
- Cancelación por el cliente mientras el pedido esté `pendiente` (D-024).
- Avisos en tiempo real: `nuevo_pedido` al personal del restaurante; `actualizacion_pedido` al cliente y al personal en cada cambio de estado (D-021, D-036).
- Lecturas: pedidos activos del restaurante (personal) y pedidos del cliente en un restaurante (D-029, D-037).
- Acceso restringido al personal (Supabase Auth, D-009) para las acciones del restaurante.
- Separación de los datos por restaurante (D-019).
- Entidades: Restaurante, Producto, Pedido y Pedido_Detalle (con el precio unitario congelado al momento de la compra), más la pertenencia del personal a su restaurante.

**No incluye:**
- Las pantallas Vista Cliente y Vista Restaurante (frontend, otra persona).
- Pagos, propinas, cupones o facturación.
- Login o cuentas de clientes.
- Alta, baja y edición de productos (ABM del menú): el menú se carga con un seed; el ABM va en una spec futura (D-027).
- Alta de restaurantes y de personal: se hace a mano, con seed o desde el panel de Supabase (D-028).
- Modalidad de entrega (delivery, retiro o mesa) y sus datos (dirección, mesa): spec futura (D-031).
- Datos personales del cliente más allá de `cliente_id` (D-034).
- Usuarios del personal en más de un restaurante (D-028).
- Notificaciones fuera de la aplicación (SMS, email, push).
- Historial, reportes o estadísticas.

## Requisitos funcionales

### R1 — Consultar el menú
**Historia:** Como cliente, quiero ver los productos disponibles del restaurante, para elegir qué pedir.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R1.1 CUANDO se solicita `GET /menu?restaurante=<slug>` con el slug de un restaurante existente, EL SISTEMA DEBERÁ responder éxito con los productos de ese restaurante que tengan `disponible = true`, cada uno con `id`, `nombre`, `descripcion` y `precio`.
- R1.2 EL SISTEMA NO DEBERÁ incluir en la respuesta de R1.1 productos con `disponible = false` ni productos de otros restaurantes.
- R1.3 SI falta el parámetro `restaurante` o tiene un formato inválido, ENTONCES EL SISTEMA DEBERÁ responder con un error de validación.
- R1.4 SI el slug no corresponde a ningún restaurante, ENTONCES EL SISTEMA DEBERÁ responder que no se encontró, sin datos de otros restaurantes.
- R1.5 SI el restaurante no tiene productos disponibles, ENTONCES EL SISTEMA DEBERÁ responder éxito con una lista vacía.
- R1.6 EL SISTEMA DEBERÁ permitir `GET /menu` sin iniciar sesión.

### R2 — Crear un pedido
**Historia:** Como cliente, quiero enviar mi carrito como pedido, para que el restaurante lo prepare.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R2.1 CUANDO se envía `POST /orders` con `restaurante` (slug), `cliente_id` (UUID) e ítems (`producto_id`, `cantidad`) válidos, EL SISTEMA DEBERÁ crear el pedido con estado `pendiente`, registrar la fecha de creación (`creado_en`) y responder éxito con el id del pedido, su estado y su total.
- R2.2 CUANDO se crea un pedido, EL SISTEMA DEBERÁ calcular el total como la suma de (precio vigente del producto × cantidad) de cada ítem, usando solo los precios guardados en el sistema.
- R2.3 EL SISTEMA DEBERÁ ignorar cualquier precio o total enviado por el cliente.
- R2.4 CUANDO se crea un pedido, EL SISTEMA DEBERÁ guardar por cada producto la cantidad y el `precio_unitario` vigente en ese momento, y ese valor no deberá cambiar si después cambia el precio del producto.
- R2.5 CUANDO el carrito contiene el mismo producto más de una vez, EL SISTEMA DEBERÁ sumar las cantidades en un único detalle (D-030).
- R2.6 SI el carrito está vacío, ENTONCES EL SISTEMA DEBERÁ rechazar el pedido con un error de validación y no crear nada.
- R2.7 SI algún ítem tiene una cantidad que no sea un entero mayor o igual a 1, ENTONCES EL SISTEMA DEBERÁ rechazar el pedido completo con un error de validación y no crear nada.
- R2.8 SI la cantidad de un producto (después de sumar los repetidos, R2.5) supera 20, ENTONCES EL SISTEMA DEBERÁ rechazar el pedido completo con un error de validación y no crear nada (D-030).
- R2.9 SI el carrito tiene más de 50 ítems (líneas del carrito), ENTONCES EL SISTEMA DEBERÁ rechazar el pedido completo con un error de validación y no crear nada (D-030).
- R2.10 SI algún ítem refiere a un producto inexistente, no disponible o de otro restaurante, ENTONCES EL SISTEMA DEBERÁ rechazar el pedido completo indicando qué ítem es el problema y no crear nada.
- R2.11 SI `cliente_id` no es un UUID válido, ENTONCES EL SISTEMA DEBERÁ rechazar el pedido con un error de validación (D-022).
- R2.12 SI el slug de `restaurante` no corresponde a ningún restaurante, ENTONCES EL SISTEMA DEBERÁ responder que no se encontró y no crear nada.
- R2.13 SI la solicitud tiene datos faltantes o con formato inválido, ENTONCES EL SISTEMA DEBERÁ responder un error de validación que indique qué campo falla, sin exponer detalles internos.
- R2.14 EL SISTEMA DEBERÁ permitir `POST /orders` sin iniciar sesión.
- R2.15 EL SISTEMA DEBERÁ asociar el pedido al `cliente_id` y al restaurante indicados, y permitir que un mismo `cliente_id` tenga varios pedidos activos a la vez (D-030).

### R3 — Guardado atómico del pedido
**Historia:** Como dueño, quiero que un pedido se guarde completo o no se guarde, para no tener pedidos a medias.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R3.1 CUANDO se crea un pedido, EL SISTEMA DEBERÁ guardar la cabecera (Pedido) y todos sus detalles (Pedido_Detalle) como una única operación indivisible (transacción).
- R3.2 SI falla el guardado de cualquier detalle, ENTONCES EL SISTEMA DEBERÁ deshacer todo el pedido (sin cabecera ni detalles parciales), responder un error y NO emitir `nuevo_pedido`.
- R3.3 SI el guardado falla, ENTONCES EL SISTEMA DEBERÁ devolver un mensaje genérico al cliente y registrar el detalle del error solo en los registros internos.

### R4 — Avisar al restaurante de un pedido nuevo
**Historia:** Como cocinero, quiero ver los pedidos nuevos apenas entran, para empezar a prepararlos sin recargar.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R4.1 CUANDO un pedido se crea con éxito, EL SISTEMA DEBERÁ emitir el evento `nuevo_pedido` a todas las conexiones del personal autenticado del restaurante al que pertenece el pedido.
- R4.2 EL evento `nuevo_pedido` DEBERÁ incluir como mínimo: id del pedido, estado, total, fecha de creación y los ítems (nombre del producto, cantidad, precio unitario).
- R4.3 EL SISTEMA NO DEBERÁ enviar `nuevo_pedido` a clientes ni al personal de otros restaurantes.
- R4.4 SI no hay personal conectado en ese momento, ENTONCES EL SISTEMA DEBERÁ guardar el pedido igualmente y responder éxito al cliente (el personal lo recupera con R9.1).

### R5 — Cambiar el estado de un pedido (personal)
**Historia:** Como cocinero, quiero marcar el avance de un pedido, corregir un error o cancelarlo, para que el restaurante y el cliente sepan en qué punto está.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R5.1 CUANDO el personal autenticado envía `PATCH /orders/:id/status` con un estado válido y una transición permitida, EL SISTEMA DEBERÁ actualizar el estado del pedido y responder éxito con el pedido actualizado.
- R5.2 EL SISTEMA DEBERÁ aceptar únicamente los estados `pendiente`, `en_preparacion`, `listo_en_camino`, `entregado` y `cancelado` (D-020, D-023).
- R5.3 EL SISTEMA DEBERÁ permitir al personal únicamente estas transiciones:
  - Avanzar un paso: `pendiente` → `en_preparacion` → `listo_en_camino` → `entregado`.
  - Retroceder un paso: `en_preparacion` → `pendiente`; `listo_en_camino` → `en_preparacion` (D-025).
  - Cancelar: `pendiente` → `cancelado`; `en_preparacion` → `cancelado` (D-024).
- R5.4 MIENTRAS un pedido esté en `entregado` o `cancelado`, EL SISTEMA DEBERÁ rechazar cualquier cambio de estado sobre él (estados finales, D-025).
- R5.5 SI el estado enviado no pertenece a la lista de R5.2, ENTONCES EL SISTEMA DEBERÁ rechazar la solicitud con un error de validación y no modificar el pedido.
- R5.6 SI la transición pedida no está permitida (R5.3, R5.4), ENTONCES EL SISTEMA DEBERÁ rechazar la solicitud con un error que indique el estado actual y no modificar el pedido.
- R5.7 SI el pedido no existe, ENTONCES EL SISTEMA DEBERÁ responder que no se encontró.
- R5.8 SI el pedido pertenece a un restaurante distinto del usuario autenticado, ENTONCES EL SISTEMA DEBERÁ responder como si no existiera (sin revelar su existencia) y no modificarlo.
- R5.9 CUANDO se cambia el estado, EL SISTEMA DEBERÁ aplicar el cambio de forma que dos cambios simultáneos sobre el mismo pedido no dejen un estado inconsistente ni una transición no permitida.

### R6 — Avisar los cambios de estado
**Historia:** Como cliente, quiero recibir avisos sobre mi comida, para saber cuándo estará lista; como cocinero, quiero ver los cambios hechos desde otras pantallas o por el cliente, para no preparar un pedido cancelado.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R6.1 CUANDO cambia el estado de un pedido (por el personal, R5, o por el cliente, R10), EL SISTEMA DEBERÁ emitir `actualizacion_pedido` al cliente dueño del pedido (su `cliente_id`) (D-021).
- R6.2 CUANDO cambia el estado de un pedido, EL SISTEMA DEBERÁ emitir también `actualizacion_pedido` a todas las conexiones del personal autenticado del restaurante del pedido (D-036).
- R6.3 EL evento `actualizacion_pedido` DEBERÁ incluir como mínimo el id del pedido y el nuevo estado.
- R6.4 EL SISTEMA DEBERÁ entregar `actualizacion_pedido` únicamente al cliente dueño del pedido y al personal de ese restaurante, y a ninguna otra conexión.
- R6.5 CUANDO un cliente se conecta al canal de tiempo real indicando su `cliente_id`, EL SISTEMA DEBERÁ enviarle desde ese momento los avisos de sus pedidos, aunque su conexión sea nueva (reconexión) (D-022).
- R6.6 SI el cliente no está conectado cuando cambia el estado, ENTONCES EL SISTEMA DEBERÁ guardar el cambio igualmente sin devolver error al personal (el cliente lo recupera con R9.2).

### R7 — Acceso del personal
**Historia:** Como dueño, quiero que solo mi personal pueda ver y mover los pedidos de mi restaurante, para que nadie ajeno los manipule.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R7.1 SI se invoca `PATCH /orders/:id/status` sin credenciales válidas, ENTONCES EL SISTEMA DEBERÁ rechazar la solicitud como no autenticada y no modificar el pedido.
- R7.2 SI se solicitan los pedidos activos del restaurante (R9.1) sin credenciales válidas, ENTONCES EL SISTEMA DEBERÁ rechazar la solicitud como no autenticada.
- R7.3 SI una conexión de tiempo real intenta identificarse como personal del restaurante sin credenciales válidas, ENTONCES EL SISTEMA DEBERÁ rechazarla y no enviarle eventos del restaurante.
- R7.4 SI las credenciales son válidas pero el usuario no pertenece al restaurante del pedido, ENTONCES EL SISTEMA DEBERÁ actuar según R5.8.
- R7.5 SI las credenciales expiran mientras la conexión de tiempo real sigue abierta, ENTONCES EL SISTEMA DEBERÁ dejar de enviarle eventos del restaurante hasta que se vuelva a autenticar (el mecanismo exacto se define en el diseño).
- R7.6 EL SISTEMA DEBERÁ tratar a todo el personal con un único rol con los mismos permisos (D-027), y cada usuario del personal deberá pertenecer a exactamente un restaurante (D-028).

### R8 — Separación por restaurante
**Historia:** Como dueño de un restaurante, quiero que mis productos, pedidos y avisos sean solo míos, para que el producto sirva a varios locales sin mezclar datos.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R8.1 EL SISTEMA DEBERÁ asociar cada producto, cada pedido y cada usuario del personal a exactamente un restaurante, identificado por un slug único (D-026, D-028).
- R8.2 EL SISTEMA DEBERÁ responder solo con datos del restaurante correspondiente en el menú, los pedidos, las lecturas y los eventos (R1, R4, R5, R6, R9).
- R8.3 SI se intenta crear un pedido con productos de otro restaurante, ENTONCES EL SISTEMA DEBERÁ rechazarlo (R2.10).
- R8.4 SI un usuario del personal intenta consultar o modificar datos de otro restaurante, ENTONCES EL SISTEMA DEBERÁ denegarlo (R5.8, R7.4).

### R9 — Consultar pedidos
**Historia:** Como cocinero, quiero ver la cola de pedidos al abrir o recargar mi pantalla; como cliente, quiero ver el estado de mis pedidos al volver a la página, para no perder información.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R9.1 CUANDO el personal autenticado solicita los pedidos activos, EL SISTEMA DEBERÁ responder con los pedidos de su restaurante en estado `pendiente`, `en_preparacion` o `listo_en_camino`, ordenados del más antiguo al más nuevo, cada uno con id, estado, total, `creado_en` e ítems (nombre del producto, cantidad, precio unitario) (D-029).
- R9.2 CUANDO un cliente solicita sus pedidos indicando el slug del restaurante y su `cliente_id`, EL SISTEMA DEBERÁ responder con todos los pedidos de ese `cliente_id` en ese restaurante, del más reciente al más antiguo, con id, estado, total, `creado_en` e ítems (D-029, D-037).
- R9.3 EL SISTEMA NO DEBERÁ devolver en R9.2 pedidos de otro `cliente_id` ni de otro restaurante.
- R9.4 SI en R9.2 el `cliente_id` no es un UUID válido o falta el restaurante, ENTONCES EL SISTEMA DEBERÁ responder con un error de validación; SI el restaurante no existe, ENTONCES EL SISTEMA DEBERÁ responder que no se encontró.
- R9.5 SI no hay pedidos que devolver, ENTONCES EL SISTEMA DEBERÁ responder éxito con una lista vacía.
- R9.6 EL SISTEMA DEBERÁ permitir R9.2 sin iniciar sesión.

### R10 — Cancelación por el cliente
**Historia:** Como cliente, quiero cancelar mi pedido si todavía no empezaron a prepararlo, para no recibir algo que ya no quiero.
**Prioridad:** Must (D-035)

**Criterios de aceptación (EARS):**
- R10.1 CUANDO un cliente solicita cancelar un pedido propio identificándose con su `cliente_id` y el pedido está en `pendiente`, EL SISTEMA DEBERÁ pasarlo a `cancelado` y responder éxito (D-024).
- R10.2 SI el pedido no está en `pendiente`, ENTONCES EL SISTEMA DEBERÁ rechazar la cancelación con un error que indique el estado actual y no modificar el pedido.
- R10.3 SI el pedido no existe o el `cliente_id` no coincide con el del pedido, ENTONCES EL SISTEMA DEBERÁ responder que no se encontró (sin revelar su existencia) y no modificarlo.
- R10.4 EL SISTEMA DEBERÁ permitir la cancelación por el cliente sin iniciar sesión.
- R10.5 CUANDO el cliente cancela un pedido, EL SISTEMA DEBERÁ emitir los avisos de R6 (al cliente y al personal del restaurante).

## Requisitos no funcionales
| ID | Tipo | Requisito medible |
|---|---|---|
| RNF1 | Rendimiento | `GET /menu` responde en menos de 500 ms (percentil 95) con un menú de hasta 200 productos (D-032) |
| RNF2 | Rendimiento | Desde que se guarda un pedido hasta que el evento sale hacia el personal conectado pasa menos de 1 s en condiciones normales (D-032) |
| RNF3 | Escalabilidad | La conexión a la base usa un pool de conexiones configurable, con `DATABASE_URL` con pooling para la app y `DIRECT_URL` para las migraciones (D-017). Los datos de conexión vienen de variables de entorno, nunca escritos en el código |
| RNF4 | Escala inicial | El sistema funciona en un solo servidor con hasta 10 restaurantes y 50 pedidos activos por local al mismo tiempo, cumpliendo RNF1 y RNF2 (D-033) |
| RNF5 | Integridad | Ningún pedido queda guardado con detalles incompletos ni con un total distinto de la suma de sus detalles (verificable con pruebas automáticas) |
| RNF6 | Seguridad | Todas las entradas externas (REST y eventos de tiempo real) se validan antes de usarse (Zod, D-016). Los errores no exponen detalles internos ni credenciales |
| RNF7 | Seguridad | Límite de solicitudes por IP: 120 por minuto en `GET /menu` y 20 por minuto en `POST /orders` (D-032) |
| RNF8 | Privacidad | Del cliente solo se guarda `cliente_id` (UUID anónimo). Los pedidos se conservan indefinidamente. Credenciales y claves nunca se registran en logs (D-034) |
| RNF9 | Calidad | Cada criterio R#.# tiene al menos una prueba automática (Vitest + Supertest, D-016) |
| RNF10 | Compatibilidad | Estados, eventos, tablas, campos y parámetros usan nombres en español (D-012); las rutas se mantienen en inglés (S10). El contrato queda documentado para el frontend |
| RNF11 | Disponibilidad | Si la conexión de tiempo real cae, los datos siguen consistentes en la base y tanto el cliente como el personal recuperan el estado al reconectar (R6.5, R9) |

## Supuestos (confirmados por el usuario, D-035)
- [x] S1: Los precios son un valor decimal en una única moneda; no se manejan impuestos ni descuentos.
- [x] S2: El estado inicial de todo pedido es `pendiente`. Los estados son `pendiente`, `en_preparacion`, `listo_en_camino`, `entregado` y `cancelado` (D-020, D-023).
- [x] S3: Un pedido pertenece a un solo restaurante y su contenido no se modifica después de creado (solo cambia el estado).
- [x] S4: Los productos no disponibles no se muestran en el menú, pero siguen existiendo para los pedidos históricos.
- [x] S5: El rol "restaurante" de las conexiones de tiempo real corresponde únicamente al personal con sesión válida. Cocinero, encargado y dueño son el mismo rol (D-027).
- [x] S6: El cliente solo conoce y consulta sus propios pedidos, y se identifica con un UUID anónimo (D-022).
- [x] S7: El total y los precios los calcula siempre el servidor; el cliente nunca los define.
- [x] S8: La interfaz de las vistas (pantallas, textos, diseño) está fuera de esta spec; esta spec define solo el comportamiento de la API y de los eventos.
- [x] S9: El cliente no edita pedidos ya creados; solo puede cancelarlos mientras estén en `pendiente` (D-024).
- [x] S10: Las rutas `/menu`, `/orders` y `/orders/:id/status` son las que pidió el usuario y se mantienen en inglés; estados, eventos, tablas, campos y parámetros (ej. `?restaurante=`) van en español (D-012).

## Preguntas abiertas (resueltas)
- [x] P1: Nombre del estado y quién marca `entregado` → D-020.
- [x] P2: Cuándo recibe el cliente `actualizacion_pedido` → D-021.
- [x] P3: Qué es `cliente_id` → D-022.
- [x] P4: Cómo se identifica el restaurante y quién da de alta restaurantes y personal → D-026, D-028.
- [x] P5: Roles y ABM del menú → D-027.
- [x] P6: Transiciones y cancelación → D-023, D-024, D-025.
- [x] P7: Límites de `POST /orders` → D-030.
- [x] P8: Modalidad de entrega → D-031.
- [x] P9: Endpoints de lectura → D-029, D-037.
- [x] P10: Metas no funcionales y escala → D-032, D-033.
- [x] P11: Datos del cliente y retención → D-034.
- [x] Avisos de cambios de estado al personal → D-036.

> Las rutas de los endpoints nuevos (lecturas de R9 y cancelación del cliente de R10) y la forma de los eventos se definen en la Fase 2 (diseño), con consulta.

## Aprobación
- [x] Aprobado por el usuario · Fecha: 2026-10-11 (incluye las interpretaciones de R2.8/R2.9, R9.1, RNF1 y la entidad Restaurante)
