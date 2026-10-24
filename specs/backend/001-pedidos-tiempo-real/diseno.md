# Spec backend/001 — Pedidos en tiempo real · Diseño

**Estado:** APROBADO (2026-10-24, v1.2 con §23 por D-145) · **Versión:** 1.2 · **Fecha:** 2026-10-24
**Historial:** v1.2 (2026-10-24) agrega solo §23 Integración continua (D-137) y suma D-128..D-137 a §2; el resto es la v1.1 APROBADA sin cambios. §23 se aprueba por separado. v1.1 (APROBADO 2026-10-24, D-127) resuelve los pendientes P1–P11 (D-113..D-123) y pasa a requisitos v2.1 (D-124). v1 BORRADOR del 2026-10-23.
**Basado en:** requisitos v2.1 (APROBADO 2026-10-24, D-124, D-127) · constitución v2 · `plan.md` del front §6–§7.4 (rama `develop`) · decisiones D-042..D-127 (`decisiones.md`) · detalle de opciones en `opciones-diseno.md`.

> Cada elección cita su decisión. Los huecos detectados en la v1 (P1–P11) ya están resueltos (§20). Lo que cambia o extiende el contrato del front está en §19.

---

## 1. Resumen de la solución
Un servidor Node 24 + Express 5 + `ws` (un solo proceso, D-033) expone la API REST bajo `/api` y el canal `/ws/orders`. Las reglas de negocio viven en `src/domain/` como funciones puras; los módulos (`menu`, `tables`, `orders`, `staff`, `realtime`) usan Prisma 7 directamente contra PostgreSQL de Supabase. La creación de pedidos valida en el orden acordado, guarda todo en una transacción con bloqueo por restaurante para el código corto, y recién después del COMMIT publica el evento en un bus en memoria que el hub WebSocket reparte por restaurante y mesa. El personal se autentica con el JWT de Supabase Auth verificado localmente contra el JWKS.

## 2. Decisiones aplicadas
Decisiones de requisitos que este diseño implementa sin reabrir: D-042..D-060 (contrato), D-016 (herramientas), D-017 (URLs de Supabase), D-019/D-045 (multi-local), D-033 (escala), D-034 (retención).

| ID | Tema | Elección del usuario | Dónde se aplica |
|---|---|---|---|
| D-063 | Prisma | Prisma 7 (ESM, adaptador `pg`, `prisma.config.ts`) | §3, §5, §15 |
| D-064 | Node | 24 LTS | §3 |
| D-065 | Express | Express 5 | §3, §13 |
| D-066 | Dev/build/alias | `tsx watch` + bundle (tsdown/esbuild) con alias `@/` | §3 |
| D-067 | Carpetas | Módulos + `domain/` puro | §4 |
| D-068 | Entrada | `app.ts` + `server.ts` con dependencias inyectadas | §4.2 |
| D-069 | Datos | Prisma directo en los servicios | §4, §8–§11 |
| D-070 | Reglas de dominio | Implementadas en el back con casos acordados con el front | §4.3, §19 |
| D-071 | Ids | UUID v4 en todo | §5 |
| D-072 | Textos ES/EN | Dos columnas: `xxxEs` obligatoria, `xxxEn` opcional | §5 |
| D-073 | Grupos de opciones | De cada plato + `position` | §5 |
| D-074 | Mesa | Clave compuesta (restaurante, número) con FK compuesta | §5 |
| D-075 | Valores fijos | Enums nativos; etiquetas como lista | §5 |
| D-076 | Importes | `Int` en precios; `BigInt` en `totalCents` | §5, §6 |
| D-077 | Fechas | `timestamptz(3)` + reloj inyectado | §5, §4.2 |
| D-078 | Formato de ids de entrada | Estricto | §13.2 |
| D-079 | Copia de líneas | Tablas sin FK a la carta | §5 |
| D-080 | `statusHistory` | Tabla `OrderStatusChange` | §5 |
| D-081 | Idempotencia | En `Order`, única (restaurante, `clientRequestId`) + SHA-256 | §5, §8 |
| D-082 | Código corto | Advisory lock por restaurante | §8.6 |
| D-083 | Idempotencia en R3.2 | Primero, antes de mesa → forma → líneas → precio | §8.1 |
| D-084 | Detalle de rechazos | Todos los problemas y todas las líneas | §8.4, §8.5 |
| D-085 | Notas | Recortar; vacía = sin nota | §8.3 |
| D-086 | Caracteres visibles | `Intl.Segmenter` | §8.3 |
| D-087 | Personal ↔ restaurante | `StaffMember` sin FK a `auth.users` | §5, §12 |
| D-088 | JWT | `jose` + JWKS (proyecto con claves asimétricas) | §12 |
| D-089 | Token válido no-personal | 401 | §12 |
| D-090 | Token REST | `Authorization: Bearer` | §12 |
| D-091 | Auth WS | Query param `accessToken`, tapado en logs | §7.3, §15 |
| D-092 | Cierres de auth | 4401/4403 + cierre al vencer `exp` | §7.4 |
| D-093 | Montaje WS | `noServer` + `upgrade` propio | §7.2 |
| D-094 | Casos WS | Mesa inactiva aceptada, restaurante inexistente 4404, staff+tableId 4400, máx. 20 mesas, `maxPayload` 16 KB | §7.3 |
| D-095 | Concurrencia PATCH | Update condicional | §9 |
| D-096 | Eventos | Bus en memoria tras COMMIT | §11 |
| D-097 | Cancelación cliente | `POST /api/orders/{id}/cancel` | §10 |
| D-098 | `GET /api/orders` | `createdAt` desc + máximos de filtros | §6.6 |
| D-099 | Códigos extra | `UNAUTHORIZED`, `RATE_LIMITED`; `message` en inglés | §13 |
| D-100 | Campo con error | `details.issues` | §13 |
| D-101 | Validación | Middleware `validate` + `AppError` + manejador central | §13 |
| D-102 | POST con restaurante inexistente | 422 `INVALID_TABLE` | §8.1 |
| D-103 | Infra transversal | `express-rate-limit` en memoria (1 min, `TRUST_PROXY`) · `pino` + `pino-http` con `redact` · carga nativa de env · `cors` con `CORS_ORIGINS` (también para el WS), sin `helmet`, sin `x-powered-by` | §14–§16 |
| D-104 | Rate limit de la cancelación | Sí, mismo límite (amplía RNF7) | §14 |
| D-105 | Conexión Supabase | Supavisor modo sesión (5432) como `DATABASE_URL`, `DB_POOL_MAX`; rol propio `prisma` | §17 |
| D-106 | Data API | RLS sin políticas en todas las tablas (SQL en migraciones) + Data API desactivada (paso manual) | §5.3, §17 |
| D-107 | BD de tests | Postgres local con `docker compose`, misma versión mayor que Supabase | §18 |
| D-108 | Aislamiento y seed | Un restaurante por test + limpieza al inicio; `prisma/seed.ts` con upserts, manual | §18 |
| D-109 | Carta demo | Copia de `menuData.ts` del front, sin imágenes, ids UUID v4 | §18.4 |
| D-110 | Personal en seed y versiones | Usuario a mano + `SEED_STAFF_USER_ID`; versiones exactas + lockfile | §3, §18.4 |
| D-111 | Siguiente paso tras DS-1..DS-53 | Redactar `diseno.md` | Este documento |
| D-112 | Commit y push de las decisiones | Commit + push a `chore/backend-specs` | — |
| D-113 | Formato de `lineId` (P1) | Texto no vacío de hasta 4096 caracteres (ajusta D-078 para `lineId`) | §5.1, §8.2, §13.2 |
| D-114 | `lineId` repetido (P2) | 400 `VALIDATION` (sumado a R3.4 v2.1) | §8.2 |
| D-115 | `tableId` ausente o no entero en el POST (P3) | 422 `INVALID_TABLE` | §8.1 |
| D-116 | Significado de `dish_unavailable` (P4) | Igual que el front: plato no pedible, solo ese motivo | §8.4 |
| D-117 | Contador del rate limit de la cancelación (P5) | Contador propio | §14 |
| D-118 | Límite del cuerpo JSON (P6) | 100 KB | §4.2, §13.1 |
| D-119 | Plato fantasma en el seed (P7) | Se omite | §18.4 |
| D-120 | Restricciones `CHECK` (P8) | SQL en las migraciones | §5.1, §5.4 |
| D-121 | Pertenencia del plato al restaurante (P9) | Por su categoría, sin columna propia | §5.1, §8.4 |
| D-122 | Entorno de los tests (P10) | `.env.test` fuera de git + `.env.test.example` | §17.1, §18.2 |
| D-123 | Defaults de env (P11) | `PORT` 3000 · `LOG_LEVEL` info · `TRUST_PROXY` false · `DB_POOL_MAX` 10 | §17.1 |
| D-124 | Requisitos v2.1 | Aplicados (R3.2, R3.4, R6, RNF7); se aprueban junto con este diseño | Todo el documento |
| D-125 | Signo de `priceDeltaCents` | `CHECK ("priceDeltaCents" >= 0)`; sin adicionales con descuento | §5.4 |
| D-126 | Confirmación del front (F1–F16) | Confirmados tal cual | §19 |
| D-127 | Aprobación de requisitos v2.1 y diseño v1.1 | Ambos APROBADOS | Todo el documento |
| D-128 | Commit + push de lo aprobado y arranque de la Fase 3 | Commit + push y arrancar | — |
| D-129 | Herramienta de bundle (abierta en D-066) | tsdown | §3 |
| D-130 | ESLint y Prettier | `@eslint/js` + `typescript-eslint` recommended + `eslint-config-prettier`; Prettier por defecto | §3 |
| D-131 | Postgres de Docker | `postgres:<mayor de Supabase>` en el puerto 5433, `postgres`/`postgres` solo locales | §18.2, §23 |
| D-132 | `prisma generate` | Script `db:generate` + README | §3, §23 |
| D-133 | Base de desarrollo y momento de crear Supabase | Docker (base de desarrollo separada de la de tests); Supabase al final (T41–T42 de `tareas.md`) | §17, §18.2 |
| D-134 | Confirmación de acciones locales | `docker compose up` y `npm test` sobre Docker local aprobados una vez; Supabase, `npm install`, commits y push siempre con confirmación | — (proceso) |
| D-135 | Pruebas no funcionales | N=100 + carta de 200 platos + escenario de 10 restaurantes × 50 pedidos activos | §18.3 |
| D-136 | Ramas, commits y PRs | Rama por bloque `feature/backend-001-<bloque>`, commit por tarea, PR a `develop` por bloque | — (git) |
| D-137 | Integración continua | GitHub Actions: lint, typecheck y tests con Postgres como servicio | §23 |

---

## 3. Base técnica (D-063..D-066, D-110)
- **Runtime:** Node 24 LTS (`engines.node` en `package.json`). ESM (`"type": "module"`), obligatorio con Prisma 7.
- **Lenguaje:** TypeScript `strict`; `moduleResolution: "bundler"` y `paths: { "@/*": ["./src/*"] }` para el alias `@/` (`codigo.md`).
- **Desarrollo:** `tsx watch --env-file-if-exists=.env src/server.ts`, con la salida pasada por `pino-pretty` en el script (así `pino-pretty` queda solo como dependencia de desarrollo, D-103).
- **Build:** bundle a `dist/server.js` con tsdown o esbuild (D-066 deja la herramienta a verificar en T1: tsup anunció que no se mantiene activamente). Producción: `node --env-file-if-exists=.env dist/server.js`.
- **Prisma 7:** generador `prisma-client` con `output = "../src/generated/prisma"` (carpeta ignorada en git, se regenera con `prisma generate`); cliente creado con `@prisma/adapter-pg`. `prisma.config.ts` usa `process.loadEnvFile()` (D-103) y define `schema`, `migrations.path`, `migrations.seed = "tsx prisma/seed.ts"` y `datasource.url = env("DIRECT_URL")` (la URL de migraciones, D-017). `DATABASE_URL` solo la usa la app, en el adaptador.
- **Dependencias de producción previstas:** `express`, `ws`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `zod`, `jose`, `pino`, `pino-http`, `express-rate-limit`, `cors`. **Desarrollo:** `typescript`, `tsx`, `prisma`, tsdown o esbuild, `vitest`, `supertest`, `pino-pretty`, ESLint + Prettier, tipos (`@types/express`, `@types/ws`, `@types/cors`, `@types/supertest`, `@types/pg`, `@types/node`). Versiones: última estable al ejecutar T1, exactas (`.npmrc` con `save-exact=true`) y `package-lock.json` commiteado (D-110). La instalación se confirma con el usuario (CLAUDE.md §6).
- **Scripts previstos:** `dev`, `build`, `start`, `test`, `test:watch`, `lint`, `typecheck`, `db:migrate` (`prisma migrate dev`), `db:deploy` (`prisma migrate deploy`), `db:seed` (`prisma db seed`), `db:test:up` (`docker compose up -d`).

## 4. Arquitectura

### 4.1 Carpetas de `backend/` (D-067)
```
backend/
├── package.json · package-lock.json · .npmrc · tsconfig.json · eslint.config.js · .prettierrc
├── prisma.config.ts · vitest.config.ts · tsdown|esbuild config · docker-compose.yml (BD de tests)
├── .env.example · .gitignore (.env, dist/, src/generated/)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/              # SQL generado + RLS agregado a mano (D-106)
│   ├── seed.ts                  # upserts idempotentes (D-108)
│   └── seed-data/fogon.ts       # carta demo copiada del front (D-109)
├── src/
│   ├── server.ts                # env → Prisma → app → realtime → listen → apagado ordenado
│   ├── app.ts                   # createApp(deps): Express sin listen
│   ├── env.ts                   # Zod sobre process.env (D-016)
│   ├── generated/prisma/        # cliente Prisma (no se commitea)
│   ├── domain/                  # puro: sin Express, Prisma ni ws
│   │   ├── types.ts             # tipos del contrato (§6 del plan del front)
│   │   ├── order-status.ts      # ORDER_FLOW, FINAL_STATUSES, canTransition, applyTransition, applyClientCancel
│   │   ├── selection.ts         # canonicalSelection, validateLine
│   │   ├── pricing.ts           # unitPriceCents, lineTotalCents, orderTotalCents
│   │   ├── short-code.ts        # SHORT_CODE_ALPHABET, generateUniqueCode
│   │   ├── fingerprint.ts       # contenido canónico + SHA-256
│   │   ├── text.ts              # countVisibleChars, normalizeNote
│   │   └── limits.ts            # MAX_QTY 20, MAX_LINES 50, NOTE_MAX 140, ORDER_NOTE_MAX 200, ventanas 12 h / 24 h
│   ├── modules/
│   │   ├── menu/                # menu.router.ts · menu.service.ts · menu.schemas.ts · menu.mapper.ts
│   │   ├── tables/              # tables.router.ts · tables.service.ts · tables.schemas.ts
│   │   ├── orders/              # orders.router.ts · create-order.service.ts · change-status.service.ts
│   │   │                        # cancel-order.service.ts · list-orders.service.ts · orders.schemas.ts · order.mapper.ts
│   │   ├── staff/               # token-verifier.ts (jose) · staff-auth.ts (middleware y resolución de StaffMember)
│   │   └── realtime/            # upgrade.ts · hub.ts · connection.ts · protocol.ts (Zod + sobres) · close-codes.ts
│   └── shared/
│       ├── errors.ts            # AppError, códigos, helpers
│       ├── error-handler.ts     # manejador central (D-101)
│       ├── validate.ts          # middleware validate({ body, query, params }) → res.locals (D-101)
│       ├── rate-limit.ts        # limitadores (D-103, D-104)
│       ├── logger.ts            # pino + redact (D-103)
│       ├── db.ts                # createPrismaClient(DATABASE_URL, DB_POOL_MAX)
│       ├── event-bus.ts         # bus en memoria tipado (D-096)
│       ├── restaurants.ts       # findRestaurantBySlug
│       └── clock.ts · random.ts # dependencias inyectables (D-077)
└── test/
    ├── global-setup.ts          # migrate deploy + limpieza al inicio de la corrida (D-108)
    ├── helpers/                 # fábricas (restaurante con slug aleatorio, carta, mesas), firmador JWT de prueba, cliente ws
    ├── unit/                    # domain/*
    └── integration/             # menu, tables, orders-create, orders-status, orders-cancel, orders-list, auth, ws, rate-limit, cors, rls
```
Nombres de archivo en kebab-case (`codigo.md`). `event-bus.ts` vive en `shared/` para que `orders` no dependa de `realtime`.

### 4.2 Punto de entrada y dependencias inyectadas (D-068, D-077)
```ts
interface AppDeps {
  prisma: PrismaClient; clock: { now(): Date }; random: () => number;
  tokenVerifier: TokenVerifier; bus: OrderEventBus; logger: Logger;
  config: { corsOrigins: string[]; trustProxy: boolean | number; jsonLimit: '100kb' /* D-118 */ };
}
createApp(deps): Express
attachRealtime(server: http.Server, deps & { heartbeat: { intervalMs: number; missedLimit: number }; maxPayload: number }): { close(code: number): Promise<void> }
```
- `server.ts`: `parseEnv(process.env)` → `createPrismaClient` → `createApp` → `http.createServer(app)` → `attachRealtime` → `listen(PORT)`.
- Apagado ordenado (SIGTERM/SIGINT): deja de aceptar conexiones (`server.close`), cierra cada WS con **1001**, detiene los intervalos, `prisma.$disconnect()`.
- En tests: `createApp` con Supertest, `attachRealtime` sobre un servidor en puerto aleatorio, reloj y aleatorio fijos, verificador con claves propias y heartbeat acelerado.

### 4.3 Reglas de dominio (D-070)
Mismos nombres y casos que el front (§6 del plan), implementados en el back:
- `canTransition(from, to)`: falso si `from === to` o `from` es final; `cancelled` desde cualquier no final; **un paso adelante o un paso atrás** en `ORDER_FLOW` (D-025, D-060). Difiere del front (que no tiene retroceso): ver §19.
- `applyTransition(order, to, expectedStatus, now)` → `noop | conflict | invalid | applied` en ese orden de chequeo (igual que el front).
- `applyClientCancel(order, now)` → `invalid` si `status !== 'pending'`; si no, `applied` a `cancelled` (R6.1, R6.2).
- `validateLine(dish | null, line)` → `LineIssue[]` (§8.4). `canonicalSelection` igual que el front (grupos ordenados por id, opciones ordenadas, grupos vacíos fuera).
- `generateUniqueCode(existing, random)`: alfabeto `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, 4 caracteres, hasta 20 intentos; si se agotan, lanza (→ 500 `SERVER` con log).
- `countVisibleChars` con `Intl.Segmenter` granularidad grafema (D-086). `normalizeNote(s)` = `s.trim()`; `''` → `undefined` (D-085).

---

## 5. Modelo de datos (Prisma, D-071..D-081, D-087)

### 5.1 Entidades
Convenciones: ids `String @id @default(uuid(4)) @db.Uuid` (D-071); fechas `DateTime @db.Timestamptz(3)` asignadas por la app con el reloj inyectado, sin `@default(now())` ni `@updatedAt` (D-077); textos ES/EN en dos columnas (D-072); `position Int` interno para ordenar (D-073; en categorías y platos se expone como `order`).

```prisma
enum OrderStatus     { pending accepted preparing ready delivered cancelled }
enum OptionGroupType { single multiple }
enum CategoryVisual  { starter main grill pasta dessert drink }
enum DietaryTag      { vegetarian vegan gluten_free spicy }

model Restaurant {
  id         String        @id @default(uuid(4)) @db.Uuid
  slug       String        @unique @db.VarChar(50)
  categories Category[]
  tables     Table[]
  orders     Order[]
  staff      StaffMember[]
}

model Table {                                    // D-059, D-074
  restaurantId String     @db.Uuid
  number       Int
  active       Boolean    @default(true)
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  orders       Order[]
  @@id([restaurantId, number])
}

model Category {
  id           String         @id @default(uuid(4)) @db.Uuid
  restaurantId String         @db.Uuid
  position     Int
  nameEs       String
  nameEn       String?
  visual       CategoryVisual
  restaurant   Restaurant     @relation(fields: [restaurantId], references: [id])
  dishes       Dish[]
  @@index([restaurantId, position])
}

model Dish {                                     // D-121: pertenece al restaurante por su categoría
  id            String        @id @default(uuid(4)) @db.Uuid
  categoryId    String        @db.Uuid
  position      Int
  nameEs        String
  nameEn        String?
  descriptionEs String
  descriptionEn String?
  priceCents    Int                              // D-076
  imageUrl      String?
  tags          DietaryTag[]  @default([])       // D-075
  available     Boolean       @default(true)
  featured      Boolean       @default(false)
  category      Category      @relation(fields: [categoryId], references: [id])
  optionGroups  OptionGroup[]
  @@index([categoryId, position])
}

model OptionGroup {                              // D-073: grupo propio de cada plato
  id       String          @id @default(uuid(4)) @db.Uuid
  dishId   String          @db.Uuid
  position Int
  nameEs   String
  nameEn   String?
  type     OptionGroupType
  min      Int
  max      Int
  dish     Dish            @relation(fields: [dishId], references: [id])
  options  Option[]
  @@index([dishId, position])
}

model Option {
  id              String      @id @default(uuid(4)) @db.Uuid
  groupId         String      @db.Uuid
  position        Int
  nameEs          String
  nameEn          String?
  priceDeltaCents Int
  available       Boolean     @default(true)
  group           OptionGroup @relation(fields: [groupId], references: [id])
  @@index([groupId, position])
}

model StaffMember {                              // D-087: sin FK a auth.users
  userId       String     @id @db.Uuid           // `sub` del JWT de Supabase
  restaurantId String     @db.Uuid               // D-028: exactamente un restaurante
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  @@index([restaurantId])
}

model Order {
  id                 String              @id @default(uuid(4)) @db.Uuid
  restaurantId       String              @db.Uuid
  tableNumber        Int                                  // se expone como `tableId`
  code               String              @db.Char(4)
  clientRequestId    String              @db.Uuid         // D-081
  requestFingerprint String              @db.Char(64)     // SHA-256 hex (D-081)
  note               String?
  totalCents         BigInt                               // D-076
  status             OrderStatus
  createdAt          DateTime            @db.Timestamptz(3)
  updatedAt          DateTime            @db.Timestamptz(3)
  restaurant         Restaurant          @relation(fields: [restaurantId], references: [id])
  table              Table               @relation(fields: [restaurantId, tableNumber], references: [restaurantId, number]) // D-074
  items              OrderItem[]
  statusChanges      OrderStatusChange[]
  @@unique([restaurantId, clientRequestId])            // idempotencia por restaurante (D-081)
  @@index([restaurantId, createdAt(sort: Desc)])       // códigos de 24 h, listados, ventana de 12 h
  @@index([restaurantId, updatedAt])                   // `since`
  @@index([restaurantId, tableNumber, createdAt])      // filtro por mesa
}

model OrderItem {                                // D-079: copia sin FK a la carta
  id             String            @id @default(uuid(4)) @db.Uuid
  orderId        String            @db.Uuid
  position       Int                                  // orden del cuerpo del POST
  lineId         String        @db.VarChar(4096)      // D-113
  dishId         String            @db.Uuid           // sin FK
  nameEs         String
  nameEn         String?
  quantity       Int
  unitPriceCents Int                                  // base + adicionales (I4)
  note           String?
  order          Order             @relation(fields: [orderId], references: [id])
  options        OrderItemOption[]
  @@unique([orderId, position])
}

model OrderItemOption {
  id              String    @id @default(uuid(4)) @db.Uuid
  orderItemId     String    @db.Uuid
  position        Int
  groupId         String    @db.Uuid                  // sin FK
  optionId        String    @db.Uuid                  // sin FK
  nameEs          String
  nameEn          String?
  priceDeltaCents Int
  orderItem       OrderItem @relation(fields: [orderItemId], references: [id])
  @@unique([orderItemId, position])
}

model OrderStatusChange {                        // D-080
  id      String      @id @default(uuid(4)) @db.Uuid
  orderId String      @db.Uuid
  status  OrderStatus
  at      DateTime    @db.Timestamptz(3)
  order   Order       @relation(fields: [orderId], references: [id])
  @@index([orderId, at])
}
```
- Relaciones con el `onDelete` por defecto de Prisma (Restrict): los pedidos no se borran (D-034) y una mesa con pedidos se desactiva en lugar de borrarse.
- Restricciones `CHECK` de la carta y del pedido: SQL agregado a mano en las migraciones (D-120), detalle en §5.4.
- `Dish` no tiene `restaurantId`: el restaurante se obtiene por `category.restaurantId` (D-121). Las consultas de carta y de líneas filtran por la categoría.

### 5.2 Mapeo al contrato
- `Menu`: categorías por `position` (`order` = `position`); platos ordenados por (posición de la categoría, `position`); grupos y opciones por `position`. `LocalizedText` = `{ es: xxxEs, en?: xxxEn }` (se omite `en` si es `null`, R1.6). `imageUrl` se omite si es `null`.
- `Order`: `tableId` = `tableNumber`; `totalCents` = `Number(bigint)` en un único lugar (`order.mapper.ts`, D-076; seguro hasta 2^53); `note` y `items[].note` se omiten si son `null`; fechas con `toISOString()`; `statusHistory` = `OrderStatusChange` ordenado por `at` ascendente; `items` por `position`; `options` por `position`.

### 5.3 RLS (D-106)
Cada migración que crea tablas se genera con `prisma migrate dev --create-only` y se le agrega `ALTER TABLE "<tabla>" ENABLE ROW LEVEL SECURITY;` por cada tabla nueva, sin políticas. La primera migración incluye también `"_prisma_migrations"` ("todas las tablas"). El rol `prisma` tiene `bypassrls` (D-105), así que la app no se ve afectada. Un test de integración verifica que toda tabla de `public` tenga `relrowsecurity = true`.

---

### 5.4 Restricciones `CHECK` (D-120)
Se agregan a mano al SQL de la migración (como el RLS, §5.3), con nombre propio para que el error sea identificable:

| Tabla | Restricción |
|---|---|
| `Table` | `number >= 1` |
| `Dish` | `"priceCents" >= 0` |
| `OptionGroup` | `min >= 0` · `max >= min` · `type <> 'single' OR max = 1` |
| `Option` | `"priceDeltaCents" >= 0` (D-125) |
| `OrderItem` | `quantity BETWEEN 1 AND 20` |

Prisma no modela `CHECK`: una violación llega como error de base y el manejador central la convierte en 500 `SERVER` con log (solo puede pasar con datos cargados a mano; la API valida antes). Un test de integración verifica que cada restricción rechaza un valor inválido.

## 6. Contratos REST
Prefijo `/api` (D-055). JSON camelCase, centavos enteros, fechas ISO 8601 UTC (RNF10). Errores `{ code, message, details? }` (§13).

| Método y ruta | Entrada | Éxito | Errores | Auth | Rate limit |
|---|---|---|---|---|---|
| `GET /api/menu` | query `restaurant` | 200 `Menu` | 400 `VALIDATION` · 404 `NOT_FOUND` | No (R1.7) | 120/min/IP (RNF7) |
| `GET /api/tables/{tableId}` | params `tableId` · query `restaurant` | 200 `{ id: number }` | 400 · 404 | No (R2.4) | — |
| `POST /api/orders` | header `Idempotency-Key` · body `CreateOrderInput` + `restaurant` | 201 `Order` (nuevo) · 200 `Order` (reintento) | 400 · 409 `IDEMPOTENCY_CONFLICT` · 422 `INVALID_TABLE` · 422 `LINES_REJECTED` · 409 `PRICE_CHANGED` · 429 · 500 | No (R3.14) | 20/min/IP (RNF7) |
| `GET /api/orders` | query `restaurant`, `ids`, `tableId`*, `status`, `since`, `clientRequestId` | 200 `Order[]` | 400 · 401 `UNAUTHORIZED` · 404 | Según filtros (R10.3, R10.4) | — |
| `PATCH /api/orders/{id}/status` | params `id` · body `{ status, expectedStatus }` | 200 `Order` | 401 · 400 · 404 · 409 `STATUS_CONFLICT` · 409 `INVALID_TRANSITION` | Personal (R8.1) | — |
| `POST /api/orders/{id}/cancel` | params `id` · body `{ clientRequestId }` | 200 `Order` | 400 · 404 · 409 `INVALID_TRANSITION` · 429 | No (R6.4) | 20/min/IP, contador propio (D-104, D-117) |
| Cualquier otra ruta | — | — | 404 `NOT_FOUND` (D-099) | — | — |

### 6.1 `GET /api/menu`
`restaurant` según §13.2. Restaurante inexistente → 404. Una sola consulta: categorías del restaurante con platos, grupos y opciones (`include` anidado, ordenado por `position`). Incluye no disponibles con `available: false` (R1.2).

### 6.2 `GET /api/tables/{tableId}`
`tableId` entero positivo (R2.3, también con `restaurant` faltante → 400). 200 `{ id: tableId }` si existe y `active`; si no existe, está inactiva o el restaurante no existe → 404 (R2.2).

### 6.3 `POST /api/orders`
Body: `{ restaurant, clientRequestId, tableId, items: [{ lineId, dishId, quantity, selection, note? }], note?, expectedTotalCents }` (D-045 agrega `restaurant`). Flujo completo en §8.

### 6.4 `PATCH /api/orders/{id}/status`
Body `{ status: OrderStatus, expectedStatus: OrderStatus }`. Flujo en §9. `INVALID_TRANSITION` sin `details`; `STATUS_CONFLICT` con `details.order` (R5.6).

### 6.5 `POST /api/orders/{id}/cancel` (D-097)
Body `{ clientRequestId: uuid }`, sin `restaurant`. Flujo en §10. `INVALID_TRANSITION` con `details.order` (el pedido actual, R6.2).

### 6.6 `GET /api/orders` (D-055, D-098)
- Query: `restaurant` (obligatorio); `ids=a,b` (lista separada por comas de UUID, máx. 100); `tableId` (repetible, entero positivo, máx. 20); `status=pending,accepted` (lista de `OrderStatus`); `since` (fecha ISO 8601 UTC con `Z`, ms opcionales, según RNF10); `clientRequestId` (UUID). Más de los máximos o formato inválido → 400.
- Semántica: filtros combinados con Y; `since` = `updatedAt > since` (estricto); ids inexistentes se omiten (R10.1). `tableId` sin `ids`, `since` ni `clientRequestId` → solo `createdAt ≥ now − 12 h` (R10.2). Orden `createdAt` desc, sin tope de resultados (D-098).
- Acceso: si hay `ids`, `tableId` o `clientRequestId` → público (R10.3; un token presente se ignora). Si no (solo `status`/`since` o ningún filtro) → requiere token de personal **de ese restaurante**; si falta, es inválido o es de otro restaurante → 401 `UNAUTHORIZED` (R8.3, D-089).
- Orden de chequeo: forma (400) → si la consulta es de todo el restaurante, auth (401) → restaurante inexistente (404).

---

## 7. Protocolo WebSocket `/ws/orders` (D-042, D-091..D-094)

### 7.1 Sobre (R9.2)
`{ v: 1, id, type, ts, payload }` en ambos sentidos. Saliente: `id` = UUID v4 nuevo por mensaje, `ts` = `clock.now().toISOString()`. Un evento se serializa una vez y ese mismo mensaje (mismo `id`) se envía a cada conexión destinataria, una sola vez por conexión aunque esté suscrita a varias mesas del pedido.

### 7.2 Montaje y handshake HTTP (D-093, D-103)
`new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 })` (D-094) y `server.on('upgrade')` propio:
1. Ruta distinta de `/ws/orders` → se destruye el socket.
2. Header `Origin` presente y fuera de `CORS_ORIGINS` → respuesta HTTP 403 y se destruye el socket (R9.4). Sin `Origin` (cliente que no es navegador) → se acepta (D-093).
3. `handleUpgrade` → la conexión queda abierta pero **no registrada en el hub** hasta terminar §7.3: no recibe eventos (R8.2).

### 7.3 Validación de la suscripción (antes del `welcome`)
Query: `restaurant` (slug, §13.2), `scope` (solo `staff`), `tableId` (repetible, entero positivo), `accessToken` (solo con `scope=staff`).

| Chequeo (en orden) | Resultado si falla |
|---|---|
| Forma: `restaurant` válido; exactamente uno de `scope=staff` o ≥ 1 `tableId`; `scope` desconocido; `staff` + `tableId`; más de 20 `tableId`; `tableId` no entero positivo | Cierre **4400** |
| Restaurante existe | Cierre **4404** (D-094) |
| Staff: `accessToken` presente y válido (§12) | Cierre **4401** (D-092) |
| Staff: el `sub` es `StaffMember` de ese restaurante | Cierre **4403** (D-092) |
| Mesas: todas existen en el restaurante (activas o inactivas, D-094) | Cierre **4404** (R9.4) |
| Error interno durante la validación | Cierre **1011** con log |

Superado todo: se registra en el hub y se envía primero `system.welcome` `{ connectionId: uuid, heartbeatSec: 25, subscription: { tableIds } | { scope: 'staff' } }` (R9.3).

### 7.4 Ciclo de vida
- **Heartbeat (R9.5):** `system.ping` `{}` cada 25 s; cada `system.pong` actualiza `lastPongAt`; si pasan dos intervalos sin pong → cierre **4408**. Intervalo y límite inyectados (D-068).
- **Vencimiento del token (R8.4, D-092):** al aceptar una conexión staff se programa un temporizador a `exp`; al vencer → cierre **4401** (el front reconecta con un token fresco). 4403 es permanente.
- **Entrantes (R9.6–R9.8):** frame binario, JSON inválido o sobre que no cumple el esquema Zod → `system.error` `{ code: 'BAD_MESSAGE', message }` sin cerrar. `system.pong` → heartbeat. `table.call_waiter` → `system.error` `NOT_IMPLEMENTED`. Cualquier otro `type` → se ignora. Un frame mayor a 16 KB lo cierra `ws` con 1009 (comportamiento de la librería).
- **Apagado del servidor:** cierre **1001** (§4.2).
- `message` de `system.error` en inglés (D-099). Los motivos de cierre (`reason`) son textos cortos en inglés, sin datos internos.

| Código | Cuándo | Reintento del front |
|---|---|---|
| 4400 | Parámetros inválidos | No |
| 4401 | Token faltante, inválido o vencido (también al llegar `exp`) | Sí, con token fresco |
| 4403 | Usuario válido que no es personal de ese restaurante | No |
| 4404 | Restaurante o alguna mesa inexistente | No |
| 4408 | Sin `system.pong` en dos intervalos | Sí |
| 1001 / 1011 | Apagado / error interno | Sí |

### 7.5 Hub (D-096)
Estado en memoria: `Map<restaurantId, { staff: Set<Conn>; tables: Map<tableNumber, Set<Conn>> }>`. Al cerrar una conexión se quita de todos sus conjuntos y se cancelan sus temporizadores. Destinatarios de un evento del pedido P = `staff(P.restaurantId) ∪ tables(P.restaurantId, P.tableNumber)` (R7.1–R7.3). Solo se envía a conexiones en estado `OPEN`.

---

## 8. Creación de pedido (R3, R4)

### 8.1 Orden de validación (R3.2 según D-083, D-102)
```
0. rate limit 20/min/IP (RNF7)
1. Etapa 0 (400 VALIDATION): body es objeto JSON; `restaurant` (slug), `clientRequestId` (UUID),
   header `Idempotency-Key` (UUID) presente e idéntico a `clientRequestId` (R3.4, D-078)
2. Restaurante por slug. Inexistente → se salta 3 y en 4 responde 422 INVALID_TABLE (D-102)
3. Idempotencia (D-083): buscar Order (restaurantId, clientRequestId)
     existe → parsear el cuerpo con el esquema completo (etapas 4-5 de forma):
              falla         → 409 IDEMPOTENCY_CONFLICT (el registrado era válido: el contenido difiere)
              huella igual  → 200 con el pedido actual, sin eventos (R3.10)
              huella otra   → 409 IDEMPOTENCY_CONFLICT (R3.11)
     no existe → seguir
4. Mesa (R3.3): (restaurante, tableId) existe y `active` → si no, 422 INVALID_TABLE
     tableId ausente o no entero → también 422 INVALID_TABLE (D-115, igual que el mock del front)
5. Forma (R3.4) → 400 VALIDATION con details.issues (§8.2)
6. Líneas (R3.5) → 422 LINES_REJECTED con details.lines (§8.4)
7. Precio (R3.6, R3.7) → 409 PRICE_CHANGED (§8.5)
8. Transacción (§8.6) → 201 Order → publicar order.created (§11)
```
Ningún rechazo de los pasos 1–7 escribe en la base: la clave queda guardada solo con el pedido (R3.12).

### 8.2 Esquema de forma (etapa 5)
- `items`: array de 1 a 50 elementos (R3.4, D-054).
- Por línea: `lineId` texto no vacío de hasta 4096 caracteres (D-113), único dentro del pedido: un repetido → 400 `VALIDATION` (D-114, R3.4 v2.1); `dishId` UUID; `quantity` entero 1–20; `selection` objeto `{ [groupId: UUID]: optionId: UUID[] }`; `note?` string.
- `note?` string; `expectedTotalCents` entero seguro.
- Notas: se normalizan (§8.3) y se cuentan en caracteres visibles: línea ≤ 140, general ≤ 200 (R3.4).
- No se fusionan líneas iguales (R3.13).

### 8.3 Notas (D-085, D-086)
`normalizeNote`: `trim()`; si queda vacía, no hay nota (no se guarda ni aparece en `Order`). El límite se cuenta después de recortar con `Intl.Segmenter` (grafemas: un emoji = 1). La huella usa la nota normalizada.

### 8.4 Validación de líneas (D-084)
Platos pedidos se cargan en una consulta filtrada por el restaurante a través de su categoría (D-121; los de otro restaurante no aparecen → `dish_not_found`, R11.3), con grupos y opciones. Por cada línea con plato pedible se reportan **todos** sus problemas (D-084):
- Plato inexistente → `dish_not_found` (no se sigue con esa línea).
- Plato no pedible → `dish_unavailable` y **solo ese motivo** para la línea (D-116, igual que `validateLine` del front). "No pedible" = `available = false` o algún grupo con menos opciones disponibles que su `min` (`isDishOrderable` del front).
- Grupo de la selección que no es del plato → `selection_invalid` con `groupId` (D-084).
- Opción inexistente o de otro grupo → `option_not_found` con `groupId` y `optionId` (D-084).
- Opción con `available = false` → `option_unavailable` con `groupId` y `optionId`.
- Opciones repetidas en un grupo → `selection_invalid` con `groupId` (D-084).
- Cantidad elegida fuera de `min`/`max` del grupo → `selection_invalid` con `groupId`.
- Un grupo con array vacío equivale a no elegir nada en ese grupo (como `canonicalSelection` del front).
Si hay al menos un problema → 422 `LINES_REJECTED` con `details.lines[]: { lineId, dishId, reason, groupId?, optionId? }`, en el orden de las líneas del cuerpo.

### 8.5 Precio (R3.6, R3.7, D-053, D-084)
`unitPriceCents = dish.priceCents + Σ priceDeltaCents` de las opciones elegidas; línea = unit × quantity; total = Σ líneas (aritmética entera en `number`: el máximo posible, 50 × 20 × 2^31, entra en 2^53). Si `total !== expectedTotalCents` → 409 `PRICE_CHANGED` con `details.totalCents` y `details.priceLines[{ lineId, unitPriceCents }]` de **todas** las líneas (D-084).

### 8.6 Transacción (R3.8, R3.9, R4, D-082)
Las lecturas de validación (pasos 3–7) van fuera de la transacción (la carta no tiene ABM en esta spec). Luego, `prisma.$transaction(async (tx) => …)`:
1. `SELECT pg_advisory_xact_lock(hashtextextended('order-code:' || <restaurantId>, 0))` — serializa las altas del restaurante (D-082).
2. Códigos de pedidos del restaurante con `createdAt > now − 24 h`.
3. `generateUniqueCode(códigos, random)`; agotado → excepción → rollback → 500 `SERVER` con log (R3.9).
4. `order.create` con `status = pending`, `createdAt = updatedAt = now`, `requestFingerprint`, `items` (copia de nombres ES/EN, cantidad, nota normalizada, `unitPriceCents`; opciones con `groupId`, `optionId`, nombres y `priceDeltaCents`, ordenadas por posición de grupo y de opción) y el primer `OrderStatusChange { pending, at: now }` — todo anidado en la misma transacción (R4.1).
- Error de unicidad (Prisma `P2002`) en (restaurante, `clientRequestId`) por dos envíos simultáneos con la misma clave: el perdedor relee y responde 200 (misma huella) o 409 `IDEMPOTENCY_CONFLICT`, sin eventos.
- Cualquier otro error → rollback, 500 `SERVER` con mensaje genérico, detalle solo en el log, sin eventos (R4.2).

### 8.7 Huella (D-081)
SHA-256 hex de `JSON.stringify` de `{ tableId, note: nota normalizada ?? '', expectedTotalCents, items: ordenadas por lineId → { lineId, dishId, quantity, selection: canonicalSelection, note: normalizada ?? '' } }`. El restaurante no entra porque la unicidad ya es por restaurante; `clientRequestId` no entra (igual que `submissionFingerprint` del front).

## 9. Cambio de estado por el personal (R5, D-052, D-095)
```
auth Bearer (401) → params id UUID y body (400, R5.8) → transacción:
  order = findFirst({ id, restaurantId: staff.restaurantId })  → null → 404 (R5.9)
  r = applyTransition(order, status, expectedStatus, now)
    noop      → 200 con el pedido, sin eventos (R5.5)
    conflict  → 409 STATUS_CONFLICT details.order (R5.6)
    invalid   → 409 INVALID_TRANSITION (R5.3, R5.4, R5.7)
    applied   → updateMany({ where: { id, status: order.status }, data: { status, updatedAt: now } })
                count 0 → releer → 409 STATUS_CONFLICT con el pedido actual (R5.10)
                count 1 → insertar OrderStatusChange { status, at: now }
COMMIT → 200 Order → publicar order.status_changed { order, previousStatus } (§11)
```
En READ COMMITTED, el segundo `UPDATE` concurrente espera el bloqueo de fila, reevalúa el `WHERE` y actualiza 0 filas: a lo sumo se aplica uno (R5.10).

## 10. Cancelación por el cliente (R6, D-048, D-058, D-097)
```
rate limit (D-104) → params id UUID y body { clientRequestId: UUID } (400) → transacción:
  order = findUnique({ id })  → null o clientRequestId distinto → 404 (R6.3)
  applyClientCancel(order)    → invalid → 409 INVALID_TRANSITION details.order (R6.2)
  updateMany({ where: { id, status: 'pending' }, data: { status: 'cancelled', updatedAt: now } })
    count 0 → releer → 409 INVALID_TRANSITION details.order
    count 1 → OrderStatusChange { cancelled, at: now }
COMMIT → 200 Order → publicar order.status_changed { order, previousStatus: 'pending' }
```
Un pedido ya `cancelled` también responde 409 (R6.2: no está en `pending`).

## 11. Publicación de eventos (R4.3, R7, RNF2, RNF11, D-096)
- `OrderEventBus` en memoria: `publish(event: OrderEvent & { restaurantId })` y `subscribe(listener)`. Los servicios publican **solo cuando `$transaction` resolvió** (después del COMMIT); un rechazo, un `noop` o una respuesta idempotente no publican (R3.10, R5.5).
- El hub es el único suscriptor y reparte según §7.5. El envío es síncrono en el mismo proceso (RNF2).
- Si el proceso cae entre el COMMIT y el envío, el consumidor lo recupera con `GET /api/orders?since=` (RNF11, R7.4). Sin conexiones, el pedido se registra igual (R7.4).

## 12. Autenticación del personal (R8, D-087..D-091)
- `TokenVerifier` (`jose`): `createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))` + `jwtVerify(token, jwks, { issuer: `${SUPABASE_URL}/auth/v1`, audience: 'authenticated' })` (valida firma, `iss`, `aud`, `exp`). Algoritmos asimétricos del JWKS; HS256 no se acepta (D-088). Devuelve `{ userId: sub, exp }`. En tests se inyecta un verificador con un par de claves propio (`createLocalJWKSet`).
- REST: `Authorization: Bearer <access_token>` (D-090). `requireStaff` → verifica → busca `StaffMember` por `userId` → `res.locals.staff = { userId, restaurantId }`. Falta, inválido, vencido o sin `StaffMember` → 401 `UNAUTHORIZED` (R8.1, D-089). Pedido de otro restaurante → 404 (R5.9).
- WS: `accessToken` en la query (D-091), mismas verificaciones, códigos 4401/4403 (§7.3).
- Un solo rol (R8.5); cada usuario en un solo restaurante por la PK de `StaffMember` (D-028).

## 13. Validación y errores (RNF6, RNF10, D-099..D-101)

### 13.1 Mecanismo
- `validate({ body?, query?, params?, headers? })`: Zod; datos parseados en `res.locals.input` (Express 5: `req.query` es de solo lectura). Falla → `AppError('VALIDATION', 400, { issues })`.
- `POST /api/orders` usa un validador por etapas (§8.1) en el servicio, no el middleware genérico, para respetar el orden de R3.2.
- `AppError(code, status, message, details?)`. Manejador central: `AppError` → su forma; `ZodError` → 400; JSON malformado (`entity.parse.failed`) o cuerpo demasiado grande (`entity.too.large`) → 400 `VALIDATION` (D-099); ruta inexistente → 404 `NOT_FOUND`; resto (incluidos errores de Prisma no previstos) → 500 `SERVER` con mensaje genérico y log del detalle.
- Límite de tamaño del cuerpo JSON: `express.json({ limit: '100kb' })` (D-118); mayor → 400 `VALIDATION`.

### 13.2 Formatos de entrada (D-078)
| Campo | Formato |
|---|---|
| `restaurant` | `^[a-z0-9]+(-[a-z0-9]+)*$`, máx. 50 |
| `clientRequestId`, `Idempotency-Key`, `id` de pedido, `ids[]`, `dishId`, `groupId`, `optionId` | UUID |
| `tableId` | entero positivo (y ≤ 2.147.483.647, el máximo de la columna) |
| `lineId` | Texto no vacío, máx. 4096 caracteres (D-113, ajusta D-078) |
| `status`, `expectedStatus` | `OrderStatus` |
| `since` | ISO 8601 UTC (`Z`) |

### 13.3 Códigos (contrato + D-099)
| HTTP | `code` | `details` |
|---|---|---|
| 400 | `VALIDATION` | `issues: [{ path, code }]` (D-100) |
| 401 | `UNAUTHORIZED` | — |
| 404 | `NOT_FOUND` | — |
| 409 | `IDEMPOTENCY_CONFLICT` | — |
| 409 | `PRICE_CHANGED` | `totalCents`, `priceLines` |
| 409 | `STATUS_CONFLICT` | `order` |
| 409 | `INVALID_TRANSITION` | `order` solo en la cancelación del cliente (R6.2) |
| 422 | `INVALID_TABLE` | — |
| 422 | `LINES_REJECTED` | `lines` |
| 429 | `RATE_LIMITED` | — |
| 500 | `SERVER` | — |

`message` siempre en inglés y genérico (el front traduce por `code`, D-099). `details.issues`: `path` con puntos (`items.2.quantity`, como en D-100) y `code` = código de issue de Zod; sin mensajes internos de Zod (D-100). Prefijo de ruta para query/params/headers: ver §19.

## 14. Rate limit (RNF7, D-103, D-104)
`express-rate-limit`, almacenamiento en memoria, `windowMs = 60_000`, `standardHeaders` (headers `RateLimit` estándar), `legacyHeaders: false`, `handler` → 429 `RATE_LIMITED`. Instancias: `GET /api/menu` 120/min; `POST /api/orders` 20/min; `POST /api/orders/{id}/cancel` 20/min ("mismo límite", D-104) con **contador propio** (D-117). La clave es `req.ip`, que depende de `app.set('trust proxy', TRUST_PROXY)`; el valor real se fija al decidir el hosting (D-010).

## 15. Logging (RNF8, D-103)
- `pino` (JSON, nivel `LOG_LEVEL`) + `pino-http` (una línea por request con método, ruta, status y duración). No se registran cuerpos (las notas son texto libre del cliente).
- `redact`: `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`. Las URLs que se registran (también la del `upgrade` del WS) pasan por un serializador que reemplaza el valor de `accessToken` por `[REDACTED]` (D-091).
- 5xx con el error completo en el log; la respuesta solo lleva el mensaje genérico (R4.2, RNF6).

## 16. CORS y headers (D-103)
`cors({ origin: CORS_ORIGINS, methods: ['GET','POST','PATCH'], allowedHeaders: ['Content-Type','Authorization','Idempotency-Key'], credentials: false })`. La misma lista valida el `Origin` del WS (§7.2). `app.disable('x-powered-by')`. Sin `helmet`.

## 17. Entorno y Supabase (D-017, D-103, D-105, D-106)

### 17.1 Variables (`src/env.ts`, Zod)
| Variable | Uso | Obligatoria |
|---|---|---|
| `DATABASE_URL` | App: Supavisor **modo sesión, 5432**, rol `prisma` (D-105) | Sí |
| `DIRECT_URL` | Solo `prisma.config.ts` (migraciones): conexión directa si la red tiene IPv6, o el mismo pooler en modo sesión | Sí (CLI de Prisma) |
| `SUPABASE_URL` | Base para `iss` y JWKS (§12) | Sí |
| `CORS_ORIGINS` | Lista separada por comas de orígenes permitidos (REST y WS) | Sí |
| `PORT` | Puerto HTTP | No; default `3000` (D-123) |
| `LOG_LEVEL` | Nivel de pino | No; default `info` (D-123) |
| `TRUST_PROXY` | `false`, `true` o número de saltos | No; default `false` (D-123) |
| `DB_POOL_MAX` | `max` del pool del adaptador `pg` | No; default `10` (D-123) |
| `SEED_STAFF_USER_ID` | Solo `seed.ts`: UUID del usuario de Supabase Auth (D-110) | No |

`.env.example` previsto (valores de ejemplo, sin secretos):
```
DATABASE_URL="postgresql://prisma.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
DIRECT_URL="postgresql://prisma.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
SUPABASE_URL="https://<ref>.supabase.co"
CORS_ORIGINS="http://localhost:5173"
PORT=3000
LOG_LEVEL=info
TRUST_PROXY=false
DB_POOL_MAX=10
SEED_STAFF_USER_ID=
```
(El formato exacto del usuario del pooler se toma del panel al crear el proyecto.)

**Entorno de los tests (D-122):** `.env.test` fuera de git (se agrega a `.gitignore`) y `.env.test.example` commiteado, con `DATABASE_URL` y `DIRECT_URL` apuntando al Postgres del `docker compose`. El script `test` carga ese archivo con `--env-file-if-exists=.env.test` (carga nativa, D-103).

### 17.2 Pasos manuales en Supabase (se documentan en `backend/README.md` en la tarea correspondiente)
1. Crear el proyecto con **claves JWT asimétricas** (Settings → JWT Keys) (D-088).
2. Crear el rol `prisma` con el SQL de la guía oficial de Supabase + Prisma (`bypassrls`, `createdb`, permisos en `public`) (D-105).
3. Copiar la URL del pooler en modo sesión (5432) para `DATABASE_URL`, y la de migraciones para `DIRECT_URL`.
4. **Desactivar la Data API** del proyecto en el panel (D-106; Supabase Auth no se ve afectado). La ubicación exacta de la opción se verifica en el panel al hacerlo.
5. Crear a mano el usuario del personal en Supabase Auth y copiar su UUID a `SEED_STAFF_USER_ID` (D-110).
6. Aplicar migraciones (`db:deploy`) y correr el seed (`db:seed`) — cada uno con confirmación del usuario.

---

## 18. Estrategia de testing y seed (RNF9, D-016, D-107, D-108)

### 18.1 Capas
| Capa | Herramienta | Qué cubre |
|---|---|---|
| Unitaria | Vitest | `domain/*`: transiciones (incluido retroceso D-060), `applyTransition`, `applyClientCancel`, `validateLine`, precios, código corto (con aleatorio fijo y colisiones forzadas), huella (orden de líneas/opciones, notas), `countVisibleChars` (emojis compuestos), `normalizeNote` |
| Integración REST | Vitest + Supertest + Postgres en Docker | Cada endpoint, orden de validación, códigos y `details`, auth, filtros, rate limit, CORS, RLS |
| Integración WS | Vitest + cliente `ws` sobre puerto aleatorio | Handshake, códigos de cierre, `welcome`, ping/pong (heartbeat acelerado), vencimiento de token (reloj/temporizador acelerado), entrega y aislamiento de eventos |
| Concurrencia | Integración con `Promise.all` | Dos PATCH simultáneos (R5.10), dos POST con la misma clave (R3.10/R3.11), altas simultáneas con colisión de código forzada (R3.9) |

### 18.2 Base de datos de tests (D-107, D-108)
- `docker-compose.yml` con `postgres:<mayor del proyecto Supabase>` en un puerto local. El usuario instala Docker Desktop.
- Conexión de los tests desde `.env.test` (fuera de git) según `.env.test.example` (D-122, §17.1).
- `global-setup.ts`: `prisma migrate deploy` contra la base de tests y limpieza total al inicio de la corrida (`TRUNCATE … CASCADE` de todas las tablas de la app).
- Cada test crea su restaurante con slug aleatorio, su carta y sus mesas (fábricas en `test/helpers/`) → archivos en paralelo sin interferir.
- JWT: un par de claves generado con `jose` al iniciar; el verificador inyectado usa su JWKS local; el helper firma tokens con `iss`/`aud`/`exp` configurables.

### 18.3 Matriz requisito → test
| Requisito | Tipo de test |
|---|---|
| R1.1–R1.7 | Integración REST (`menu`) |
| R2.1–R2.4 | Integración REST (`tables`) |
| R3.1–R3.14 | Unitaria (dominio) + integración REST (`orders-create`) + concurrencia (R3.9–R3.11) |
| R4.1–R4.3 | Integración con fallo forzado dentro de la transacción (verifica que no quedan filas ni eventos) |
| R5.1–R5.10 | Unitaria (`applyTransition`) + integración (`orders-status`) + concurrencia (R5.10) |
| R6.1–R6.4 | Unitaria + integración (`orders-cancel`) |
| R7.1–R7.4 | Integración WS (`ws`): destinatarios, aislamiento por mesa y restaurante, sin eventos en `noop`/idempotente/rechazo |
| R8.1–R8.5 | Integración REST y WS (`auth`) |
| R9.1–R9.8 | Integración WS |
| R10.1–R10.5 | Integración REST (`orders-list`) |
| R11.1–R11.3 | Integración con dos restaurantes en el mismo test |
| RNF1 | Integración: carta de 200 platos, p95 de N solicitudes < 500 ms (medición local orientativa) |
| RNF2 | Integración WS: COMMIT → recepción < 1 s |
| RNF5 | Integración: total = Σ líneas; sin duplicados por reintento |
| RNF6 | Integración: entradas inválidas REST/WS; errores sin internos |
| RNF7 | Integración (`rate-limit`): 121.ª / 21.ª solicitud → 429 en menú, pedidos y cancelación; los contadores de pedidos y cancelación son independientes (D-117) |
| RNF8 | Unitaria del serializador de logs (sin `authorization` ni `accessToken`) |
| RNF10 | Integración: forma del JSON contra los tipos de `domain/types.ts` |
| RNF11 | Integración: evento perdido → recuperado con `since` |

### 18.4 Seed (D-108..D-110)
- `prisma/seed.ts` con upserts idempotentes por id; se corre a mano (`npx prisma db seed`, no corre solo en Prisma 7).
- Restaurante `fogon`; mesas 1–20 activas (contexto de DS-51, igual que el mock del front).
- `seed-data/fogon.ts`: textos ES/EN, precios, etiquetas, destacados, disponibilidad y casos límite copiados de `src/services/mock/menuData.ts` (develop), sin imágenes. Cada categoría, plato, grupo y opción recibe un **UUID v4 fijo escrito en el archivo** (D-071; fijos para que los upserts sean idempotentes). Los grupos que el front repite por plato (`cooking`, `side`…) se crean por plato (D-073).
- El "plato fantasma" del front (CL36: categoría inexistente) se omite (D-119): con la FK plato → categoría no se puede representar.
- Si `SEED_STAFF_USER_ID` está definido → upsert de `StaffMember { userId, restaurantId: fogon }` (D-110).

---

## 19. Pendiente de confirmar con el front
Decisiones ya tomadas por el usuario que cambian o extienden el contrato del compañero (`plan.md` §6–§7.4). **Confirmadas por el compañero el 2026-10-24 (D-126).**

| # | Origen | Qué tiene que saber / aceptar el front |
|---|---|---|
| F1 | D-045 | `restaurant` en todas las llamadas: query en GET y WS, campo del body en `POST /api/orders`. `MenuService.getMenu()`/`getTable()` y `CreateOrderInput` no lo tienen hoy |
| F2 | D-078 (DS-16) | Ids de plato, grupo y opción son UUID: un carrito guardado en `localStorage` con ids del mock (`provoleta`, `cooking`…) recibe 400 `VALIDATION`, no `LINES_REJECTED`. `lineId`: el back acepta texto no vacío de hasta 4096 caracteres (D-113), así que el `line.key` actual del front (JSON con dishId + selección + nota) sirve sin cambios; un `lineId` repetido da 400 (D-114) |
| F3 | D-084 (DS-22) | Diferencias con `validateLine` del front: grupo ajeno al plato → back `selection_invalid` con `groupId` / front `option_not_found` por opción; opciones repetidas → back `selection_invalid` / front no lo detecta; `dish_unavailable` coincide con el front: incluye "no pedible" y corta la línea (D-116). `priceLines` trae todas las líneas |
| F4 | D-085 (DS-23) | El back recorta las notas y una nota vacía desaparece; el front hoy no recorta (ni en el conteo ni en la huella) |
| F5 | D-090 (DS-28) | `Authorization: Bearer <access_token>` en REST del personal |
| F6 | D-091 (DS-29) | WS del personal: `/ws/orders?restaurant=…&scope=staff&accessToken=…` |
| F7 | D-092 (DS-30) | Nuevos cierres 4401 (reintentar con token fresco) y 4403 (permanente) |
| F8 | D-094 (DS-32) | Mesa inactiva se acepta en la suscripción; restaurante inexistente 4404; `staff` + `tableId` 4400; máx. 20 `tableId`; mensajes ≤ 16 KB |
| F9 | D-097 (DS-35) | Ruta nueva `POST /api/orders/{id}/cancel` `{ clientRequestId }` → 200 · 404 · 409 `INVALID_TRANSITION` con `details.order`; método nuevo en `OrderService` |
| F10 | D-099 (DS-37) | Códigos nuevos `UNAUTHORIZED` (401) y `RATE_LIMITED` (429) en `ServiceErrorCode`; `message` en inglés |
| F11 | D-100 (DS-38) | `details.issues: [{ path, code }]` en `ServiceErrorDetails`. Propuesta de `path`: el del body sin prefijo (`items.2.quantity`) y con prefijo `query.`, `params.` o `headers.` para el resto |
| F12 | D-060 | `canTransition` del front no tiene retroceso; el back acepta un paso atrás (`accepted→pending`, `preparing→accepted`, `ready→preparing`). La 002 del front lo necesita |
| F13 | Diseño §8.6 | Orden de las opciones en el snapshot: por posición del grupo y de la opción en la carta (el mock usa el orden de la selección) |
| F14 | Diseño §7.3 | `tableId` repetidos en la query del WS se deduplican; `accessToken` sin `scope=staff` se ignora |
| F15 | Diseño §6.6 | `since` solo en ISO 8601 UTC con `Z` (lo que produce `toISOString()`) |
| F16 | D-089 | Un usuario autenticado que no es personal del restaurante recibe 401 (no 403) |

## 20. Decisiones pendientes
Sin pendientes. Los huecos P1–P11 de la v1 quedaron resueltos por el usuario como D-113..D-123 y P12 como D-125 (tabla de §2).

## 21. Riesgos
- **IP compartida en el salón:** con el WiFi del restaurante, todos los clientes salen por la misma IP pública; el límite de 20 pedidos/min (RNF7) es por restaurante en la práctica. Suficiente para la escala D-033; se revisa con el hosting (D-010).
- **Un solo proceso:** bus y rate limit en memoria no sirven con varias instancias (fuera de alcance, D-033).
- **`accessToken` en la URL:** puede quedar en logs de proxies intermedios (riesgo aceptado en D-091).
- **`unitPriceCents` en `Int`:** un precio unitario con adicionales mayor a 2^31 centavos haría fallar el insert (500). Inalcanzable con precios reales (D-076).

## 22. Trazabilidad requisito → diseño
| Requisito | Sección del diseño | Archivos principales |
|---|---|---|
| R1.1–R1.7 | §6.1, §5.2, §13.2 | `modules/menu/*` |
| R2.1–R2.4 | §6.2 | `modules/tables/*` |
| R3.1 | §6.3, §8 | `modules/orders/create-order.service.ts`, `orders.router.ts` |
| R3.2 | §8.1 (D-083) | `create-order.service.ts` |
| R3.3 | §8.1 paso 4 (D-102, D-115) | ídem |
| R3.4 | §8.2, §8.3, §13.2 (D-113, D-114) | `orders.schemas.ts`, `domain/text.ts` |
| R3.5, R11.3 | §8.4 (D-084, D-116, D-121) | `domain/selection.ts` |
| R3.6, R3.7 | §8.5 | `domain/pricing.ts` |
| R3.8 | §5.1, §8.6 | `schema.prisma`, `create-order.service.ts` |
| R3.9 | §8.6 (D-082) | `domain/short-code.ts` |
| R3.10–R3.12 | §8.1 paso 3, §8.6, §8.7 (D-081, D-083) | `domain/fingerprint.ts` |
| R3.13 | §8.2 | `orders.schemas.ts` |
| R3.14 | §6 (sin auth) | `orders.router.ts` |
| R4.1–R4.3 | §8.6, §11 | `create-order.service.ts`, `shared/event-bus.ts` |
| R5.1–R5.10 | §9, §4.3 (D-095) | `change-status.service.ts`, `domain/order-status.ts` |
| R6.1–R6.4 | §10 (D-097), §14 (D-117) | `cancel-order.service.ts` |
| R7.1–R7.4 | §11, §7.5 (D-096) | `shared/event-bus.ts`, `realtime/hub.ts` |
| R8.1–R8.5 | §12, §7.3, §7.4 (D-088..D-092) | `modules/staff/*`, `realtime/upgrade.ts` |
| R9.1–R9.8 | §7 (D-093, D-094) | `modules/realtime/*` |
| R10.1–R10.5 | §6.6 (D-098) | `list-orders.service.ts` |
| R11.1–R11.2 | §5.1, §6, §7.5 | `schema.prisma`, todos los servicios |
| RNF1 | §6.1 (una consulta, índices por `position`) | `menu.service.ts` |
| RNF2 | §11 | `realtime/hub.ts` |
| RNF3 | §3, §17 (D-017, D-105) | `prisma.config.ts`, `shared/db.ts`, `env.ts` |
| RNF4 | §4.2, §21 | — |
| RNF5 | §8.5, §8.6, §8.7 | `create-order.service.ts` |
| RNF6 | §13, §7.4 | `shared/validate.ts`, `shared/error-handler.ts`, `realtime/protocol.ts` |
| RNF7 | §14 (D-103, D-104, D-117) | `shared/rate-limit.ts` |
| RNF8 | §15, §5 (sin datos personales) | `shared/logger.ts` |
| RNF9 | §18 | `test/**` |
| RNF10 | §5.2, §6, §13.3 | `domain/types.ts`, mappers |
| RNF11 | §6.6 (`since` sobre `updatedAt`), §11 | `list-orders.service.ts` |

## 23. Integración continua (D-137)
Motivo: `docs/estandares/git.md` (adoptado tal cual, D-014) exige CI en verde para mergear; la v1.1 no tenía CI.

### 23.1 Qué queda definido
- **Plataforma:** GitHub Actions (D-137). Un workflow en `.github/workflows/` en la raíz del repo (GitHub solo los lee ahí), con los pasos ejecutándose en `backend/` (`defaults.run.working-directory: backend`).
- **Runtime:** Node 24 (D-064) con `actions/setup-node`.
- **Base de datos:** Postgres como servicio del job, con la misma imagen que la BD de tests local, `postgres:<mayor de Supabase>` (D-131), y un health check antes de los tests.
- **Pasos:** checkout → setup de Node 24 → `npm ci` → `npm run db:generate` (D-132; Prisma 7 no genera el cliente solo) → `npm run lint` → `npm run typecheck` → `npm test` (el `global-setup` aplica `prisma migrate deploy` y limpia la base del servicio, §18.2).
- **Entorno:** las variables de los tests (`DATABASE_URL` y `DIRECT_URL` hacia el servicio; el resto con valores de prueba) se definen en el workflow. El script `test` usa `--env-file-if-exists=.env.test`, así que en CI no hace falta `.env.test`. **Sin secretos**: el CI nunca se conecta a Supabase (los tests usan un verificador JWT con claves propias, §18.2).
- Las versiones de las actions (`actions/checkout`, `actions/setup-node`) se toman de su documentación oficial al implementar.

### 23.2 Detalles decididos (C1–C6)
- **Archivo:** `.github/workflows/backend-ci.yml` (D-143).
- **Disparadores:** `pull_request` a `develop` y `main`, y `push` a `develop`, filtrados con `paths` a `backend/**` y al propio workflow (D-138).
- **Bloqueo del merge:** el check es informativo, sin protección de ramas; la regla "no mergear en rojo" la aplica la revisión del PR. Se revisa con el compañero más adelante (D-139).
- **Cache:** `actions/setup-node` con `cache: npm` y `cache-dependency-path: backend/package-lock.json` (D-140).
- **Matriz:** sin matriz; solo Node 24 y `postgres:<mayor de Supabase>` (D-141).
- **Pasos extra:** `npx prettier --check .` y `npm run build`, además de lint, typecheck y test (D-142). El build se suma cuando existe `src/server.ts` (T36).

## Aprobación
- [x] Aprobado por el usuario · Fecha: 2026-10-24 (D-127)
- [x] Requisitos v2.1 (D-083, D-097, D-104, D-114, D-117, D-124) aprobados junto con este diseño · Fecha: 2026-10-24
- [x] v1.2: §23 Integración continua (D-137, D-138..D-143) aprobada por el usuario · Fecha: 2026-10-24 (D-145)
