# Alineación de contrato: back 001 ↔ front 001

**Estado:** BORRADOR para revisar entre los dos · **Fecha:** 2026-10-11 · **Origen:** D-038

> Compara `specs/backend/001-pedidos-tiempo-real/requisitos.md` (back, aprobada) con `specs/001-menu-cliente/` (`spec.md` y `plan.md` §6 y §7, front, aprobada, rama `frontend`).
> Cada punto trae opciones y una recomendación. **La recomendación es solo una sugerencia: deciden ustedes.** Con lo que elijan, el back reabre sus requisitos (v2) antes del diseño.

## Resumen

| # | Tema | Front espera | Back aprobó | Impacto |
|---|---|---|---|---|
| A1 | Protocolo de tiempo real | WebSocket nativo en `/ws/orders` con sobre `{v,id,type,ts,payload}`, heartbeat y códigos de cierre | Socket.IO (D-005), eventos `nuevo_pedido` / `actualizacion_pedido` | **Alto**: no son compatibles entre sí |
| A2 | Idioma del contrato | JSON camelCase en inglés (`dishId`, `totalCents`, `status: 'pending'`) | Estados, eventos y campos en español (D-012) | **Alto** |
| A3 | Identidad del cliente | Mesa (`tableId`, QR, mesas 1–20). Sigue "sus pedidos" por los ids guardados en el dispositivo | UUID anónimo `cliente_id` (D-022), sin mesa (D-031) | **Alto** |
| A4 | Multi-local | Un solo restaurante ("Fogón"), `GET /api/menu` sin restaurante | Varios restaurantes con slug (D-019, D-026) | **Alto** |
| A5 | Carta | Categorías, grupos de opciones con mín./máx., adicionales, etiquetas dietarias, imagen, destacados, orden y textos ES/EN | Producto: nombre, descripción, precio y disponible | **Alto** (modelo de datos) |
| A6 | Estados y transiciones | `pending → accepted → preparing → ready → delivered`, más `cancelled` desde cualquier estado no final. Sin retroceso | `pendiente → en_preparacion → listo_en_camino → entregado` + `cancelado`, retroceso de un paso (D-020, D-023 a D-025) | **Alto** |
| A7 | Cancelación | Solo el personal, desde cualquier estado no final. El cliente no cancela | Personal hasta `en_preparacion`; el cliente mientras esté `pendiente` (D-024) | Medio |
| A8 | Total enviado por el cliente | El cliente manda `expectedTotalCents`; si no coincide → 409 `PRICE_CHANGED` sin registrar | El servidor ignora el total del cliente (R2.3) | Medio |
| A9 | Idempotencia | `clientRequestId` + header `Idempotency-Key`; mismo intento → mismo pedido | No previsto | Medio |
| A10 | Datos del pedido | Código corto de 4 caracteres (único en 24 h), notas por línea (140) y generales (200), `statusHistory`, `updatedAt`, snapshot del nombre en ES/EN | Nada de eso; solo `cliente_id` (D-034) | Medio |
| A11 | Concurrencia en el PATCH | El body lleva `expectedStatus`: si cambió → 409 `STATUS_CONFLICT`; mismo estado → sin cambios | Criterio genérico (R5.9) | Bajo |
| A12 | Dinero | Centavos enteros; ARS con impuestos incluidos | Decimal; una moneda sin impuestos (S1) | Bajo |
| A13 | Límites del carrito | Máx. 20 por línea; líneas iguales (mismo plato, opciones y nota) se suman. Sin máximo de líneas | Máx. 20 por producto sumando repetidos y 50 líneas (D-030) | Bajo, pero depende de A5 |
| A14 | Rutas | Prefijo `/api`; `GET /api/tables/{id}`; `GET /api/orders` con filtros (`ids`, `tableId`, `status`, `since`, `clientRequestId`) | `/menu`, `/orders`, `/orders/:id/status`; lecturas R9 y cancelación R10 a definir | Medio |
| A15 | Login del personal | Sin login en la 001; la 002 elige "Cocina/Salón" sin login (riesgo aceptado para la demo) | Supabase Auth obligatorio para el personal (D-009) | Medio (afecta a la 002 del front) |
| A16 | Pedido demorado | 10 min en `pending` → aviso (lógica del front y de la 002) | No previsto | Bajo: el back solo necesita `createdAt` |

Ya resuelto por el usuario (falta coordinarlo con el compañero):
- **D-039:** el front se mueve de la raíz a `frontend/`.
- **D-040:** las specs se separan en `specs/backend/` y `specs/frontend/`. La del front pasaría a `specs/frontend/001-menu-cliente/`.

---

## Decisiones a tomar juntos

### A1 · Protocolo de tiempo real
Un cliente WebSocket nativo no puede hablar con un servidor Socket.IO, y al revés tampoco: Socket.IO usa su propio protocolo encima.
- **A) El back implementa el protocolo del front** (WebSocket nativo con la librería `ws` adjunta a Express, sobres, ping/pong, códigos 4400/4404/4408). Reabre en parte D-005: Express se queda y Socket.IO se reemplaza por `ws`.
  - Pro: el front no cambia nada; el protocolo ya está especificado, con reconexión y re-sincronización.
  - Contra: lo que Socket.IO trae resuelto (rooms, reconexión) hay que escribirlo a mano en el back.
- **B) El front usa Socket.IO** en su adaptador (`socket.io-client`), con su modelo de eventos.
  - Pro: se mantiene D-005 y las rooms salen gratis.
  - Contra: el front reescribe §7.4 del plan; el sobre y el heartbeat propios sobran.
- **Recomendación:** A. El protocolo del front está muy completo, su adaptador ya depende de él, y armar rooms a mano con `ws` es poco código para esta escala (D-033).

### A2 · Idioma del contrato
- **A) Contrato en inglés camelCase, como el front.** La base de datos puede seguir en español (D-012) y se traduce en la capa de API.
  - Contra: D-012 queda solo para la base de datos.
- **B) Contrato en español**, como D-012: el front renombra sus tipos (`Order` → `Pedido`, `status` → `estado`…).
- **C) Todo en inglés**, base de datos incluida: se reabre D-012.
- **Recomendación:** A, o C si prefieren un solo idioma en todo el código. Tener el contrato en inglés y la base en español obliga a mapear los nombres en cada consulta.

### A3 · Identidad del cliente
- **A) Mesa + seguimiento por dispositivo, como el front.** El pedido guarda la mesa; "Mis pedidos" se arma con los ids que guarda el dispositivo; la suscripción es por mesa. Se reabren D-022 y D-031.
- **B) Mesa + UUID del dispositivo.** El pedido guarda la mesa y el `cliente_id`. El back puede listar y avisar por dispositivo, que es más preciso que por mesa: otro celular de la misma mesa no ve tus avisos.
- **C) Solo UUID, sin mesa** (lo que aprobó el back): el front reescribe todo el flujo del QR.
- **Recomendación:** B. La mesa es lo que necesita la cocina para llevar el plato, y el UUID evita que los celulares de una misma mesa vean los pedidos de los demás. Con solo mesa (A), cualquiera que se suscriba a esa mesa recibe sus avisos (riesgo §3.5 del front).

### A4 · Multi-local
- **A) Se mantiene el multi-local (D-019):** el QR lleva restaurante + mesa (ej. `?restaurante=fogon&mesa=12`) y el front agrega el slug a sus llamadas.
- **B) Un solo restaurante por ahora:** se reabre D-019 y el multi-local va en una spec futura (habrá que migrar datos).
- **Recomendación:** A. Agregar el restaurante cuando ya hay datos es una migración más cara. Al front le cuesta un parámetro más.

### A5 · Carta
- **A) El back adopta el modelo del front:** `Categoria`, `Plato`, `GrupoOpciones`, `Opcion`, etiquetas, imagen, destacado, orden y textos ES/EN. Es mucho más alcance para el back 001.
- **B) El back adopta un subconjunto:** categorías, orden, imagen y etiquetas sí; grupos de opciones e i18n de la carta en una spec posterior. El front esconde lo que todavía no llega.
- **C) El front simplifica su carta** al modelo del back.
- **Recomendación:** A o B, según los tiempos. El front ya está construido sobre ese modelo y las opciones (punto de cocción, sin cebolla) son el problema que motivó el proyecto (spec del front §0).

### A6 · Estados y transiciones
- **A) Los estados del front:** se suma `accepted` ("Confirmado") y no hay retroceso. Se reabren D-020 y D-025.
- **B) Los estados del back** (sin `accepted`, con retroceso de un paso): el front cambia sus reglas puras (`canTransition`, `ORDER_FLOW`).
- **C) Combinación:** la secuencia del front (con `accepted`) más el retroceso de un paso del back.
- **Recomendación:** C. `accepted` le da al cliente la señal de que la cocina vio el pedido (base del aviso de demora de 10 min), y el retroceso de un paso corrige errores del cocinero. Hay que confirmar con el front que su `mergeOrder` por `updatedAt` soporta retrocesos: sí, porque compara fechas y no estados.

### A7 · Cancelación
- **A) Como el front:** solo el personal, desde cualquier estado no final.
- **B) Como el back (D-024):** el personal hasta `en_preparacion` y el cliente mientras esté `pendiente`. El front agrega el botón "Cancelar".
- **C) Mezcla:** el personal desde cualquier estado no final y el cliente mientras esté `pendiente`.
- **Recomendación:** B o C. Que el cliente pueda arrepentirse antes de que la cocina confirme ahorra un viaje del mozo.

### A8 · Total enviado por el cliente
- **A) Como el front:** el cliente manda `expectedTotalCents`; si no coincide, 409 `PRICE_CHANGED` y no se registra nada. El servidor sigue calculando el total (R2.2); solo lo compara.
- **B) Como el back:** se ignora el total del cliente y se cobra el precio vigente sin avisar.
- **Recomendación:** A. Es más seguro para el cliente y no le resta control al servidor.

### A9 · Idempotencia
- **A) Se adopta** (`clientRequestId` + `Idempotency-Key`, reglas §7.3 del plan del front).
- **B) No se adopta** y el front evita el doble envío solo de su lado.
- **Recomendación:** A. Con WiFi inestable en el salón, un reintento sin idempotencia duplica pedidos en la cocina.

### A10 · Datos del pedido
Código corto, notas, `statusHistory`, `updatedAt` y snapshot del nombre.
- **A) Se adoptan todos.** Las notas reabren D-034, que hoy solo guarda `cliente_id`.
- **B) Todos menos las notas.**
- **Recomendación:** A. Las notas no son datos personales y el código corto es lo que se dice en voz alta en el salón.

### A11 a A16
- **A11:** adoptar `expectedStatus` → 409 `STATUS_CONFLICT`, y "mismo estado = sin cambios". Implementa R5.9 con una regla concreta.
- **A12:** adoptar centavos enteros (`Int`) y ARS con impuestos incluidos (ajusta S1).
- **A13:** límites por línea (plato + opciones + nota) en lugar de por producto. Se mantiene el máximo de 50 líneas del back como protección.
- **A14:** rutas con prefijo `/api` y el `GET /api/orders` con filtros del front, que cubre las lecturas R9. Agregar la cancelación del cliente si se elige en A7.
- **A15:** el back mantiene Supabase Auth para el personal (D-009). La 002 del front necesita una pantalla de login. Hay que avisarle al compañero.
- **A16:** no requiere nada del back más allá de `createdAt`.

---

## Próximos pasos
1. Revisar este documento entre los dos y elegir una opción por punto.
2. Registrar las decisiones (D-042 en adelante) y reabrir los requisitos del back como **v2**, con nueva aprobación.
3. El compañero ajusta lo que le toque, incluido el movimiento a `frontend/` y `specs/frontend/`.
4. Recién ahí `/spec-diseno` del back y el push de las specs (D-041).
