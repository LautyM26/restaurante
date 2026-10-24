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
| D-061 | 2 | Cómo recorrer las 53 decisiones de diseño (DS-1 a DS-53, `opciones-diseno.md`) | A) Mixto por impacto (R) · B) Todas una por una · C) El usuario revisa el documento | A: tandas 1–10 una por una (de a 4); tandas 11–14 con opción de aceptar la tanda; DS-47 siempre una por una | 2026-10-12 |
| D-062 | 2 | Subir las specs a GitHub (revisa D-041) | A) Push + PR a develop (R) · B) Push sin PR · C) Todavía no | A | 2026-10-12 |
| D-063 | 2 | DS-1 · Versión de Prisma | A) Prisma 7 (R) · B) Prisma 6.x | A: Prisma 7 (ESM, adaptador `pg`, `prisma.config.ts`) | 2026-10-12 |
| D-064 | 2 | DS-2 · Versión de Node.js | A) 24 LTS (R) · B) 26 · C) 22 LTS | A: Node 24 LTS | 2026-10-12 |
| D-065 | 2 | DS-3 · Versión de Express | A) Express 5 (R) · B) Express 4 | A: Express 5 | 2026-10-12 |
| D-066 | 2 | DS-4 · Desarrollo, build y alias | A) tsx + bundle tsdown/esbuild (R) · B) tsx + tsc NodeNext · C) tsx en producción | A: `tsx watch` en desarrollo + bundle (tsdown/esbuild) con alias `@/` | 2026-10-12 |
| D-067 | 2 | DS-5 · Carpetas de `backend/` | A) Por capas · B) Por módulo · C) Módulos + `domain/` puro (R) | C | 2026-10-12 |
| D-068 | 2 | DS-6 · Punto de entrada | A) `app.ts` + `server.ts` con dependencias inyectadas (R) · B) Un solo `index.ts` | A | 2026-10-12 |
| D-069 | 2 | DS-7 · Acceso a datos | A) Prisma directo (R) · B) Repositorios | A | 2026-10-12 |
| D-070 | 2 | DS-8 · Origen de las reglas de dominio | A) Implementarlas en el back con casos acordados con el front (R) · B) Copiar del front · C) Paquete compartido | A | 2026-10-12 |
| D-071 | 2 | DS-9 · Identificadores | A) UUID v4 en todo (R) · B) UUID v7 en Order · C) cuid2 · D) Ids legibles en la carta | A | 2026-10-12 |
| D-072 | 2 | DS-10 · Textos ES/EN | A) Dos columnas (R) · B) JSON · C) Tabla de traducciones | A: `xxxEs` obligatoria, `xxxEn` opcional | 2026-10-12 |
| D-073 | 2 | DS-11 · Grupos de opciones | A) De cada plato + `position` (R) · B) Compartidos · C) Sin `position` | A | 2026-10-12 |
| D-074 | 2 | DS-12 · Clave de la mesa | A) UUID + único · B) Clave compuesta (restaurante, número) con FK compuesta (R) · C) Sin FK | B | 2026-10-12 |
| D-075 | 2 | DS-13 · Valores fijos | A) Enums nativos de Prisma, etiquetas como lista (R) · B) Texto + CHECK · C) Enums + tabla de etiquetas | A | 2026-10-12 |
| D-076 | 2 | DS-14 · Importes | A) Int + rechazo · B) Int en precios, BigInt en `totalCents` (R) · C) BigInt en todo | B | 2026-10-12 |
| D-077 | 2 | DS-15 · Fechas | A) `timestamptz(3)` + reloj inyectado (R) · B) Defaults de Prisma · C) `now()` de la base | A | 2026-10-12 |
| D-078 | 2 | DS-16 · Formato de los ids de entrada [front] | A) Estricto (R) · B) Laxo | A (falta confirmar el formato de `lineId` con el compañero) | 2026-10-12 |
| D-079 | 2 | DS-17 · Copia de líneas y opciones | A) Tablas sin FK a la carta (R) · A') Con FK · B) Opciones en JSON · C) Todo JSON | A | 2026-10-12 |
| D-080 | 2 | DS-18 · `statusHistory` | A) Tabla `OrderStatusChange` (R) · B) JSON en Order | A | 2026-10-12 |
| D-081 | 2 | DS-19 · Clave de idempotencia | A) En Order, única (restaurante, `clientRequestId`) + SHA-256 (R) · B) Única global · C) Tabla aparte | A | 2026-10-12 |
| D-082 | 2 | DS-20 · Unicidad del código corto | A) Advisory lock por restaurante (R) · B) Restricción de exclusión · C) Solo en la app | A | 2026-10-12 |
| D-083 | 2 | DS-21 · Posición del chequeo de idempotencia en R3.2 (ajusta un requisito aprobado) | A) Primero (R) · B) Después de la forma · C) Al final | A: la clave se verifica antes de la cadena mesa → forma → líneas → precio. Requisitos pasan a v2.1 (a aprobar junto con el diseño) | 2026-10-12 |
| D-084 | 2 | DS-22 · Detalle de los rechazos [front] | A) Todos los problemas y todas las líneas (R) · B) Uno por línea, solo lo que cambió | A | 2026-10-12 |
| D-085 | 2 | DS-23 · Normalización de notas [front] | A) Recortar; vacía = sin nota (R) · B) Tal cual · C) A + NFC | A | 2026-10-12 |
| D-086 | 2 | DS-24 · Conteo de caracteres visibles | A) `Intl.Segmenter` (R) · B) graphemer · C) Puntos de código | A | 2026-10-12 |
| D-087 | 2 | DS-25 · Vínculo personal ↔ restaurante | A) `StaffMember` sin FK a `auth.users` (R) · B) Multi-schema · C) FK por SQL · D) `app_metadata` | A | 2026-10-12 |
| D-088 | 2 | DS-26 · Verificación del JWT | A) `jose` + JWKS (R) · B) supabase-js `getClaims()` · C) HS256 heredado · D) `getUser()` por request | A (el proyecto Supabase se crea con claves asimétricas) | 2026-10-12 |
| D-089 | 2 | DS-27 · Token válido que no es personal | A) 401 (R) · B) 403 | A | 2026-10-12 |
| D-090 | 2 | DS-28 · Token en REST [front] | A) `Authorization: Bearer` (R) · B) Cookie | A | 2026-10-12 |
| D-091 | 2 | DS-29 · Auth del WS del personal [front] | A) Query param `accessToken` (R) · B) Subprotocolo · C) Mensaje `system.auth` · D) Ticket de un solo uso | A (valor tapado en logs) | 2026-10-12 |
| D-092 | 2 | DS-30 · Códigos de cierre de auth [front] | A) 4401/4403 + cierre al vencer `exp` (R) · B) HTTP 401 en handshake · C) Pausar hasta `system.auth` | A | 2026-10-12 |
| D-093 | 2 | DS-31 · Montaje WS y `Origin` | A) `noServer` + `upgrade` propio (R) · B) `verifyClient` · A') Rechazar sin `Origin` | A | 2026-10-12 |
| D-094 | 2 | DS-32 · Casos no definidos del WS [front] | A) Mesa inactiva aceptada, restaurante inexistente 4404, staff+tableId 4400, máx. 20 mesas, `maxPayload` 16 KB (R) · B) Alternativa sin máximos | A | 2026-10-12 |
| D-095 | 2 | DS-33 · Concurrencia del PATCH | A) Update condicional (R) · B) `SELECT … FOR UPDATE` · C) Columna `version` | A | 2026-10-23 |
| D-096 | 2 | DS-34 · Publicación de eventos después del COMMIT | A) Bus en memoria (R) · B) Outbox + poller · C) `LISTEN/NOTIFY` | A | 2026-10-23 |
| D-097 | 2 | DS-35 · Ruta de la cancelación del cliente [front] | A) `POST /api/orders/{id}/cancel` (R) · A') A + `restaurant` · B) Reusar `PATCH /status` · C) `DELETE` | A | 2026-10-23 |
| D-098 | 2 | DS-36 · `GET /api/orders`: orden y límites | A) `createdAt` desc + máximos de filtros (R) · B) A + tope de 500 · C) Sin orden ni máximos | A | 2026-10-23 |
| D-099 | 2 | DS-37 · Códigos de error fuera de `ServiceErrorCode` [front] | A) `UNAUTHORIZED`/`RATE_LIMITED` + `message` en inglés (R) · B) A con `message` en español · C) `SERVER` para 401/429 | A | 2026-10-23 |
| D-100 | 2 | DS-38 · Campo con error en `VALIDATION` [front] | A) `details.issues` (R) · B) `details.field` · C) Solo en `message` | A | 2026-10-23 |
| D-101 | 2 | DS-39 · Validación y manejador de errores | A) Middleware `validate` propio + `AppError` + manejador central (R) · B) `parse` en cada handler · C) Librería | A | 2026-10-23 |
| D-102 | 2 | DS-40 · `POST /api/orders` con `restaurant` inexistente | A) 422 `INVALID_TABLE` (R) · B) 404 `NOT_FOUND` · C) 400 `VALIDATION` | A | 2026-10-23 |
| D-103 | 2 | Tanda 11 (DS-41 a DS-44) · Infraestructura transversal | A) Aceptar la tanda (R) · B) Una por una | A: DS-41 `express-rate-limit` en memoria, ventana 1 min, `TRUST_PROXY` por env · DS-42 `pino` + `pino-http` con `redact` · DS-43 carga nativa de Node (`--env-file-if-exists`, `process.loadEnvFile()`) · DS-44 `cors` con lista blanca `CORS_ORIGINS` (también valida el `Origin` del WS), sin `helmet`, `x-powered-by` desactivado | 2026-10-23 |
| D-104 | 2 | DS-41 (subpregunta) · ¿Limitar también la cancelación del cliente? (amplía RNF7) | A) Sí, mismo límite (R) · B) No | A: la cancelación del cliente entra en el rate limit. Requisitos pasan a v2.1 (junto con D-083) | 2026-10-23 |
| D-105 | 2 | Tanda 12 (DS-45 y DS-46) · Conexión a Supabase | A) Aceptar ambas (R) · B) Una por una | A: DS-45 Supavisor modo sesión (5432) como `DATABASE_URL`, `DB_POOL_MAX` configurable (se revisa con D-010) · DS-46 rol propio `prisma` | 2026-10-23 |
| D-106 | 2 | DS-47 · Exposición de las tablas por la Data API | A) RLS sin políticas · B) Esquema no expuesto · C) Desactivar Data API · D) A + C (R) | D: RLS activado sin políticas en todas las tablas (SQL en migraciones) + Data API desactivada en el panel (paso manual a documentar; Supabase Auth no se ve afectado) | 2026-10-23 |
| D-107 | 2 | DS-48 · Base de datos para los tests (Docker no estaba instalado) | A) Postgres local en Docker · B) Testcontainers · C) 2º proyecto Supabase (R) · D) Branching (pago) · E) Base de desarrollo | A: Postgres local con `docker compose`, misma versión mayor que el proyecto Supabase. El usuario instala Docker Desktop | 2026-10-23 |
| D-108 | 2 | Tanda 13 (DS-49 y DS-50) · Aislamiento de tests y seed | A) Aceptar ambas (R) · B) Una por una | A: DS-49 un restaurante por test (slug aleatorio) + limpieza al inicio de la corrida · DS-50 `prisma/seed.ts` con upserts idempotentes, ejecución manual | 2026-10-23 |
| D-109 | 2 | DS-51 · Carta demo "Fogón" del seed | A) Copiar la del front (R) · B) Carta propia · C) Carta mínima | A: textos, precios y casos límite de `src/services/mock/menuData.ts` (develop), sin imágenes, ids UUID v4 (D-071) | 2026-10-23 |
| D-110 | 2 | Tanda 14 (DS-52 y DS-53) · Personal en el seed y versiones | A) Aceptar ambas (R) · B) Una por una | A: DS-52 usuario creado a mano en Supabase Auth, vinculado con `SEED_STAFF_USER_ID` · DS-53 versiones exactas (`save-exact`) + `package-lock.json` commiteado | 2026-10-23 |
| D-111 | 2 | Siguiente paso tras cerrar DS-1 a DS-53 | A) Redactar `diseno.md` (R) · B) Coordinar primero con el compañero · C) Ambas en paralelo | A | 2026-10-23 |
| D-112 | 2 | Commit y push de las decisiones de diseño | A) Commit + push a `chore/backend-specs` (R) · B) Solo commit local · C) Todavía no | A | 2026-10-23 |
