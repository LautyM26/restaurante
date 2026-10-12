# Spec 001 — Pedidos en tiempo real · Registro de decisiones

> Toda decisión la toma el usuario. Este registro se completa en el momento en que responde.
> Numeración global del proyecto: D-001 a D-019 están en `specs/constitucion.md`; esta spec sigue desde D-020.
> (R) = opción recomendada por el equipo.

| ID | Fase | Pregunta | Opciones presentadas | Elegida por el usuario | Fecha |
|---|---|---|---|---|---|
| D-020 | 1 | P1 · Nombre del estado listo/en camino y quién marca `entregado` | A) `listo_en_camino` y el personal entrega (R) · B) `en_camino` y el personal entrega · C) `listo_en_camino` y el cliente entrega | A: `listo_en_camino`; el personal marca `entregado` | 2026-10-11 |
| D-021 | 1 | P2 · Cuándo recibe el cliente `actualizacion_pedido` | A) En cada cambio de estado (R) · B) Solo en `listo_en_camino` | A: en cada cambio de estado | 2026-10-11 |
| D-022 | 1 | P3 · Qué es `cliente_id` | A) UUID anónimo del navegador (R) · B) Número de mesa · C) Teléfono | A: UUID anónimo que genera el front y guarda en el navegador | 2026-10-11 |
| D-023 | 1 | P6 · Transiciones y cancelación | A) Solo hacia adelante, sin cancelar (R) · B) Adelante + retroceder un paso · C) Adelante + estado `cancelado` | Respuesta libre: "adelante + retroceder + estado cancelado". Detalles en D-024 y D-025 | 2026-10-11 |
| D-024 | 1 | Detalle de D-023 · Quién cancela y hasta qué estado | A) Personal, hasta `en_preparacion` (R) · B) Personal, en cualquier estado salvo `entregado` · C) Personal hasta `en_preparacion` y cliente solo en `pendiente` | C: personal hasta `en_preparacion`; cliente solo mientras esté `pendiente` | 2026-10-11 |
| D-025 | 1 | Detalle de D-023 · Cómo funciona retroceder | A) Un paso; `entregado` y `cancelado` son finales (R) · B) Un paso, también desde estados finales · C) A cualquier estado anterior | A: un paso atrás; `entregado` y `cancelado` no se deshacen | 2026-10-11 |
| D-026 | 1 | P4 · Cómo indica el cliente el restaurante | A) Slug como parámetro (R) · B) Slug en la ruta · C) Subdominio por restaurante | A: `GET /menu?restaurante=<slug>` y `restaurante` en el body de `POST /orders` | 2026-10-11 |
| D-027 | 1 | P5 · Roles y ABM del menú | A) Un rol; ABM en otra spec (R) · B) Un rol; sin ABM previsto · C) Dos roles + ABM en esta spec | A: un solo rol de personal; menú por seed; ABM en una spec futura | 2026-10-11 |
| D-028 | 1 | P4 · Pertenencia del personal y alta | A) 1 restaurante; alta a mano (R) · B) 1 restaurante; alta en esta spec · C) Varios restaurantes; alta a mano | A: un usuario del personal pertenece a 1 restaurante; alta a mano (seed o panel de Supabase) | 2026-10-11 |
| D-029 | 1 | P9 · Endpoints de lectura | A) Dos endpoints: personal y cliente (R) · B) Estado enviado al conectarse por socket · C) Solo lo que pasa en vivo | A: pedidos activos del restaurante (personal) y pedidos del cliente (por UUID) | 2026-10-11 |
| D-030 | 1 | P7 · Límites de `POST /orders` | A) Máx. 20 por ítem, 50 ítems, repetidos se suman, varios activos (R) · B) Mismos límites, repetidos rechazados · C) Sin máximos | A | 2026-10-11 |
| D-031 | 1 | P8 · Modalidad (delivery / retiro / mesa) | A) Sin datos extra; se define después (R) · B) Número de mesa · C) Delivery con dirección y teléfono · D) Modalidad elegible por pedido | A: sin datos extra en esta spec; spec futura | 2026-10-11 |
| D-032 | 1 | P10 · Metas de rendimiento y límite de solicitudes | A) Valores propuestos (R) · B) Más exigentes (200 ms / 500 ms) · C) Sin metas numéricas | A: `GET /menu` < 500 ms p95; evento al personal < 1 s; límite por IP 120/min en `GET /menu` y 20/min en `POST /orders` | 2026-10-11 |
| D-033 | 1 | P10 · Escala inicial | A) Chica: 10 locales, 50 pedidos activos por local (R) · B) Mediana: 100 locales, 200 pedidos · C) Todavía no se sabe | A: hasta 10 restaurantes y 50 pedidos activos por local; un solo servidor | 2026-10-11 |
| D-034 | 1 | P11 · Datos del cliente y retención | A) Solo UUID; sin borrado (R) · B) UUID + nombre y nota opcionales · C) Solo UUID; borrado tras X días | A: solo `cliente_id`; pedidos conservados indefinidamente | 2026-10-11 |
| D-035 | 1 | Supuestos S1–S10 (con S2 y S9 ajustados) y prioridades | A) Confirmar todo · B) Cambiar algo | A: todo confirmado; R1–R10 con prioridad Must | 2026-10-11 |
| D-036 | 1 | ¿El personal recibe en tiempo real los cambios de estado de su restaurante? | A) Sí, con `actualizacion_pedido` (R) · B) Sí, con un evento propio · C) No | A: `actualizacion_pedido` también al personal del restaurante, incluida la cancelación del cliente | 2026-10-11 |
| D-037 | 1 | Qué pedidos ve el cliente en su endpoint de lectura | A) Los del restaurante indicado (R) · B) Todos sus pedidos · C) Solo los activos del restaurante | A: los pedidos de ese UUID en el restaurante indicado (slug), del más reciente al más antiguo | 2026-10-11 |
| D-038 | 1 | Las specs 001 de front y back se contradicen en el contrato | A) Comparativa punto por punto y alinear con el compañero; después reabrir requisitos (v2) (R) · B) Nuestra spec manda · C) La spec del front manda | A | 2026-10-11 |
| D-042 | 1 | A1 · Protocolo de tiempo real (alineacion-front.md) | A) El back implementa el protocolo del front (R) · B) El front usa Socket.IO | A: WebSocket nativo (`ws`) con el protocolo §7.4 del plan del front. Reabre D-005 en parte: Express se queda y Socket.IO se reemplaza | 2026-10-12 |
| D-043 | 1 | A2 · Idioma del contrato | A) Contrato en inglés y base en español (R) · B) Contrato en español · C) Todo en inglés | C: todo en inglés, base de datos incluida. Reabre D-012 y D-013 | 2026-10-12 |
| D-044 | 1 | A3 · Identidad del cliente | A) Mesa + seguimiento por dispositivo, como el front · B) Mesa + UUID del dispositivo (R) · C) Solo UUID | A: el pedido guarda la mesa; "Mis pedidos" se arma con los ids que guarda el dispositivo; la suscripción es por mesa. Reabre D-022 y D-031. Riesgo aceptado: quien se suscribe a una mesa ve sus avisos | 2026-10-12 |
| D-045 | 1 | A4 · Multi-local | A) Se mantiene (R) · B) Un solo restaurante | A: se mantiene D-019. El QR lleva restaurante + mesa y el front agrega el slug (parámetro `restaurant`, en inglés por D-043) | 2026-10-12 |
| D-046 | 1 | A5 · Carta | A) El back adopta el modelo del front (R) · B) Subconjunto · C) El front simplifica | A: categorías, grupos de opciones con mín./máx., opciones con adicional, etiquetas, imagen, destacado, orden y textos ES/EN | 2026-10-12 |
| D-047 | 1 | A6 · Estados y transiciones | A) Los del front · B) Los del back · C) Combinación (R) | C: `pending → accepted → preparing → ready → delivered` + `cancelled`, con retroceso de un paso. Reemplaza los nombres de D-020; D-025 se mantiene | 2026-10-12 |
| D-048 | 1 | A7 · Cancelación | A) Como el front · B) Como el back · C) Mezcla | C: el personal cancela desde cualquier estado no final; el cliente, mientras esté `pending`. Reabre D-024 | 2026-10-12 |
| D-049 | 1 | A8 · Total enviado por el cliente | A) Como el front (R) · B) Como el back | A: `expectedTotalCents`; si no coincide → 409 `PRICE_CHANGED` sin registrar. Ajusta R2.3 | 2026-10-12 |
| D-050 | 1 | A9 · Idempotencia | A) Se adopta (R) · B) No | A: `clientRequestId` + `Idempotency-Key` (reglas §7.3 del plan del front) | 2026-10-12 |
| D-051 | 1 | A10 · Datos del pedido | A) Se adoptan todos (R) · B) Todos menos las notas | A: código corto, notas por línea (140) y generales (200), `statusHistory`, `updatedAt`, snapshot ES/EN. Reabre D-034 | 2026-10-12 |
| D-052 | 1 | A11 · Concurrencia en el PATCH | Propuesta única | Adoptada: `expectedStatus` → 409 `STATUS_CONFLICT`; mismo estado → sin cambios | 2026-10-12 |
| D-053 | 1 | A12 · Dinero | Propuesta única | Adoptada: centavos enteros; ARS con impuestos incluidos (ajusta S1) | 2026-10-12 |
| D-054 | 1 | A13 · Límites del carrito | Propuesta única | Adoptada: 20 por línea (plato + opciones + nota); máximo de 50 líneas. Reemplaza D-030 | 2026-10-12 |
| D-055 | 1 | A14 · Rutas | Propuesta única | Adoptada: prefijo `/api`; `GET /api/orders` con filtros del front (cubre R9; reemplaza D-029 y D-037); cancelación del cliente agregada por D-048 | 2026-10-12 |
| D-056 | 1 | A15 · Login del personal | Propuesta única | Adoptada: se mantiene Supabase Auth (D-009); hay que avisarle al compañero que la 002 necesita login | 2026-10-12 |
| D-057 | 1 | A16 · Pedido demorado | Propuesta única | Adoptada: el back solo aporta `createdAt` | 2026-10-12 |
| D-058 | 1 | Cómo demuestra el cliente que un pedido es suyo para cancelarlo (sin `cliente_id`) | A) Con su `clientRequestId` (R) · B) Por mesa · C) Sin cancelación del cliente | A: con el `clientRequestId` del envío | 2026-10-12 |
| D-059 | 1 | Cómo se definen las mesas válidas de cada restaurante | A) Entidad Mesa por restaurante, cargada por seed (R) · B) Cantidad de mesas por restaurante | A: entidad `Table` (restaurante + número, activa/inactiva) | 2026-10-12 |
| D-060 | 1 | Retroceso de `accepted` a `pending` | A) Sí, desde cualquier paso (R) · B) No: `accepted` es el piso | A: un paso atrás desde cualquier estado no final salvo `pending` | 2026-10-12 |
