# Spec backend/001 — Pedidos en tiempo real · Relevamiento de opciones para el diseño

**Estado:** BORRADOR (insumo para las consultas de la Fase 2) · **Fecha:** 2026-10-12 · **Basado en:** requisitos v2 (APROBADO 2026-10-12), constitución v2, `plan.md` del front §6–§7.4 (rama `origin/frontend`)

> IDs provisorios `DS-n`. Cuando el usuario elija, cada uno pasa a `decisiones.md` con su `D-0xx` definitivo.
> Las recomendaciones son **solo sugerencias**. Salvo que se indique, ninguna opción tiene costo mensual (son librerías open source).
> No se reabren: stack de la constitución, D-042..D-060, I1–I4.
> Marcado **[front]** = la elección cambia o extiende el contrato del front y hay que acordarla con el compañero.

## Verificado en documentación oficial (2026-10-12)
- **Prisma 7** (última mayor): generador `prisma-client` con `output` obligatorio, **solo ESM**, adaptador obligatorio (`@prisma/adapter-pg` + `pg`), `prisma.config.ts` en la raíz. `url`/`directUrl` en `schema.prisma` quedan obsoletos: la URL para migraciones (nuestra `DIRECT_URL`) va en `prisma.config.ts` y la de la app (`DATABASE_URL`) se pasa al adaptador. No carga `.env` sola. El seed ya no corre automático tras `migrate dev`. Node ≥ 20.19, TS ≥ 5.4. Soporta `uuid(4)`, `uuid(7)`, `cuid(2)`; `DateTime` en PostgreSQL es `timestamp(3)` (sin zona) salvo `@db.Timestamptz`.
- **Supabase + Prisma:** recomienda un rol `prisma` propio; para servidores persistentes, `DATABASE_URL` = pooler Supavisor en **modo sesión (5432)**; para serverless, modo transacción (6543, `?pgbouncer=true`) + `DIRECT_URL`.
- **Supabase JWT:** recomienda **claves asimétricas** (ES256) verificadas localmente contra `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`; el secreto HS256 heredado "ya no se recomienda". `getClaims()` es el método oficial de supabase-js.
- **Node.js:** v24 es la LTS más reciente (24.21); v22 LTS en mantenimiento; v26 está en "Current" y pasa a LTS hacia fines de octubre de 2026.

---

## Tanda 1 — Base técnica

### DS-1 · Versión de Prisma
Contexto: `stack.md` pide "última estable". Prisma 7 cambia cómo se configura la conexión (afecta la forma de aplicar D-017, no su contenido).
- **A) Prisma 7** — Pro: última estable, sin motor en Rust, `DIRECT_URL` en `prisma.config.ts` y `DATABASE_URL` en el adaptador (D-017 se cumple igual). · Contra: obliga a ESM; más configuración; menos ejemplos en internet.
- **B) Prisma 6.x** — Pro: muchos ejemplos; `directUrl` en el schema; acepta CommonJS. · Contra: línea anterior, habrá que migrar a la 7 más adelante.
- **Recomendación:** A, porque cumple `stack.md` y evita una migración futura.

### DS-2 · Versión de Node.js
Contexto: `stack.md` pide Node LTS. El hosting (D-010) deberá soportar la versión elegida.
- **A) Node 24 LTS** — Pro: LTS activa hoy; trae `--env-file`, `Intl.Segmenter`, `crypto.randomUUID`. · Contra: ninguno relevante.
- **B) Node 26** — Pro: soporte más largo. · Contra: hoy todavía es "Current"; pasa a LTS a fines de octubre.
- **C) Node 22 LTS** — Pro: máxima compatibilidad de hostings. · Contra: en mantenimiento, fin de vida en abril de 2027.
- **Recomendación:** A, porque es la LTS vigente; se puede pasar a la 26 cuando sea LTS.

### DS-3 · Versión de Express
- **A) Express 5** (la que instala npm hoy) — Pro: los errores de handlers `async` llegan solos al manejador central. · Contra: `req.query` es de solo lectura; sintaxis de rutas nueva.
- **B) Express 4** — Pro: más ejemplos. · Contra: hay que envolver cada handler async; línea en mantenimiento.
- **Recomendación:** A.

### DS-4 · Ejecución en desarrollo, build y alias de imports
Contexto: con Prisma 7 el proyecto es ESM. `codigo.md` (adoptado) pide imports con alias `@/`; Node no resuelve `@/` por sí solo.
- **A) `tsx watch` en desarrollo + bundle con tsdown/esbuild para producción** — Pro: el alias `@/` funciona; resolución "bundler" (la que sugiere Prisma 7). · Contra: una dependencia de desarrollo más. (tsup anunció que no se mantiene activamente y sugiere tsdown: verificar en T1.)
- **B) `tsx watch` + `tsc` con `module: NodeNext`** — Pro: sin bundler. · Contra: imports relativos con extensión `.js` y sin `@/` (excepción a `codigo.md`) o alias nativo `#/` de Node.
- **C) `tsx` también en producción, sin build** — Pro: lo más simple. · Contra: transpila al arrancar; `tsx` queda como dependencia de producción.
- **Recomendación:** A, porque respeta `codigo.md` sin excepciones.

## Tanda 2 — Arquitectura del código

### DS-5 · Estructura de carpetas de `backend/`
- **A) Por capas:** `src/routes`, `controllers`, `services`, `repositories`, `schemas`. — Pro: conocida. · Contra: un cambio de pedidos toca 5 carpetas.
- **B) Por módulo:** `src/modules/{menu,tables,orders,staff,realtime}/` (router, service, schemas) + `src/shared/` (errores, http, db, env). — Pro: sigue `codigo.md` "por funcionalidad". · Contra: reglas puras mezcladas con Express/Prisma.
- **C) B + `src/domain/` puro** (sin Express ni Prisma: transiciones, precios, selección, código corto, huella, texto). — Pro: reglas con tests unitarios rápidos, mismo esquema que el front (`domain/`). · Contra: una carpeta más.
- **Recomendación:** C.

### DS-6 · Punto de entrada
- **A) `app.ts` (crea Express sin `listen`) + `realtime/` (adjunta `ws` al servidor HTTP) + `server.ts` (env, Prisma, `listen`, apagado ordenado con cierre 1001).** Dependencias inyectadas: Prisma, reloj, aleatorio, verificador de token, bus de eventos, intervalos del heartbeat. — Pro: tests con Supertest y WS en puerto aleatorio, heartbeat acelerado en tests. · Contra: un poco más de cableado.
- **B) Un solo `index.ts` con singletons** y `vi.mock` en tests. — Pro: menos archivos. · Contra: tests más frágiles; heartbeat de 25 s difícil de probar.
- **Recomendación:** A.

### DS-7 · Acceso a datos
- **A) Servicios usan Prisma directamente** (reciben el cliente de transacción). — Pro: menos código. · Contra: tests de servicios necesitan base real (igual hace falta para transacciones y bloqueos).
- **B) Capa de repositorios** con interfaz + implementación Prisma. — Pro: fakes en memoria. · Contra: el doble de archivos; los fakes no prueban transacciones ni concurrencia.
- **Recomendación:** A.

### DS-8 · Origen de las reglas de dominio (transiciones, precios, selección, código corto, caracteres)
Contexto: el front todavía no escribió su `domain/` (está en T1). Además su `canTransition` (§6) no tiene retroceso, y el back sí (D-060): el código no es idéntico.
- **A) Implementarlas en el back desde la spec y §6 del front**, con los mismos nombres y casos de prueba acordados con el compañero. — Pro: no depende de los tiempos del front. · Contra: dos implementaciones que mantener alineadas.
- **B) Copiar los archivos del front cuando existan** — Pro: misma lógica. · Contra: bloquea al back; hay que adaptar transiciones igual.
- **C) Paquete compartido** (`shared/`) — Pro: una sola fuente. · Contra: reabre D-008 (cada lado con su `package.json`) y suma configuración de build. **[front]**
- **Recomendación:** A.

## Tanda 3 — Modelo de datos: carta y mesas

### DS-9 · Identificadores
Contexto: el `id` del pedido es público y funciona como llave en `GET /api/orders?ids=` (riesgo aceptado D-044): no puede ser adivinable (descarta autoincrementales). `tableId` es el número de mesa (ver DS-12).
- **A) UUID v4 en todas las entidades** (`@db.Uuid`). — Pro: tipo nativo, igual que `createId()` del front, imposible de adivinar. · Contra: índices menos ordenados (irrelevante a esta escala).
- **B) UUID v7 en `Order` y v4 en el resto** — Pro: ordenable por tiempo. · Contra: dos criterios; menos bits aleatorios (sigue siendo inadivinable).
- **C) cuid2** — Pro: más corto en URLs. · Contra: texto, no tipo nativo.
- **D) Ids legibles en la carta** (`dish-milanesa`) + UUID en pedidos — Pro: seed y logs legibles. · Contra: ids de la carta "con significado" que no se pueden renombrar.
- **Recomendación:** A.

### DS-10 · Cómo guardar `LocalizedText` (`{ es, en? }`)
- **A) Dos columnas** (`nameEs` obligatoria, `nameEn` opcional; igual para descripción). — Pro: la base garantiza `es`; consultas simples. · Contra: un tercer idioma = migración.
- **B) Columna JSON** validada con Zod. — Pro: flexible. · Contra: la base no garantiza `es`.
- **C) Tabla de traducciones** — Pro: N idiomas. · Contra: joins en cada lectura de carta (RNF1).
- **Recomendación:** A (D-046 fija dos idiomas).

### DS-11 · Grupos de opciones: propios del plato o compartidos
Contexto: el contrato devuelve `optionGroups` y `options` como arrays ordenados pero sin campo `order`; la base necesita un criterio de orden.
- **A) Cada grupo pertenece a un plato** (Plato 1–N Grupo 1–N Opción) + columna interna `position` en grupos y opciones (no se expone). — Pro: simple; disponibilidad por plato. · Contra: en el seed se repite "Punto de cocción" en cada plato.
- **B) Grupos compartidos** entre platos (tabla intermedia) — Pro: se carga una vez. · Contra: marcar una opción "agotada" la agota en todos los platos; modelo más complejo.
- **C) A sin `position`** (orden por creación) — Contra: orden no garantizado.
- **Recomendación:** A.

### DS-12 · Clave de la mesa y vínculo pedido–mesa
Contexto: en el contrato `tableId: number` es el número de mesa dentro del restaurante (1–20 en Fogón).
- **A) `Table` con id UUID + único (restaurante, número); `Order` guarda el UUID** — Pro: clásico. · Contra: join para responder `tableId`.
- **B) `Table` con clave compuesta (restaurante, número); `Order` guarda (restaurante, número) con FK compuesta** — Pro: sin traducción ni join; integridad por FK. · Contra: claves compuestas en Prisma son algo más verbosas.
- **C) `Order` guarda el número sin FK** — Contra: sin integridad.
- **Recomendación:** B.

## Tanda 4 — Modelo de datos: tipos

### DS-13 · Enums (`OrderStatus`, tipo de grupo, `CategoryVisual`, `DietaryTag`)
- **A) Enums de Prisma (nativos de Postgres); etiquetas como array `DietaryTag[]`.** — Pro: la base rechaza valores inválidos; tipos generados. · Contra: quitar o renombrar un valor exige una migración cuidadosa (agregar es fácil).
- **B) Texto + `CHECK` en SQL manual + Zod** — Pro: flexible. · Contra: SQL a mano en migraciones.
- **C) Enums, pero etiquetas en tabla intermedia** — Contra: join extra sin beneficio.
- **Recomendación:** A.

### DS-14 · Tipo de columna para importes
Contexto: `Int` (32 bits) llega a 2.147.483.647 centavos (~21,4 M ARS). Precios unitarios entran sobrados, pero un total extremo (50 líneas × 20 × plato caro) podría pasarse.
- **A) `Int` en todo + rechazo si el total supera el máximo** — Pro: simple. · Contra: agrega un caso de rechazo que hoy no está en R3.4 (habría que aprobarlo).
- **B) `Int` en precios y adicionales; `BigInt` en `totalCents`**, convertido a número en un solo lugar (el mapeo a `Order`). — Pro: sin regla nueva; JSON sigue siendo número (seguro hasta 2^53). · Contra: una conversión explícita.
- **C) `BigInt` en todo** — Contra: conversiones en todas partes.
- **Recomendación:** B.

### DS-15 · Fechas y reloj
- **A) `@db.Timestamptz(3)` + reloj de la app inyectado** (`createdAt = updatedAt = statusHistory[0].at` en el mismo instante); JSON con `toISOString()` (ms, `Z`). — Pro: sin ambigüedad de zona; tests deterministas. · Contra: no usa `@updatedAt` automático.
- **B) Default de Prisma (`timestamp(3)` sin zona) + `@default(now())`/`@updatedAt`** — Pro: cero código. · Contra: depende de la convención "todo en UTC"; tests con tiempo real.
- **C) `timestamptz` + `now()` de la base** — Contra: tests no deterministas.
- **Recomendación:** A.

### DS-16 · Formatos válidos de los identificadores de entrada (R1.4, R2.3, R3.4 "formato inválido")
- **A) Estricto:** `restaurant` = `^[a-z0-9]+(-[a-z0-9]+)*$`, máx. 50; `clientRequestId` e `Idempotency-Key` = UUID; `lineId` = texto de 1 a 64; ids de plato/grupo/opción = el formato de DS-9. — Pro: rechaza basura temprano. · Contra: si el front cambia `createId`, se rompe. **[front]**
- **B) Laxo:** textos de 1 a 64 caracteres `[A-Za-z0-9_-]` para todos. — Pro: tolera cambios del front. · Contra: valida menos.
- **Recomendación:** A, confirmando con el compañero el formato de `lineId`.

## Tanda 5 — Modelo de datos: pedido

### DS-17 · Snapshot de líneas y opciones
- **A) Tablas `OrderItem` y `OrderItemOption`** (nombre ES/EN, cantidad, nota, precio unitario con adicionales —I4—, adicional por opción, `position`). `dishId`/`optionId` guardados **sin FK** a la carta (el snapshot no depende de ella). — Pro: coincide con R4.1 y la lista de entidades de la spec. · Contra: dos inserts anidados más.
- **A') Igual que A pero con FK a la carta** — Pro: integridad. · Contra: impediría borrar platos cuando exista el ABM.
- **B) `OrderItem` en tabla y opciones en JSON** — Contra: mezcla de criterios.
- **C) Todo el detalle en un JSON en `Order`** — Pro: una sola fila. · Contra: no consultable; contradice la lista de entidades.
- **Recomendación:** A.

### DS-18 · `statusHistory`
- **A) Tabla `OrderStatusChange` (pedido, estado, fecha)** insertada en la misma transacción. — Pro: tipada con el enum; solo se agrega. · Contra: un join al leer.
- **B) Columna JSON en `Order`** agregada en el mismo `UPDATE`. — Pro: una sola sentencia atómica. · Contra: la base no valida el contenido.
- **Recomendación:** A.

### DS-19 · Clave de idempotencia y huella
Contexto: R3.10–R3.12; los pedidos se conservan siempre (D-034), así que "al menos 24 h" se cumple guardándola en el pedido.
- **A) Columnas en `Order`: `clientRequestId` + `requestFingerprint` (SHA-256 del JSON canónico), único (restaurante, `clientRequestId`).** — Pro: sin tablas ni limpiezas; un `clientRequestId` de otro restaurante no interfiere. · Contra: ninguno a esta escala.
- **B) Igual pero único global** — Contra: un cliente de otro restaurante con el mismo id recibiría `IDEMPOTENCY_CONFLICT` (filtra existencia).
- **C) Tabla `IdempotencyKey` con vencimiento + tarea de limpieza** — Contra: más piezas sin necesidad.
- Contenido canónico propuesto (igual que `submissionFingerprint` del front): todo el cuerpo salvo `clientRequestId`; líneas ordenadas por `lineId`, grupos y opciones ordenados; notas normalizadas según DS-23. Dos envíos simultáneos con la misma clave se resuelven con la restricción única (el perdedor relee y responde 200 o 409).
- **Recomendación:** A.

### DS-20 · Unicidad del código corto en 24 h (R3.9, I1)
Contexto: Postgres no permite un índice único "de las últimas 24 h" (usa `now()`, no inmutable).
- **A) Bloqueo por restaurante dentro de la transacción** (`pg_advisory_xact_lock`) + leer códigos de las últimas 24 h + generar (hasta 20 intentos; si se agotan, 500 `SERVER` con log). — Pro: exacto y simple. · Contra: serializa las altas de un mismo restaurante (insignificante a la escala D-033); una línea de SQL crudo.
- **B) Restricción de exclusión** (`btree_gist`: mismo restaurante, mismo código, rangos `[createdAt, codeExpiresAt)` superpuestos) + reintento ante violación. — Pro: garantía en la base. · Contra: extensión + SQL manual en la migración que Prisma no modela.
- **C) Solo chequeo en la app, sin bloqueo** — Contra: dos altas simultáneas pueden repetir código (no cumple R3.9 en sentido estricto).
- **Recomendación:** A.

## Tanda 6 — Reglas de creación (interpretaciones de requisitos)

### DS-21 · Dónde va el chequeo de idempotencia dentro de la cadena R3.2
Contexto: si el reintento de un pedido ya registrado pasa por la cadena mesa → forma → líneas → precio, un cambio de carta o de mesa posterior haría que el reintento reciba `PRICE_CHANGED`/`INVALID_TABLE` en lugar del pedido original, y el front creería que no se registró. Es un ajuste de interpretación de R3.2 + R3.10: requiere aprobación.
- **A) Primero:** parsear `restaurant`, header y `clientRequestId` (y que coincidan); si la clave existe → comparar huella → 200 o 409; si no, cadena R3.2 completa. — Pro: el reintento siempre recupera su pedido. · Contra: un reintento con cuerpo malformado da 409 en vez de 400.
- **B) Después de la forma (R3.4) y antes de líneas/precio** — Contra: altera el orden mesa → forma.
- **C) Al final de la cadena** — Contra: el problema descrito.
- **Recomendación:** A.

### DS-22 · Detalle de los rechazos
Contexto: R3.5/R3.7 no fijan estos detalles. **[front]** (deben coincidir con su `validateLine`).
- **A)** `LINES_REJECTED`: todos los problemas de todas las líneas (puede haber varias entradas por línea); grupo que no es del plato → `selection_invalid` con `groupId`; opción inexistente o de otro grupo → `option_not_found` con `groupId` y `optionId`; opciones repetidas → `selection_invalid`. `PRICE_CHANGED`: `priceLines` con **todas** las líneas.
- **B)** Un problema por línea (el primero) y `priceLines` solo con las líneas que cambiaron.
- **Recomendación:** A, porque el front marca cada línea con su motivo y recalcula todo el resumen.

### DS-23 · Normalización de notas
- **A) Recortar espacios; si queda vacía, no hay nota** (no aparece en `Order`); el límite se cuenta después de recortar. — Pro: evita notas "en blanco" en cocina; huella estable. · Contra: el front debe recortar igual al contar. **[front]**
- **B) Guardar tal cual** (`''` se devuelve como `''`). — Contra: notas vacías en el panel.
- **C) A + normalización Unicode NFC** — Pro: huella estable ante tildes compuestas. · Contra: un paso más.
- **Recomendación:** A.

### DS-24 · Conteo de caracteres visibles (emoji = 1)
- **A) `Intl.Segmenter` (grafemas), nativo de Node** — Pro: lo mismo que usa el front; sin dependencias. · Contra: ninguno con Node oficial (ICU completo).
- **B) Librería (`graphemer`)** — Contra: dependencia sin necesidad.
- **C) `[...s]` (puntos de código)** — Contra: emojis compuestos cuentan más de 1; difiere del front.
- **Recomendación:** A.

## Tanda 7 — Autenticación del personal

### DS-25 · Vínculo personal ↔ restaurante
- **A) Tabla `StaffMember` (`userId` UUID único, `restaurantId`) sin FK a `auth.users`.** Prisma solo maneja `public`. — Pro: simple, sin tocar el esquema de Supabase. · Contra: si se borra el usuario en Supabase, la fila queda huérfana (inofensiva: el token ya no existe).
- **B) Modelar `auth.users` con multi-schema de Prisma** — Contra: Prisma pasaría a gestionar tablas que administra Supabase; las migraciones fallan en la base sombra.
- **C) FK a `auth.users` agregada con SQL manual** — Pro: integridad. · Contra: misma fricción con la base sombra de `migrate dev`.
- **D) Sin tabla: restaurante en `app_metadata` del usuario (llega en el JWT)** — Pro: sin consulta por request. · Contra: los cambios rigen recién al renovar el token; la spec lista la pertenencia como entidad.
- **Recomendación:** A.

### DS-26 · Verificación del JWT de Supabase
- **A) `jose` + JWKS remoto** (`/auth/v1/.well-known/jwks.json`), validando `iss`, `aud = authenticated` y `exp`. — Pro: lo que recomienda Supabase; local, sin llamada por request; una dependencia chica; en tests se usa un par de claves propio. · Contra: requiere que el proyecto use claves asimétricas.
- **B) `supabase-js` `auth.getClaims()`** — Pro: método oficial; maneja ambos tipos de clave. · Contra: dependencia más grande; con claves heredadas hace una llamada de red.
- **C) Secreto HS256 heredado** — Contra: Supabase ya no lo recomienda; la rotación rompe el back.
- **D) `auth.getUser(token)` en cada request** — Pro: detecta sesiones cerradas al instante. · Contra: latencia y dependencia de Supabase Auth en cada request y conexión.
- **Recomendación:** A. **Dato a confirmar:** si el proyecto de Supabase ya usa claves asimétricas (Dashboard → Settings → JWT Keys). Si no, migrar es reversible desde el panel.

### DS-27 · Token válido de alguien que no es personal del restaurante
Contexto: R8.3 da 401 en la consulta global; R5.9 da 404 si el pedido es de otro restaurante. No está definido qué pasa con un usuario autenticado sin `StaffMember`.
- **A) 401 siempre que no sea personal** (de ningún restaurante, o de otro en la consulta global); PATCH de pedido ajeno → 404 (R5.9). — Pro: sin códigos nuevos; coherente con R8.3.
- **B) 403 para autenticado sin permisos** — Contra: código nuevo en el contrato. **[front]**
- **Recomendación:** A.

### DS-28 · Cómo viaja el token en REST
- **A) `Authorization: Bearer <access_token>`** — Pro: estándar; supabase-js lo expone. · Contra: ninguno.
- **B) Cookie** — Contra: CORS con credenciales y CSRF.
- **Recomendación:** A. **[front]**

## Tanda 8 — WebSocket

### DS-29 · Cómo se autentica la conexión WS del personal (R8.2)
Contexto: el WebSocket del navegador no permite headers. Cualquier opción extiende el contrato. **[front]**
- **A) Query param `accessToken`** en `/ws/orders?restaurant=…&scope=staff&accessToken=…`, con el valor tapado en los logs. — Pro: lo más simple. · Contra: el token puede quedar en logs de proxies.
- **B) Subprotocolo** (`Sec-WebSocket-Protocol: bearer, <token>`) — Pro: fuera de la URL. · Contra: truco poco estándar.
- **C) Primer mensaje `system.auth`** antes del `system.welcome` — Pro: permite reautenticar sin reconectar. · Contra: tipo de mensaje nuevo y espera con timeout.
- **D) Ticket de un solo uso** (`POST /api/ws-ticket` con login → ticket en la URL) — Pro: lo más seguro. · Contra: endpoint y almacenamiento extra.
- **Recomendación:** A.

### DS-30 · Códigos de cierre de autenticación y vencimiento del token (R8.2, R8.4)
- **A) 4401** = token faltante, inválido o vencido (reintentable: el front reconecta con token fresco; su tabla ya reintenta códigos "otros"); **4403** = usuario válido que no es personal de ese restaurante (permanente); un temporizador cierra con 4401 al llegar `exp`. — Pro: R8.4 sin lógica extra. · Contra: el front debe tratar 4403 como permanente. **[front]**
- **B) Rechazo HTTP 401 en el handshake** — Contra: el navegador solo ve 1006 y reintenta para siempre.
- **C) Mantener la conexión y pausar eventos hasta `system.auth`** — Requiere DS-29 C.
- **Recomendación:** A.

### DS-31 · Montaje del servidor WS y control de `Origin`
- **A) `WebSocketServer({ noServer: true })` + evento `upgrade`:** ruta distinta de `/ws/orders` → se corta; `Origin` no permitido → HTTP 403 antes del upgrade; parámetros/mesas/token → se acepta y se cierra con 4400/4404/4401/4403 antes del `welcome`. Sin header `Origin` (clientes que no son navegador): se acepta. — Pro: control total. · Contra: algo más de código.
- **B) `WebSocketServer({ server, path })`** con `verifyClient` — Pro: menos código. · Contra: `verifyClient` está desaconsejado por la propia librería.
- **A') Igual que A pero rechazando conexiones sin `Origin` en producción** — Contra: rompe clientes de prueba; no agrega seguridad real (un cliente no navegador puede falsificarlo).
- **Recomendación:** A.

### DS-32 · Casos no definidos del WS
- **A)** Mesa **inactiva** en la suscripción → se acepta (existe; el cliente sigue su pedido); restaurante inexistente → 4404; `scope=staff` junto con `tableId` → 4400; máximo 20 `tableId` por conexión (más → 4400); `maxPayload` de 16 KB (el default de `ws` es 100 MiB).
- **B)** Mesa inactiva → 4404 (como R2.2); restaurante inexistente → 4400; sin máximos.
- **Recomendación:** A. **[front]** (límite de mesas).

## Tanda 9 — Pedidos: concurrencia, eventos, cancelación y lecturas

### DS-33 · Concurrencia del PATCH (R5.10)
- **A) Update condicional:** en una transacción, leer el pedido (del restaurante del usuario) → regla pura `applyTransition` → `updateMany` con `WHERE status = <actual>` + insertar historial; si actualiza 0 filas → releer → 409 `STATUS_CONFLICT` con el pedido actual. — Pro: solo Prisma, sin SQL crudo. · Contra: una relectura en el caso de choque.
- **B) `SELECT … FOR UPDATE`** (SQL crudo) — Pro: lineal. · Contra: SQL crudo; bloqueo pesimista.
- **C) Columna `version`** — Contra: columna extra para lo mismo que A.
- **Recomendación:** A (la cancelación del cliente usa el mismo mecanismo con `pending`).

### DS-34 · Publicación de eventos después del COMMIT (R4.3, RNF11)
- **A) Bus de eventos en memoria:** el servicio publica cuando `$transaction` terminó bien; el hub WS mantiene `restaurante → { personal, mesa → conexiones }` y serializa el sobre una vez por evento. Si el proceso se cae entre el COMMIT y el envío, se recupera con `since` (RNF11). — Pro: simple; cumple RNF2. · Contra: no sirve con varias instancias (fuera de alcance, D-033).
- **B) Outbox transaccional + poller** — Pro: entrega garantizada. · Contra: tabla y proceso extra; RNF2 exige sondeo frecuente.
- **C) `LISTEN/NOTIFY` de Postgres** — Pro: preparado para varias instancias. · Contra: conexión dedicada fuera del pooler; payload de 8 KB (habría que releer el pedido).
- **Recomendación:** A.

### DS-35 · Ruta de la cancelación del cliente (R6) **[front]**
- **A) `POST /api/orders/{id}/cancel`** con `{ clientRequestId }` → 200 `Order` · 409 `INVALID_TRANSITION` (`details.order` con el estado actual) · 404. Sin `restaurant` (el id y el `clientRequestId` alcanzan). — Pro: explícita; no mezcla modos de autenticación. · Contra: método nuevo en `OrderService` del front.
- **A') Igual que A, pero con `restaurant` en el cuerpo** (coherente con I3) — Contra: dato redundante.
- **B) Reusar `PATCH /status`** aceptando `clientRequestId` sin token cuando `status = cancelled` — Contra: un endpoint con dos modos de autorización.
- **C) `DELETE /api/orders/{id}`** — Contra: semántica equivocada (no borra).
- **Recomendación:** A.

### DS-36 · `GET /api/orders`: orden y límites (R10)
Contexto: sin paginación en el contrato; con retención indefinida (D-034), `status=delivered` sin `since` crece para siempre.
- **A) Orden `createdAt` desc; máximos de filtros** (`ids` ≤ 100, `tableId` ≤ 20 → si no, 400); sin tope de resultados. — Pro: respeta el contrato.
- **B) A + tope de 500 resultados** — Contra: truncar en silencio puede ocultar pedidos.
- **C) Sin orden ni máximos** — Contra: consultas arbitrariamente grandes.
- **Recomendación:** A.

## Tanda 10 — Errores y validación

### DS-37 · Códigos de error fuera de `ServiceErrorCode` **[front]**
Contexto: el contrato no tiene códigos para 401, 429 ni rutas inexistentes, y no dice el idioma de `message`.
- **A) Agregar `UNAUTHORIZED` (401) y `RATE_LIMITED` (429); ruta inexistente → 404 `NOT_FOUND`; JSON malformado o cuerpo demasiado grande → 400 `VALIDATION`; `message` en inglés (el front traduce por `code`).**
- **B) Igual que A con `message` en español.**
- **C) Usar `SERVER` para 401/429** — Contra: engañoso para el front.
- **Recomendación:** A.

### DS-38 · Cómo indica `VALIDATION` el campo con error (R3.4) **[front]**
- **A) `details.issues: [{ path: 'items.2.quantity', code: 'too_big' }]`** (todos, sin internos de Zod). — Pro: útil para depurar. · Contra: extiende `ServiceErrorDetails`.
- **B) `details.field`** (solo el primero).
- **C) Solo dentro de `message`** — Pro: sin cambio de tipos. · Contra: el front no puede leerlo.
- **Recomendación:** A.

### DS-39 · Validación y manejador de errores
- **A) Middleware propio `validate({ body, query, params })`** con Zod que deja los datos en `res.locals` (en Express 5 `req.query` es de solo lectura) + clase `AppError(code, status, details)` + manejador central (Zod, `AppError`, errores conocidos de Prisma, resto → 500 `SERVER` con log). `POST /api/orders` usa un validador por etapas para respetar el orden de R3.2. — Pro: sin dependencias; forma de error única.
- **B) `parse` dentro de cada handler** + manejador central — Contra: repetición.
- **C) Librería (`express-zod-api` u otra)** — Contra: dependencia; menos control sobre el formato de error.
- **Recomendación:** A.

### DS-40 · `POST /api/orders` con `restaurant` inexistente
Contexto: R1.5/R10.5 dan 404 en lecturas; el POST no lo define.
- **A) 422 `INVALID_TABLE`** — Pro: el front ya lo maneja (marca la mesa como inválida: el QR está mal).
- **B) 404 `NOT_FOUND`** — Contra: el flujo de envío del front no lo contempla.
- **C) 400 `VALIDATION`**.
- **Recomendación:** A.

## Tanda 11 — Infraestructura transversal

### DS-41 · Rate limiting (RNF7)
- **A) `express-rate-limit` con almacenamiento en memoria** (un servidor, D-033): ventana de 1 min, solo en las dos rutas de RNF7, headers `RateLimit` estándar, 429 con la forma de DS-37. `trust proxy` configurable por env (se fija al decidir hosting, D-010: detrás de un proxy, sin él todos comparten IP). — Pro: librería estándar y madura.
- **B) `rate-limiter-flexible`** — Pro: más opciones y Redis a futuro. · Contra: más API para lo mismo.
- **C) Implementación propia** — Contra: reinventar.
- Subpregunta: ¿limitar también la cancelación del cliente (DS-35)? RNF7 no la incluye.
- **Recomendación:** A, solo en las rutas de RNF7.

### DS-42 · Logging
- **A) `pino` + `pino-http`** (JSON, `redact` de `authorization`, `accessToken` y cookies; `pino-pretty` solo en desarrollo). — Pro: rápido, estructurado, cumple RNF8. · Contra: 2–3 dependencias.
- **B) `console` con un envoltorio JSON propio** — Pro: sin dependencias. · Contra: redacción y niveles a mano.
- **C) `winston`** — Contra: más pesado.
- **Recomendación:** A.

### DS-43 · Carga de variables de entorno (`src/env.ts` con Zod ya decidido, D-016)
Variables previstas: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `CORS_ORIGINS`, `PORT`, `LOG_LEVEL`, `TRUST_PROXY`, `DB_POOL_MAX`.
- **A) Nativo de Node** (`--env-file-if-exists=.env` en los scripts y `process.loadEnvFile()` en `prisma.config.ts`). — Pro: sin dependencias.
- **B) `dotenv`** (lo que muestran las guías de Prisma 7 y Supabase) — Pro: ejemplos oficiales. · Contra: una dependencia.
- **Recomendación:** A.

### DS-44 · CORS y headers
- **A) Paquete `cors` con lista blanca `CORS_ORIGINS`** (la misma lista valida el `Origin` del WS); métodos GET/POST/PATCH; headers `Content-Type`, `Authorization`, `Idempotency-Key`; sin credenciales. Sin `helmet` (API JSON): solo `x-powered-by` desactivado.
- **B) Middleware CORS propio** — Pro: sin dependencia. · Contra: fácil equivocarse con preflight.
- **C) A + `helmet`** — Pro: headers de seguridad por defecto. · Contra: dependencia de valor bajo para una API JSON.
- **Recomendación:** A.

## Tanda 12 — Supabase: conexión y exposición

### DS-45 · Modo del pooler para `DATABASE_URL` (D-017)
Contexto: el WS exige un servidor persistente (D-010), caso en el que Supabase recomienda el modo sesión.
- **A) Supavisor modo sesión (5432)** como `DATABASE_URL`; `DIRECT_URL` = conexión directa o el mismo pooler en sesión para migraciones. Tamaño del pool configurable (`DB_POOL_MAX`). — Pro: lo recomendado para servidores; transacciones y bloqueos sin restricciones.
- **B) Modo transacción (6543, `?pgbouncer=true`)** — Pro: más clientes multiplexados. · Contra: pensado para serverless; restricciones de sesión.
- **C) Conexión directa para todo** — Contra: requiere IPv6 o el add-on IPv4 de Supabase (**costo mensual adicional**, ver precio vigente).
- **Recomendación:** A (se revisa al decidir D-010).

### DS-46 · Rol de base de datos para Prisma
- **A) Rol propio `prisma`** (guía de Supabase: `bypassrls`, `createdb`, permisos en `public`). — Pro: actividad identificable; no usa el superusuario.
- **B) Usuario `postgres`** — Pro: cero configuración. · Contra: máximo privilegio.
- **Recomendación:** A.

### DS-47 · Exposición de las tablas por la Data API de Supabase
Contexto: el front va a usar la clave pública de Supabase para el login del personal; por defecto la Data API expone el esquema `public`. Sin protección, cualquiera podría leer o escribir pedidos y personal directamente. `deploy.md` exige RLS si el front usa el cliente de Supabase.
- **A) RLS activado en todas las tablas, sin políticas** (deniega todo por la API); el back entra con un rol que omite RLS (DS-46). SQL en las migraciones.
- **B) Tablas en un esquema no expuesto** (`app`) — Contra: más configuración en Prisma y Supabase.
- **C) Desactivar la Data API** en el proyecto — Pro: cierra todo. · Contra: depende de una opción del panel, fuera del código.
- **D) A + C** — Pro: defensa en profundidad.
- **Recomendación:** D (o A como mínimo).

## Tanda 13 — Pruebas y seed

### DS-48 · Base de datos para los tests
Contexto: en D-006 se eligió la nube sobre Docker para desarrollo. Los tests de integración (RNF9) necesitan Postgres real.
- **A) Postgres local en Docker** (`docker compose`, misma versión mayor que el proyecto Supabase). — Pro: rápido, aislado, sin red. · Contra: requiere Docker Desktop en Windows.
- **B) Testcontainers** — Pro: ciclo de vida automático. · Contra: Docker igual + dependencia.
- **C) Segundo proyecto Supabase (gratis) solo para tests** — Pro: sin Docker. · Contra: más lento (red); los proyectos gratis se pausan por inactividad; compartido entre los dos devs.
- **D) Supabase branching** — Contra: **costo mensual** (requiere plan pago).
- **E) La base de desarrollo** — Contra: los tests borran datos.
- **Recomendación:** A si hay Docker; si no, C. **Dato a confirmar:** ¿hay Docker Desktop instalado?

### DS-49 · Aislamiento entre tests
- **A) Cada test crea su propio restaurante** (slug aleatorio) + limpieza total al inicio de la corrida. — Pro: archivos en paralelo; aprovecha el multi-local.
- **B) `TRUNCATE` antes de cada test y ejecución secuencial** — Pro: fácil de razonar. · Contra: más lento.
- **C) Rollback por test** — Contra: no funciona con transacciones propias, bloqueos ni WS.
- **Recomendación:** A.

### DS-50 · Mecanismo del seed
- **A) `prisma/seed.ts`** con upserts idempotentes, configurado en `prisma.config.ts` y ejecutado a mano (`npx prisma db seed`; en Prisma 7 no corre solo). — Pro: tipado; repetible.
- **B) Archivo SQL** — Contra: ids y relaciones a mano.
- **Recomendación:** A.

### DS-51 · Contenido de la carta demo "Fogón"
Contexto: la carta demo del front (`menuData.ts`, 6 categorías, ~18 platos) todavía no existe en su rama. Mesas 1–20 activas. Imágenes: el contrato permite omitir `imageUrl` (el front tiene `DishVisual`).
- **A) Usar la misma carta que escriba el compañero** (se copia cuando exista) y mientras tanto una mínima para tests. — Pro: front y back muestran lo mismo. · Contra: depende de sus tiempos.
- **B) El equipo redacta ahora una carta** (textos ES/EN y precios que aprueba el usuario). — Contra: textos visibles al cliente = más decisiones.
- **C) Carta mínima con los casos límite** (agotados, grupos obligatorios, adicionales) — Pro: rápida. · Contra: poco vistosa para demos.
- **Recomendación:** A, sin imágenes.

## Tanda 14 — Varios

### DS-52 · Alta del personal de Fogón en el seed
- **A) El usuario se crea a mano en Supabase Auth** y el seed lo vincula leyendo `SEED_STAFF_USER_ID` (opcional). — Pro: sin credenciales en el repo.
- **B) Vinculación a mano con SQL en el panel de Supabase** — Contra: paso manual sin registro.
- **C) El seed crea el usuario con la Admin API** (clave secreta) — Contra: clave secreta en el entorno de seed.
- **Recomendación:** A.

### DS-53 · Fijación de versiones de dependencias
- **A) Versiones exactas** (`save-exact`) + `package-lock.json` commiteado — Pro: igual que el front (plan §1.1 "fijadas en `package.json`").
- **B) Rango `^` (default de npm)** + lockfile — Pro: actualizaciones menores más fáciles.
- **Recomendación:** A, por coherencia con el front.

---

## Puntos a coordinar con el compañero (marcados [front])
DS-8 (si C), DS-16, DS-22, DS-23, DS-27 (si B), DS-28, DS-29, DS-30, DS-32, DS-35, DS-37, DS-38. También: su `canTransition` (§6) no contempla el retroceso de D-060.
