# Spec backend/001 — Pedidos en tiempo real · Tareas

**Estado:** APROBADO (2026-10-24) · **Versión:** 1.2 · **Fecha:** 2026-10-24
**Historial:** v1.2 aplica C1–C6 del CI y los nombres de ramas y bases (D-138..D-144). v1.1 aplica Q1–Q9 (D-129..D-137): ramas por bloque, T39 con D-135, tarea nueva T44 de CI (D-137). v1 BORRADOR del 2026-10-24.
**Basado en:** diseño v1.2 (APROBADO 2026-10-24, D-127, D-145) · requisitos v2.1 (APROBADO 2026-10-24) · decisiones D-001..D-145 · `docs/estandares/definicion-de-terminado.md` (secciones Código y Backend / datos, D-015) · `docs/estandares/git.md` (D-014)

> Implementación de a **una tarea por vez**. Al terminar cada una: verificar, mostrar resultado y esperar el OK del usuario.
> Estados: `pendiente` · `en curso` · `esperando OK` · `aprobada` · `bloqueada (motivo)`
> Todos los comandos se corren desde `backend/`. Cada tarea cierra con `npm run typecheck`, `npm run lint` y los tests indicados en verde (DoD), además de su verificación propia.
> **[CONFIRMACIÓN]** = la tarea incluye una acción que requiere el OK explícito del usuario en el momento (CLAUDE.md §6). **[APROBADO D-134]** = `docker compose up` y `npm test` sobre la BD local de Docker, aprobados una sola vez al aprobar este documento. **[MANUAL]** = la hace el usuario (panel de Supabase, `.env`).
> **Git (D-136):** una rama por bloque, `feature/backend-001-<bloque>` desde `develop`; un commit por tarea aprobada (Conventional Commits en inglés, D-014); un PR a `develop` al cerrar el bloque. Commits y push siempre con confirmación (D-134). Nombres de bloque y de las bases de Docker (`restaurante_dev` / `restaurante_test`) aceptados en D-144.
> Los agentes nunca leen ni imprimen `.env` / `.env.test`: los crea y completa el usuario a partir de los `.example`.

---

## Bloque A — Base del proyecto
Rama: `feature/backend-001-base` (D-136)

- [x] **T1 — Esqueleto de `backend/` e instalación de dependencias** [CONFIRMACIÓN: `npm install`]
  - Qué: `package.json` (`"type": "module"`, `engines.node` 24, scripts de §3 más `db:generate` = `prisma generate`, D-132), `.npmrc` con `save-exact=true`, `tsconfig.json` (`strict`, `moduleResolution: "bundler"`, alias `@/*` → `./src/*`), `.gitignore` (`.env`, `.env.test`, `dist/`, `src/generated/`, `node_modules/`). Instalar las dependencias de producción y desarrollo de §3 en su última versión estable (verificada en npm al ejecutar), exactas, con `package-lock.json`. Bundle: `tsdown` (D-129). Lint/formato: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `prettier` (D-130).
  - Archivos: `backend/package.json`, `backend/package-lock.json`, `backend/.npmrc`, `backend/tsconfig.json`, `backend/.gitignore`
  - Requisitos: RNF9, RNF10 (base técnica)
  - Decisiones: D-008, D-016, D-063, D-064, D-065, D-066, D-103, D-110, D-122, D-129, D-130, D-132, D-147..D-153
  - Agente: `dev-backend`
  - Depende de: —
  - Criterios de aceptación: todas las dependencias de §3 instaladas sin `^`/`~`, con `tsdown` como bundler y los paquetes de D-130; ninguna otra dependencia; `node -v` es 24.x (si no, el usuario lo instala [MANUAL]); `.gitignore` cubre lo indicado.
  - Verificación: `node -v` · `npm ls --depth=0` · `grep -E '"\^|"~' package.json` sin resultados · `npx tsc --version`
  - Estado: aprobada (2026-10-24, D-153)

- [x] **T2 — Configuración de herramientas y `src/env.ts`**
  - Qué: `eslint.config.js` (ignora `src/generated/`, D-151; `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`, D-130), `.prettierrc` con la configuración por defecto de Prettier (D-130), `vitest.config.ts` (proyectos/carpetas `unit` e `integration`, alias `@/`), `tsdown.config.ts` con el bundle a `dist/server.js` (D-129; verificar la API en la documentación oficial de tsdown). `src/env.ts`: `parseEnv(process.env)` con Zod sobre las variables de §17.1 (obligatorias y defaults de D-123; `CORS_ORIGINS` separado por comas; `TRUST_PROXY` `false`/`true`/número). `.env.example` con el contenido de §17.1.
  - Archivos: `backend/eslint.config.js`, `backend/.prettierrc`, `backend/vitest.config.ts`, `backend/tsdown.config.ts`, `backend/src/env.ts`, `backend/.env.example`, `backend/test/unit/env.test.ts`
  - Requisitos: RNF3, RNF6
  - Decisiones: D-016, D-017, D-066, D-103, D-105, D-123, D-129, D-130, D-151, D-154..D-158
  - Agente: `dev-backend`
  - Depende de: T1
  - Criterios de aceptación: falta una obligatoria → error con el nombre de la variable y sin su valor; defaults `3000`/`info`/`false`/`10`; `TRUST_PROXY` acepta `false`, `true` y enteros; `.env.example` sin secretos.
  - Verificación: `npx vitest run test/unit/env.test.ts` · `npm run typecheck` · `npm run lint` · `npx prettier --check .`
  - Estado: aprobada (2026-10-24, D-158)

- [x] **T3 — Postgres local en Docker (desarrollo y tests)** [APROBADO D-134: `docker compose up -d`]
  - Qué: `docker-compose.yml` con `postgres:<mayor de Supabase>` (la mayor que usan los proyectos nuevos de Supabase, verificada en su documentación al ejecutar, porque el proyecto se crea en T41, D-133) publicado en el puerto **5433** del host, usuario/clave `postgres`/`postgres` solo locales (D-131), con health check y dos bases separadas: desarrollo (`restaurante_dev`, D-133) y tests (`restaurante_test`) — nombres propuestos. `.env.test.example` con `DATABASE_URL`/`DIRECT_URL` hacia la base de tests; `.env.example` suma un comentario con las URLs locales de desarrollo. Script `db:test:up`.
  - Archivos: `backend/docker-compose.yml`, `backend/docker/init-databases.sql` (o equivalente para crear la segunda base; nombre propuesto), `backend/.env.test.example`, `backend/.env.example`, `backend/package.json` (script), `backend/.gitignore` (excepción `!.env.test.example`, D-159)
  - Requisitos: RNF9
  - Decisiones: D-107, D-122, D-131, D-133, D-134, D-144, D-159..D-163
  - Agente: `devops`
  - Depende de: T1
  - Criterios de aceptación: el contenedor queda sano; existen las dos bases; puerto 5433; el usuario crea `.env.test` desde el `.example` y un `.env` local apuntando a `restaurante_dev` [MANUAL].
  - Verificación: `npm run db:test:up` · `docker compose ps` (estado `healthy`) · `docker compose exec <servicio> psql -U postgres -c "select version();" -c "\l"` (mayor correcta, `restaurante_dev` y `restaurante_test` presentes)
  - Estado: aprobada (2026-10-24, D-163)

- [x] **T4 — Errores y dependencias inyectables**
  - Qué: `shared/errors.ts` (`AppError(code, status, message, details?)`, códigos de §13.3; sin helpers propios: el compilador exige que `status` corresponda al `code`, D-164), `shared/clock.ts`, `shared/random.ts`.
  - Archivos: `backend/src/shared/errors.ts`, `backend/src/shared/clock.ts`, `backend/src/shared/random.ts`, `backend/test/unit/errors.test.ts`
  - Requisitos: RNF6, RNF10
  - Decisiones: D-077, D-099, D-100, D-101, D-164..D-168
  - Agente: `dev-backend`
  - Depende de: T2
  - Criterios de aceptación: los 11 códigos de §13.3 con su HTTP; `message` en inglés; reloj y aleatorio reemplazables.
  - Verificación: `npx vitest run test/unit/errors.test.ts` · `npm run typecheck` · `npm run lint`
  - Estado: aprobada (2026-10-24, D-168)

- [x] **T5 — Logger con redacción**
  - Qué: `shared/logger.ts`: `pino` con `LOG_LEVEL`, `redact` de `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, y serializador de URL que reemplaza `accessToken` por `[REDACTED]`.
  - Archivos: `backend/src/shared/logger.ts`, `backend/test/unit/logger.test.ts`
  - Requisitos: RNF8
  - Decisiones: D-091, D-103, D-169..D-174
  - Agente: `dev-backend`
  - Depende de: T2
  - Criterios de aceptación: la salida capturada no contiene el valor de `authorization`, `cookie` ni `accessToken` (también con el parámetro en distintas posiciones de la query).
  - Verificación: `npx vitest run test/unit/logger.test.ts`
  - Estado: aprobada (2026-10-24, D-174)

## Bloque B — Datos y CI
Rama: `feature/backend-001-data` (D-136) · incluye T44 (CI, D-137)

- [x] **T6 — Esquema Prisma, `prisma.config.ts` y cliente**
  - Qué: `schema.prisma` exactamente como §5.1 (enums, 11 modelos, índices, generador `prisma-client` con `output` en `src/generated/prisma`); `prisma.config.ts` (§3: `process.loadEnvFile()`, `schema`, `migrations.path`, `migrations.seed`, `datasource.url = env("DIRECT_URL")`); `shared/db.ts` con `createPrismaClient(DATABASE_URL, DB_POOL_MAX)` sobre `@prisma/adapter-pg`. Verificar las APIs en la documentación oficial de Prisma 7.
  - Archivos: `backend/prisma/schema.prisma`, `backend/prisma.config.ts`, `backend/src/shared/db.ts`
  - Requisitos: R3.8, R11.1, RNF3, RNF8
  - Decisiones: D-063, D-071..D-081, D-087, D-105, D-113, D-121, D-132, D-176..D-178
  - Agente: `dev-database`
  - Depende de: T2
  - Criterios de aceptación: el esquema coincide con §5.1 campo por campo; sin `@default(now())` ni `@updatedAt`; `Dish` sin `restaurantId`.
  - Verificación: `npx prisma validate` · `npm run db:generate` (D-132) · `npm run typecheck`
  - Estado: aprobada (2026-10-24, D-178)

- [ ] **T7 — Migración inicial con RLS y CHECK** [CONFIRMACIÓN: crear y aplicar la migración en `restaurante_dev`]
  - Qué: `prisma migrate dev --create-only` contra la base de desarrollo de Docker (`restaurante_dev`, D-133; la shadow database la crea Prisma en el mismo contenedor); agregar a mano al SQL `ENABLE ROW LEVEL SECURITY` en cada tabla nueva y en `"_prisma_migrations"` (§5.3) y las restricciones `CHECK` con nombre propio de §5.4; aplicar con `prisma migrate dev` y `npm run db:generate` (D-132).
  - Archivos: `backend/prisma/migrations/<timestamp>_init/migration.sql`, `backend/prisma/migrations/migration_lock.toml`
  - Requisitos: R11.1, RNF5
  - Decisiones: D-015, D-106, D-120, D-125, D-132, D-133
  - Agente: `dev-database`
  - Depende de: T3, T6
  - Criterios de aceptación: migración versionada; las 5 tablas de §5.4 con sus `CHECK`; todas las tablas de `public` con RLS y sin políticas.
  - Verificación: `npx prisma migrate status` · `select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';` (todas `true`) · `select conname from pg_constraint where contype = 'c';`
  - Estado: pendiente

- [ ] **T8 — Infraestructura de tests de integración + tests de RLS y CHECK** [APROBADO D-134: `npm test` sobre `restaurante_test`]
  - Qué: `test/global-setup.ts` (`prisma migrate deploy` contra la base de tests + `TRUNCATE … CASCADE` de las tablas de la app al inicio), fábricas en `test/helpers/` (restaurante con slug aleatorio, carta, mesas), script `test` que carga `.env.test` con `--env-file-if-exists`. Tests: toda tabla de `public` con `relrowsecurity = true`; cada `CHECK` rechaza un valor inválido.
  - Archivos: `backend/test/global-setup.ts`, `backend/test/helpers/factories.ts`, `backend/test/integration/rls.test.ts`, `backend/test/integration/db-constraints.test.ts` (nombre propuesto), `backend/vitest.config.ts`, `backend/package.json`
  - Requisitos: RNF5, RNF9, R11.1
  - Decisiones: D-106, D-107, D-108, D-120, D-122, D-134
  - Agente: `dev-database`
  - Depende de: T7
  - Criterios de aceptación: `npm test` corre sobre `restaurante_test` y nunca sobre `restaurante_dev` ni Supabase; sin `.env.test` toma las variables del entorno (como en CI, T44); dos archivos de test en paralelo no interfieren.
  - Verificación: `npm run db:test:up` · `npm test -- test/integration/rls.test.ts test/integration/db-constraints.test.ts`
  - Estado: pendiente

- [ ] **T44 — Workflow de CI en GitHub Actions**
  - Qué: workflow según diseño §23: Node 24 (D-064), servicio `postgres:<mayor de Supabase>` (misma imagen que T3, D-131) con health check, `npm ci` → `npm run db:generate` (D-132) → `npx prettier --check .` (D-142) → `npm run lint` → `npm run typecheck` → `npm test`, con `working-directory: backend` y las variables de los tests definidas en el workflow, sin secretos. Disparadores: `pull_request` a `develop`/`main` y `push` a `develop`, con `paths` `backend/**` y el workflow (D-138). Cache `setup-node` `cache: npm` sobre `backend/package-lock.json` (D-140). Sin matriz (D-141). Check informativo, sin protección de ramas (D-139). `npm run build` (D-142) se agrega al workflow en T36, cuando existe `src/server.ts`. Versiones de las actions verificadas en su documentación oficial.
  - Archivos: `.github/workflows/<nombre>.yml` `.github/workflows/backend-ci.yml` (en la raíz del repo, D-143)
  - Requisitos: RNF9
  - Decisiones: D-014, D-064, D-131, D-132, D-137, D-138..D-143
  - Agente: `devops`
  - Depende de: T8 · diseño §23 aprobado
  - Criterios de aceptación: el workflow corre en verde en el PR del Bloque B con los tests de T8; falla si se rompe lint, typecheck o un test; no usa secretos ni se conecta a Supabase.
  - Verificación: push de la rama del bloque [CONFIRMACIÓN] → `gh run list --branch feature/backend-001-data` y `gh run view <id>` en verde · prueba en una rama descartable con un error de lint forzado → el run falla (opcional, con confirmación)
  - Estado: pendiente

## Bloque C — Dominio (funciones puras, tests unitarios)
Rama: `feature/backend-001-domain` (D-136)

- [ ] **T9 — Tipos del contrato y límites**
  - Qué: `domain/types.ts` con los tipos de `plan.md` §6 del front (leído de `origin/develop`, solo lectura) más las extensiones de §19 (F9–F11); `domain/limits.ts` (`MAX_QTY` 20, `MAX_LINES` 50, `NOTE_MAX` 140, `ORDER_NOTE_MAX` 200, ventanas 12 h / 24 h, máximos de filtros de §6.6 y del WS).
  - Archivos: `backend/src/domain/types.ts`, `backend/src/domain/limits.ts`
  - Requisitos: RNF10, R3.4, R10.2, R3.9
  - Decisiones: D-043, D-054, D-094, D-098, D-099, D-100, D-126
  - Agente: `dev-backend`
  - Depende de: T2
  - Criterios de aceptación: nombres y formas idénticos a `plan.md` §6 salvo lo acordado en §19.
  - Verificación: `npm run typecheck` · comparación con `git show origin/develop:specs/001-menu-cliente/plan.md`
  - Estado: pendiente

- [ ] **T10 — Estados y transiciones**
  - Qué: `domain/order-status.ts`: `ORDER_FLOW`, `FINAL_STATUSES`, `canTransition` (un paso adelante/atrás, cancelar desde no final), `applyTransition` (`noop | conflict | invalid | applied` en ese orden), `applyClientCancel`.
  - Archivos: `backend/src/domain/order-status.ts`, `backend/test/unit/order-status.test.ts`
  - Requisitos: R5.2, R5.3, R5.4, R5.5, R5.6, R5.7, R6.1, R6.2
  - Decisiones: D-025, D-047, D-048, D-052, D-060, D-070
  - Agente: `dev-backend`
  - Depende de: T9
  - Criterios de aceptación: tabla completa 6×6 de `canTransition`; orden de chequeo de `applyTransition`; `applyClientCancel` solo desde `pending`.
  - Verificación: `npx vitest run test/unit/order-status.test.ts`
  - Estado: pendiente

- [ ] **T11 — Notas y caracteres visibles**
  - Qué: `domain/text.ts`: `countVisibleChars` con `Intl.Segmenter` (grafemas) y `normalizeNote` (`trim`; vacía → `undefined`).
  - Archivos: `backend/src/domain/text.ts`, `backend/test/unit/text.test.ts`
  - Requisitos: R3.4
  - Decisiones: D-085, D-086
  - Agente: `dev-backend`
  - Depende de: T9
  - Criterios de aceptación: emojis compuestos (familia, banderas, tonos de piel) cuentan 1; 140/141 y 200/201 en el borde.
  - Verificación: `npx vitest run test/unit/text.test.ts`
  - Estado: pendiente

- [ ] **T12 — Selección y validación de líneas**
  - Qué: `domain/selection.ts`: `canonicalSelection` (como el front), `isDishOrderable`, `validateLine(dish | null, line)` → `LineIssue[]` con las reglas de §8.4.
  - Archivos: `backend/src/domain/selection.ts`, `backend/test/unit/selection.test.ts`
  - Requisitos: R3.5, R3.13, R11.3
  - Decisiones: D-070, D-073, D-084, D-116
  - Agente: `dev-backend`
  - Depende de: T9
  - Criterios de aceptación: cada `reason` de R3.5 cubierto; `dish_unavailable` como único motivo; todos los problemas de una línea pedible; array vacío = sin elección; grupo ajeno y opciones repetidas → `selection_invalid` con `groupId`.
  - Verificación: `npx vitest run test/unit/selection.test.ts`
  - Estado: pendiente

- [ ] **T13 — Precios**
  - Qué: `domain/pricing.ts`: `unitPriceCents`, `lineTotalCents`, `orderTotalCents` en enteros.
  - Archivos: `backend/src/domain/pricing.ts`, `backend/test/unit/pricing.test.ts`
  - Requisitos: R3.6, RNF5
  - Decisiones: D-053, D-076
  - Agente: `dev-backend`
  - Depende de: T9
  - Criterios de aceptación: base + adicionales × cantidad; total = Σ líneas; caso máximo (50 × 20 × 2^31) exacto.
  - Verificación: `npx vitest run test/unit/pricing.test.ts`
  - Estado: pendiente

- [ ] **T14 — Código corto**
  - Qué: `domain/short-code.ts`: `SHORT_CODE_ALPHABET`, `generateUniqueCode(existing, random)` con hasta 20 intentos y excepción al agotarse.
  - Archivos: `backend/src/domain/short-code.ts`, `backend/test/unit/short-code.test.ts`
  - Requisitos: R3.9
  - Decisiones: D-051, D-082
  - Agente: `dev-backend`
  - Depende de: T9
  - Criterios de aceptación: 4 caracteres del alfabeto; con aleatorio fijo y colisión forzada genera otro; 20 colisiones → lanza.
  - Verificación: `npx vitest run test/unit/short-code.test.ts`
  - Estado: pendiente

- [ ] **T15 — Huella de idempotencia**
  - Qué: `domain/fingerprint.ts`: contenido canónico de §8.7 + SHA-256 hex.
  - Archivos: `backend/src/domain/fingerprint.ts`, `backend/test/unit/fingerprint.test.ts`
  - Requisitos: R3.10, R3.11
  - Decisiones: D-081, D-085
  - Agente: `dev-backend`
  - Depende de: T11, T12
  - Criterios de aceptación: misma huella con líneas u opciones en otro orden y con notas que difieren solo en espacios; distinta si cambia mesa, cantidad, selección, nota o `expectedTotalCents`; `clientRequestId` no influye.
  - Verificación: `npx vitest run test/unit/fingerprint.test.ts`
  - Estado: pendiente

## Bloque D — Base HTTP
Rama: `feature/backend-001-http` (D-136)

- [ ] **T16 — Validación y manejador central de errores**
  - Qué: `shared/validate.ts` (`validate({ body?, query?, params?, headers? })` → `res.locals.input`; falla → `VALIDATION` con `details.issues: [{ path, code }]`, `path` con puntos y prefijo `query.`/`params.`/`headers.` fuera del body, F11); `shared/error-handler.ts` (§13.1: `AppError`, `ZodError`, `entity.parse.failed`, `entity.too.large`, resto → 500 genérico con log).
  - Archivos: `backend/src/shared/validate.ts`, `backend/src/shared/error-handler.ts`, `backend/test/unit/validate.test.ts`, `backend/test/unit/error-handler.test.ts`
  - Requisitos: RNF6, RNF10, R4.2
  - Decisiones: D-099, D-100, D-101, D-118
  - Agente: `dev-backend`
  - Depende de: T4, T5
  - Criterios de aceptación: forma `{ code, message, details? }`; sin mensajes internos de Zod ni stack en la respuesta; el 500 deja el detalle en el log.
  - Verificación: `npx vitest run test/unit/validate.test.ts test/unit/error-handler.test.ts`
  - Estado: pendiente

- [ ] **T17 — `createApp` con CORS, JSON, logging y 404**
  - Qué: `app.ts` con `createApp(deps)` (§4.2): `x-powered-by` desactivado, `trust proxy`, `cors` de §16, `express.json({ limit: '100kb' })`, `pino-http` con el logger de T5, router `/api` vacío, 404 `NOT_FOUND` para rutas inexistentes y el manejador central.
  - Archivos: `backend/src/app.ts`, `backend/test/helpers/app.ts` (deps de prueba), `backend/test/integration/cors.test.ts`, `backend/test/integration/app.test.ts` (nombre propuesto)
  - Requisitos: RNF6, RNF8, RNF10
  - Decisiones: D-068, D-099, D-103, D-118
  - Agente: `dev-backend`
  - Depende de: T6, T16
  - Criterios de aceptación: origen permitido → headers CORS; no permitido → sin `Access-Control-Allow-Origin`; JSON malformado y cuerpo > 100 KB → 400 `VALIDATION`; ruta inexistente → 404; sin header `X-Powered-By`.
  - Verificación: `npm test -- test/integration/cors.test.ts test/integration/app.test.ts`
  - Estado: pendiente

## Bloque E — Lecturas públicas
Rama: `feature/backend-001-public-reads` (D-136)

- [ ] **T18 — `GET /api/menu`**
  - Qué: `shared/restaurants.ts` (`findRestaurantBySlug`); módulo `menu` (router, service con una sola consulta anidada por `position`, schemas, mapper a `Menu` según §5.2).
  - Archivos: `backend/src/shared/restaurants.ts`, `backend/src/modules/menu/menu.router.ts`, `menu.service.ts`, `menu.schemas.ts`, `menu.mapper.ts`, `backend/src/app.ts`, `backend/test/integration/menu.test.ts`
  - Requisitos: R1.1–R1.7, R11.2, RNF1 (diseño de la consulta), RNF10
  - Decisiones: D-046, D-072, D-073, D-078, D-121
  - Agente: `dev-backend`
  - Depende de: T8, T17
  - Criterios de aceptación: 200 con forma `Menu`; no disponibles incluidos con `available: false`; `en` e `imageUrl` omitidos si son `null`; sin datos de otro restaurante (test con dos restaurantes); 400 / 404 según R1.4 / R1.5; sin auth.
  - Verificación: `npm test -- test/integration/menu.test.ts`
  - Estado: pendiente

- [ ] **T19 — `GET /api/tables/{tableId}`**
  - Qué: módulo `tables` según §6.2.
  - Archivos: `backend/src/modules/tables/tables.router.ts`, `tables.service.ts`, `tables.schemas.ts`, `backend/src/app.ts`, `backend/test/integration/tables.test.ts`
  - Requisitos: R2.1–R2.4, R11.2
  - Decisiones: D-059, D-074, D-078
  - Agente: `dev-backend`
  - Depende de: T18
  - Criterios de aceptación: 200 `{ id }` activa; 404 inexistente, inactiva, de otro restaurante o restaurante inexistente; 400 con `tableId` no entero positivo, mayor a 2.147.483.647 o sin `restaurant`.
  - Verificación: `npm test -- test/integration/tables.test.ts`
  - Estado: pendiente

## Bloque F — Autenticación del personal
Rama: `feature/backend-001-staff-auth` (D-136)

- [ ] **T20 — Verificador de JWT**
  - Qué: `staff/token-verifier.ts`: `TokenVerifier` con `jose` (`createRemoteJWKSet` sobre `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, `jwtVerify` con `issuer` y `audience: 'authenticated'`, solo algoritmos asimétricos) → `{ userId, exp }`; fábrica para tests con `createLocalJWKSet`. Helper `test/helpers/jwt.ts` que firma tokens con `iss`/`aud`/`exp` configurables. Verificar las APIs en la documentación oficial de `jose`.
  - Archivos: `backend/src/modules/staff/token-verifier.ts`, `backend/test/helpers/jwt.ts`, `backend/test/unit/token-verifier.test.ts`
  - Requisitos: R8.1, R8.2 (base)
  - Decisiones: D-088, D-056
  - Agente: `dev-backend`
  - Depende de: T2
  - Criterios de aceptación: acepta un token válido; rechaza firma ajena, `iss` o `aud` distintos, vencido y HS256.
  - Verificación: `npx vitest run test/unit/token-verifier.test.ts`
  - Estado: pendiente

- [ ] **T21 — Middleware `requireStaff`**
  - Qué: `staff/staff-auth.ts`: `Authorization: Bearer` → verificador → `StaffMember` por `userId` → `res.locals.staff`; cualquier falla → 401 `UNAUTHORIZED`. Función de resolución reutilizable por el WS y por `GET /api/orders`.
  - Archivos: `backend/src/modules/staff/staff-auth.ts`, `backend/test/integration/auth.test.ts`
  - Requisitos: R8.1, R8.5, R11.1
  - Decisiones: D-087, D-089, D-090
  - Agente: `dev-backend`
  - Depende de: T8, T20
  - Criterios de aceptación: sin header, esquema distinto de Bearer, token inválido, vencido o válido sin `StaffMember` → 401; válido con `StaffMember` → `{ userId, restaurantId }`.
  - Verificación: `npm test -- test/integration/auth.test.ts`
  - Estado: pendiente

## Bloque G — Pedidos
Rama: `feature/backend-001-orders` (D-136)

- [ ] **T22 — Bus de eventos y mapper de `Order`**
  - Qué: `shared/event-bus.ts` (`OrderEventBus` tipado: `publish`, `subscribe`); `orders/order.mapper.ts` (§5.2: `tableId` = `tableNumber`, `Number(totalCents)`, omitir `note` nulas, ISO, `statusHistory` por `at`, ítems y opciones por `position`).
  - Archivos: `backend/src/shared/event-bus.ts`, `backend/src/modules/orders/order.mapper.ts`, `backend/test/unit/event-bus.test.ts`, `backend/test/unit/order-mapper.test.ts`
  - Requisitos: R4.3, R7.1, R7.2, RNF10, RNF11
  - Decisiones: D-076, D-080, D-096
  - Agente: `dev-backend`
  - Depende de: T6, T9
  - Criterios de aceptación: el bus entrega a todos los suscriptores; el mapper produce exactamente la forma `Order` del contrato.
  - Verificación: `npx vitest run test/unit/event-bus.test.ts test/unit/order-mapper.test.ts`
  - Estado: pendiente

- [ ] **T23 — `POST /api/orders`: etapa 0, restaurante, mesa y forma**
  - Qué: `orders.schemas.ts` (esquemas por etapa de §8.1–§8.2); `create-order.service.ts` con el validador por etapas hasta el paso 5 (sin idempotencia, líneas, precio ni guardado todavía); `orders.router.ts` y montaje en `app.ts`.
  - Archivos: `backend/src/modules/orders/orders.schemas.ts`, `create-order.service.ts`, `orders.router.ts`, `backend/src/app.ts`, `backend/test/integration/orders-create.test.ts`
  - Requisitos: R3.2 (orden mesa → forma), R3.3, R3.4, R3.14
  - Decisiones: D-045, D-054, D-078, D-083, D-085, D-086, D-102, D-113, D-114, D-115
  - Agente: `dev-backend`
  - Depende de: T11, T19, T22
  - Criterios de aceptación: header ausente, no UUID o distinto de `clientRequestId` → 400; restaurante inexistente → 422 `INVALID_TABLE`; mesa inexistente/inactiva/ajena, `tableId` ausente o no entero → 422 `INVALID_TABLE`; mesa inválida + forma inválida → 422 (orden); 0 o 51 líneas, cantidad 0/21, nota 141/201 visibles, `lineId` vacío, > 4096 o repetido → 400 con `details.issues`; sin auth.
  - Verificación: `npm test -- test/integration/orders-create.test.ts`
  - Estado: pendiente

- [ ] **T24 — `POST /api/orders`: líneas y precio**
  - Qué: pasos 6 y 7 de §8.1: carga de platos filtrada por restaurante vía categoría, `validateLine`, 422 `LINES_REJECTED` y 409 `PRICE_CHANGED` con `details` completos.
  - Archivos: `backend/src/modules/orders/create-order.service.ts`, `backend/test/integration/orders-create.test.ts`
  - Requisitos: R3.2 (orden líneas → precio), R3.5, R3.6, R3.7, R3.13, R11.3
  - Decisiones: D-049, D-053, D-084, D-116, D-121
  - Agente: `dev-backend`
  - Depende de: T12, T13, T23
  - Criterios de aceptación: cada `reason` por HTTP; plato de otro restaurante → `dish_not_found`; líneas iguales se validan por separado; `PRICE_CHANGED` con `totalCents` y `priceLines` de todas las líneas; ningún rechazo escribe filas.
  - Verificación: `npm test -- test/integration/orders-create.test.ts`
  - Estado: pendiente

- [ ] **T25 — `POST /api/orders`: transacción, código y evento**
  - Qué: paso 8 (§8.6): `$transaction` con `pg_advisory_xact_lock`, códigos de 24 h, `generateUniqueCode`, `order.create` anidado con ítems, opciones (ordenadas por posición de grupo y opción, F13) y primer `OrderStatusChange`; 201; `publish` de `order.created` después del COMMIT; errores → rollback + 500 sin eventos.
  - Archivos: `backend/src/modules/orders/create-order.service.ts`, `backend/test/integration/orders-create.test.ts`
  - Requisitos: R3.1, R3.8, R3.9, R3.12, R3.14, R4.1, R4.2, R4.3, R7.1 (publicación), RNF5
  - Decisiones: D-051, D-077, D-079, D-080, D-081, D-082, D-096
  - Agente: `dev-backend`
  - Depende de: T14, T15, T24
  - Criterios de aceptación: 201 con `Order` completo y `status: pending`; copia ES/EN fija aunque luego cambie la carta; altas simultáneas con aleatorio que colisiona → códigos distintos; códigos agotados → 500 sin filas ni eventos; total = Σ líneas; evento solo tras COMMIT (espía del bus).
  - Verificación: `npm test -- test/integration/orders-create.test.ts`
  - Estado: pendiente

- [ ] **T26 — `POST /api/orders`: idempotencia**
  - Qué: paso 3 de §8.1 (antes de mesa, forma, líneas y precio) y manejo de `P2002` en envíos simultáneos con la misma clave.
  - Archivos: `backend/src/modules/orders/create-order.service.ts`, `backend/test/integration/orders-create.test.ts`
  - Requisitos: R3.2, R3.10, R3.11, R3.12, RNF5
  - Decisiones: D-050, D-081, D-083
  - Agente: `dev-backend`
  - Depende de: T25
  - Criterios de aceptación: reintento igual → 200 con el original y sin evento, aunque la mesa se haya desactivado o la carta cambiado; contenido distinto o cuerpo inválido con clave registrada → 409 `IDEMPOTENCY_CONFLICT`; misma clave en otro restaurante → pedido nuevo; dos POST simultáneos con la misma clave → un 201 y un 200 (o 409), una sola fila.
  - Verificación: `npm test -- test/integration/orders-create.test.ts`
  - Estado: pendiente

- [ ] **T27 — `PATCH /api/orders/{id}/status`**
  - Qué: `change-status.service.ts` y ruta según §9 (update condicional, `OrderStatusChange`, evento `order.status_changed` tras COMMIT).
  - Archivos: `backend/src/modules/orders/change-status.service.ts`, `orders.schemas.ts`, `orders.router.ts`, `backend/test/integration/orders-status.test.ts`
  - Requisitos: R5.1–R5.10, R7.2 (publicación), R8.1, R11.2
  - Decisiones: D-047, D-052, D-060, D-095, D-096
  - Agente: `dev-backend`
  - Depende de: T10, T21, T25
  - Criterios de aceptación: sin token → 401 sin cambios; transición válida → 200 + historial + evento; mismo estado → 200 sin evento; `expectedStatus` distinto → 409 `STATUS_CONFLICT` con `details.order`; no permitida o desde final → 409 `INVALID_TRANSITION`; estado desconocido → 400; pedido de otro restaurante → 404; dos PATCH simultáneos → uno aplicado y un `STATUS_CONFLICT`.
  - Verificación: `npm test -- test/integration/orders-status.test.ts`
  - Estado: pendiente

- [ ] **T28 — `POST /api/orders/{id}/cancel`**
  - Qué: `cancel-order.service.ts` y ruta según §10.
  - Archivos: `backend/src/modules/orders/cancel-order.service.ts`, `orders.schemas.ts`, `orders.router.ts`, `backend/test/integration/orders-cancel.test.ts`
  - Requisitos: R6.1–R6.4, R7.2 (publicación)
  - Decisiones: D-048, D-058, D-097
  - Agente: `dev-backend`
  - Depende de: T10, T25
  - Criterios de aceptación: `pending` + `clientRequestId` correcto → 200 `cancelled` + historial + evento con `previousStatus: pending`; otro estado (incluido `cancelled`) → 409 `INVALID_TRANSITION` con `details.order`; inexistente o `clientRequestId` distinto → 404; sin auth.
  - Verificación: `npm test -- test/integration/orders-cancel.test.ts`
  - Estado: pendiente

- [ ] **T29 — `GET /api/orders`**
  - Qué: `list-orders.service.ts` y ruta según §6.6 (filtros, máximos, ventana de 12 h, acceso público/personal, orden de chequeo forma → auth → restaurante).
  - Archivos: `backend/src/modules/orders/list-orders.service.ts`, `orders.schemas.ts`, `orders.router.ts`, `backend/test/integration/orders-list.test.ts`
  - Requisitos: R10.1–R10.5, R8.3, R11.2, RNF11 (`since` sobre `updatedAt`)
  - Decisiones: D-055, D-089, D-098
  - Agente: `dev-backend`
  - Depende de: T21, T25
  - Criterios de aceptación: filtros combinados con Y; ids inexistentes omitidos; `tableId` solo → últimas 12 h (reloj fijo); `since` estricto; orden `createdAt` desc; > 100 ids / > 20 mesas / `since` sin `Z` → 400; solo `status`/`since` sin token, con token inválido o de otro restaurante → 401; restaurante inexistente → 404.
  - Verificación: `npm test -- test/integration/orders-list.test.ts`
  - Estado: pendiente

- [ ] **T30 — Rate limit**
  - Qué: `shared/rate-limit.ts` con las tres instancias de §14 (contador propio en la cancelación) y montaje en sus rutas; `handler` → 429 `RATE_LIMITED`.
  - Archivos: `backend/src/shared/rate-limit.ts`, `backend/src/modules/menu/menu.router.ts`, `backend/src/modules/orders/orders.router.ts`, `backend/test/integration/rate-limit.test.ts`
  - Requisitos: RNF7, R6 (D-104)
  - Decisiones: D-103, D-104, D-117
  - Agente: `dev-backend`
  - Depende de: T18, T28
  - Criterios de aceptación: 121.ª en menú y 21.ª en pedidos y en cancelación → 429; agotar pedidos no afecta la cancelación y viceversa; headers `RateLimit` estándar.
  - Verificación: `npm test -- test/integration/rate-limit.test.ts`
  - Estado: pendiente

## Bloque H — Tiempo real
Rama: `feature/backend-001-realtime` (D-136)

- [ ] **T31 — Protocolo y códigos de cierre**
  - Qué: `realtime/protocol.ts` (Zod del sobre `{ v: 1, id, type, ts, payload }`, entrantes conocidos, constructores de salientes) y `realtime/close-codes.ts` (§7.4).
  - Archivos: `backend/src/modules/realtime/protocol.ts`, `backend/src/modules/realtime/close-codes.ts`, `backend/test/unit/protocol.test.ts`
  - Requisitos: R9.2, R9.6, R9.7, R9.8, RNF6
  - Decisiones: D-042, D-092, D-094, D-099
  - Agente: `dev-backend`
  - Depende de: T9
  - Criterios de aceptación: sobres inválidos rechazados; tipos desconocidos distinguibles para ignorarlos; salientes con UUID nuevo y `ts` del reloj.
  - Verificación: `npx vitest run test/unit/protocol.test.ts`
  - Estado: pendiente

- [ ] **T32 — Hub y reparto de eventos**
  - Qué: `realtime/hub.ts`: estado por restaurante (`staff`, `tables`), alta/baja de conexiones, suscripción al bus, destinatarios = staff ∪ mesa, una serialización por evento y un envío por conexión, solo a `OPEN`.
  - Archivos: `backend/src/modules/realtime/hub.ts`, `backend/test/unit/hub.test.ts`
  - Requisitos: R7.1, R7.2, R7.3, R7.4, R11.2, RNF2
  - Decisiones: D-096
  - Agente: `dev-backend`
  - Depende de: T22, T31
  - Criterios de aceptación: con conexiones falsas: staff y mesa del pedido reciben; otra mesa y otro restaurante no; conexión suscrita a varias mesas recibe una vez; baja limpia todos los conjuntos.
  - Verificación: `npx vitest run test/unit/hub.test.ts`
  - Estado: pendiente

- [ ] **T33 — Handshake y suscripción del WS**
  - Qué: `realtime/upgrade.ts` y `attachRealtime` (§4.2, §7.2, §7.3): `noServer`, `maxPayload` 16 KB, ruta, `Origin` contra `CORS_ORIGINS`, validación en orden (4400 → 4404 → 4401 → 4403 → 4404 mesas → 1011), deduplicar `tableId`, ignorar `accessToken` sin `scope=staff` (F14), registrar en el hub y enviar `system.welcome`. Helper de cliente `ws` de prueba sobre puerto aleatorio.
  - Archivos: `backend/src/modules/realtime/upgrade.ts`, `backend/src/modules/realtime/connection.ts`, `backend/src/modules/realtime/index.ts` (o donde se exporte `attachRealtime`; ubicación propuesta), `backend/test/helpers/ws-client.ts`, `backend/test/integration/ws.test.ts`
  - Requisitos: R9.1, R9.3, R9.4, R8.2, R11.2, RNF6
  - Decisiones: D-091, D-092, D-093, D-094, D-103
  - Agente: `dev-backend`
  - Depende de: T17, T21, T32
  - Criterios de aceptación: cada fila de la tabla de §7.3 con su código; `Origin` no permitido → HTTP 403; sin `Origin` → aceptado; mesa inactiva aceptada; ningún evento antes del `welcome`; `welcome` es el primer mensaje.
  - Verificación: `npm test -- test/integration/ws.test.ts`
  - Estado: pendiente

- [ ] **T34 — Ciclo de vida de la conexión**
  - Qué: `realtime/connection.ts`: heartbeat (`system.ping` cada intervalo, `system.pong`, 4408 tras dos intervalos), temporizador a `exp` → 4401, entrantes (`BAD_MESSAGE` para binario/JSON/sobre inválido, `NOT_IMPLEMENTED` para `table.call_waiter`, ignorar desconocidos), limpieza al cerrar, `close(1001)` de `attachRealtime`.
  - Archivos: `backend/src/modules/realtime/connection.ts`, `backend/test/integration/ws.test.ts`
  - Requisitos: R9.5, R9.6, R9.7, R9.8, R8.4
  - Decisiones: D-092, D-094
  - Agente: `dev-backend`
  - Depende de: T33
  - Criterios de aceptación: con heartbeat acelerado: sin pong → 4408; con pong → sigue abierta; token que vence → 4401 y sin eventos después; mensaje inválido → `system.error` sin cierre; frame > 16 KB → 1009; `close(1001)` cierra todas las conexiones con 1001.
  - Verificación: `npm test -- test/integration/ws.test.ts`
  - Estado: pendiente

- [ ] **T35 — Eventos de punta a punta por WS**
  - Qué: tests de integración REST + WS: `order.created` y `order.status_changed` (PATCH y cancelación) llegan a staff y mesa; aislamiento por mesa y restaurante; sin eventos en rechazo, `noop` ni reintento idempotente; latencia COMMIT → recepción < 1 s.
  - Archivos: `backend/test/integration/ws-events.test.ts` (nombre propuesto)
  - Requisitos: R7.1–R7.4, R11.2, RNF2
  - Decisiones: D-096
  - Agente: `qa-tester`
  - Depende de: T26, T27, T28, T34
  - Criterios de aceptación: los casos listados pasan con dos restaurantes y varias mesas en el mismo test.
  - Verificación: `npm test -- test/integration/ws-events.test.ts`
  - Estado: pendiente

- [ ] **T36 — `server.ts`, build y apagado ordenado**
  - Qué: `server.ts` (§4.2): `parseEnv` → `createPrismaClient` → `createApp` → `http.createServer` → `attachRealtime` → `listen(PORT)`; SIGTERM/SIGINT: `server.close`, WS con 1001, intervalos detenidos, `prisma.$disconnect()`. Scripts `dev`, `build`, `start` funcionando.
  - Archivos: `backend/src/server.ts`, `backend/package.json` (si hace falta ajustar scripts), `.github/workflows/backend-ci.yml` (suma el paso `npm run build`, D-142)
  - Requisitos: RNF4 (un proceso), RNF3
  - Decisiones: D-033, D-066, D-068, D-103, D-129, D-133, D-142
  - Agente: `dev-backend`
  - Depende de: T30, T34 · `backend/.env` del usuario apuntando a `restaurante_dev` de Docker (D-133) [MANUAL]
  - Criterios de aceptación: `npm run build` genera `dist/server.js`; el server arranca con `npm start` y con `npm run dev`; Ctrl+C termina sin errores y cierra la conexión a la base.
  - Verificación: `npm run build` · `npm start` y en otra terminal `curl -i http://localhost:3000/api/nada` (404 `NOT_FOUND`) · `curl -i "http://localhost:3000/api/menu?restaurant=fogon"` (tras T38) · Ctrl+C con log de apagado
  - Estado: pendiente

## Bloque I — Seed, pruebas no funcionales, documentación y Supabase
Rama: `feature/backend-001-closing` (D-136)

- [ ] **T37 — Datos de la carta demo "Fogón"**
  - Qué: `prisma/seed-data/fogon.ts` copiando textos ES/EN, precios, etiquetas, destacados, disponibilidad y casos límite de `src/services/mock/menuData.ts` (`origin/develop`, solo lectura), sin imágenes, con UUID v4 fijos escritos en el archivo, grupos por plato, sin el "plato fantasma" (CL36); mesas 1–20 activas.
  - Archivos: `backend/prisma/seed-data/fogon.ts`
  - Requisitos: R1.1, R1.2 (datos de demo)
  - Decisiones: D-071, D-073, D-109, D-119, D-125
  - Agente: `dev-database`
  - Depende de: T6
  - Criterios de aceptación: mismo contenido que `menuData.ts` salvo imágenes y CL36; ningún `priceDeltaCents` negativo ni dato que viole un `CHECK` (si el mock tiene alguno, se frena y se consulta).
  - Verificación: `npm run typecheck` · revisión lado a lado con `git show origin/develop:src/services/mock/menuData.ts`
  - Estado: pendiente

- [ ] **T38 — Seed idempotente** [CONFIRMACIÓN: correr el seed en `restaurante_dev`]
  - Qué: `prisma/seed.ts` con upserts por id del restaurante `fogon`, mesas, carta y, si existe `SEED_STAFF_USER_ID`, el `StaffMember`.
  - Archivos: `backend/prisma/seed.ts`
  - Requisitos: R11.1, R8.5
  - Decisiones: D-108, D-109, D-110, D-133
  - Agente: `dev-database`
  - Depende de: T7, T37 (se prueba en `restaurante_dev` de Docker, D-133; en Supabase recién en T42)
  - Criterios de aceptación: dos corridas seguidas dejan los mismos conteos; sin `SEED_STAFF_USER_ID` no crea personal.
  - Verificación: `npm run db:seed` dos veces + `select count(*)` por tabla iguales · `GET /api/menu?restaurant=fogon` devuelve la carta
  - Estado: pendiente

- [ ] **T39 — Pruebas no funcionales**
  - Qué (D-135): RNF1 = carta de 200 platos, 5 solicitudes de calentamiento y p95 de **100** solicitudes a `GET /api/menu` < 500 ms (medición local orientativa); RNF4 = escenario de **10 restaurantes × 50 pedidos activos** cada uno, midiendo en él el p95 de RNF1 y la latencia COMMIT → recepción por WS de RNF2 (< 1 s); RNF5 (total = Σ líneas, sin duplicados); RNF10 (forma del JSON contra `domain/types.ts`); RNF11 (evento perdido recuperado con `since`).
  - Archivos: `backend/test/integration/non-functional.test.ts` (nombre propuesto)
  - Requisitos: RNF1, RNF2, RNF4, RNF5, RNF10, RNF11
  - Decisiones: D-032, D-033, D-135
  - Agente: `qa-tester`
  - Depende de: T29, T35
  - Criterios de aceptación: todos los escenarios pasan; p95 del menú < 500 ms tanto con un restaurante como con la carga de 10 × 50; evento < 1 s con esa carga; el p95 y la latencia se informan en la salida del test.
  - Verificación: `npm test -- test/integration/non-functional.test.ts`
  - Estado: pendiente

- [ ] **T40 — `backend/README.md`**
  - Qué: requisitos (Node 24, Docker Desktop), instalación, variables (`.env.example`, `.env.test.example`), comandos (scripts de §3 y `db:generate`, D-132), Postgres local en el puerto 5433 con las bases de desarrollo y de tests (D-131, D-133), CI (§23), migraciones (RLS y `CHECK` a mano), seed, y los pasos manuales de Supabase de §17.2.
  - Archivos: `backend/README.md`
  - Requisitos: RNF3 (documentación de conexión)
  - Decisiones: D-088, D-105, D-106, D-107, D-110, D-122, D-131, D-132, D-133, D-137
  - Agente: `devops`
  - Depende de: T36, T38, T44
  - Criterios de aceptación: alguien que clona el repo puede levantar la BD de tests y correr `npm test` siguiendo solo el README.
  - Verificación: seguir el README en limpio (`npm ci` [CONFIRMACIÓN], `npm run db:generate`, `db:test:up`, `npm test`)
  - Estado: pendiente

- [ ] **T41 — Proyecto Supabase** [MANUAL] [CONFIRMACIÓN]
  - Qué: el usuario, guiado por `devops` con el README (momento fijado por D-133): crea el proyecto con claves JWT asimétricas, crea el rol `prisma` con el SQL de la guía oficial (verificada al ejecutar), copia las URLs a su `.env`, desactiva la Data API y crea el usuario del personal (UUID → `SEED_STAFF_USER_ID`).
  - Archivos: ninguno del repo (el usuario edita `backend/.env`)
  - Requisitos: R8.1, R8.5, RNF3, RNF6
  - Decisiones: D-009, D-017, D-088, D-105, D-106, D-110, D-133
  - Agente: `devops`
  - Depende de: T40
  - Criterios de aceptación: JWKS público con clave asimétrica; versión mayor de Postgres igual a la de Docker (T3) y a la del CI (T44); si no coincide, se frena y se consulta.
  - Verificación: `curl -s https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` (clave con `alg` ES256 o RS256) · `select version();` en el SQL Editor
  - Estado: pendiente

- [ ] **T42 — Migraciones, seed y prueba de humo en Supabase** [CONFIRMACIÓN: `db:deploy` y `db:seed` contra Supabase]
  - Qué: aplicar las migraciones y el seed al proyecto Supabase; prueba de humo con el server local apuntando a Supabase.
  - Archivos: ninguno
  - Requisitos: R1.1, R5.1, R8.1, R9.1, RNF3
  - Decisiones: D-105, D-106, D-108, D-110
  - Agente: `devops` (con `dev-database`)
  - Depende de: T41
  - Criterios de aceptación: `migrate status` al día; RLS en todas las tablas; la Data API no expone tablas; menú, PATCH con un token real del personal y WS staff funcionan.
  - Verificación: `npm run db:deploy` · `npm run db:seed` · `curl "http://localhost:3000/api/menu?restaurant=fogon"` · `curl -X PATCH … -H "Authorization: Bearer <token real>"` · conexión WS staff con token real recibe `welcome` · consulta a la Data API rechazada
  - Estado: pendiente

- [ ] **T43 — Auditoría de cobertura requisito → test**
  - Qué: `qa-tester` recorre R1.1–R11.3 y RNF1–RNF11 y, para cada uno, indica el test que lo cubre. Si falta alguno, lo reporta (se agrega como tarea nueva, con aprobación).
  - Archivos: ninguno (resultado en el reporte de la tarea)
  - Requisitos: RNF9
  - Decisiones: D-016
  - Agente: `qa-tester`
  - Depende de: T39, T42
  - Criterios de aceptación: cada criterio `R#.#` tiene al menos un test automático; `npm test` completo en verde.
  - Verificación: `npm test` · `npm run typecheck` · `npm run lint` · listado criterio → archivo/test en el reporte
  - Estado: pendiente

---

## Acciones que requieren confirmación del usuario
| Tarea | Acción | Confirmación |
|---|---|---|
| T1 | `npm install` de las dependencias de §3 + `tsdown` (D-129) + paquetes de D-130 | Siempre (D-134) |
| T3 | `docker compose up -d` del Postgres local | Aprobada una vez con este documento (D-134) |
| T7 | Crear y aplicar la migración inicial en `restaurante_dev` de Docker (D-133) | Sí, en el momento |
| T8 y siguientes | Cada `npm test` aplica migraciones y vacía `restaurante_test` (§18.2) | Aprobada una vez con este documento (D-134) |
| T38 | Correr el seed en `restaurante_dev` | Sí, en el momento |
| T40 | `npm ci` al probar el README | Siempre (D-134) |
| T41 | Crear proyecto, rol `prisma`, desactivar Data API, crear usuario (manual del usuario) | Siempre (D-134) |
| T42 | `db:deploy` y `db:seed` contra Supabase | Siempre (D-134) |
| T44 | Push que dispara el workflow | Siempre (D-134) |
| Todas | Un commit por tarea aprobada, push y PR por bloque (D-136) | Siempre (D-134) |

## Matriz de cobertura requisito → tareas
| Requisito | Tareas |
|---|---|
| R1 (R1.1–R1.7) | T18, T30 (rate limit), T37, T38, T42 |
| R2 (R2.1–R2.4) | T19 |
| R3.1 | T25 |
| R3.2 | T23, T24, T26 |
| R3.3 | T23 |
| R3.4 | T9, T11, T23 |
| R3.5 | T12, T24 |
| R3.6, R3.7 | T13, T24 |
| R3.8 | T6, T25 |
| R3.9 | T14, T25 |
| R3.10, R3.11 | T15, T26 |
| R3.12 | T25, T26 |
| R3.13 | T12, T24 |
| R3.14 | T23, T25 |
| R4 (R4.1–R4.3) | T16 (500 genérico), T22, T25 |
| R5 (R5.1–R5.10) | T10, T27 |
| R6 (R6.1–R6.4) | T10, T28, T30 |
| R7 (R7.1–R7.4) | T22, T25, T27, T28, T32, T35 |
| R8.1 | T20, T21, T27, T42 |
| R8.2 | T20, T33 |
| R8.3 | T29 |
| R8.4 | T34 |
| R8.5 | T21, T38 |
| R9 (R9.1–R9.8) | T31, T33, T34, T42 |
| R10 (R10.1–R10.5) | T29 |
| R11.1 | T6, T7, T21, T38 |
| R11.2 | T18, T19, T27, T29, T32, T33, T35 |
| R11.3 | T12, T24 |
| RNF1 | T18, T39 (N=100, D-135) |
| RNF2 | T32, T35, T39 (con la carga de RNF4) |
| RNF3 | T2, T6, T36, T40, T41, T42 |
| RNF4 | T36 (un proceso), T39 (escenario 10 restaurantes × 50 pedidos activos midiendo RNF1 y RNF2, D-135) |
| RNF5 | T7, T13, T25, T26, T39 |
| RNF6 | T2, T4, T16, T17, T31, T33 |
| RNF7 | T30 |
| RNF8 | T5, T17 |
| RNF9 | T8, todos los tests, T43, T44 (CI) |
| RNF10 | T9, T16, T17, T18, T22, T39 |
| RNF11 | T22, T29, T39 |

## Orden sugerido
Cada bloque cierra con su PR a `develop` (D-136); desde el Bloque B, ese PR corre el CI.
1. **A · `feature/backend-001-base`:** T1 → T2 → T3 → T4 → T5
2. **B · `feature/backend-001-data`:** T6 → T7 → T8 → T44
3. **C · `feature/backend-001-domain`:** T9 → T10 → T11 → T12 → T13 → T14 → T15
4. **D · `feature/backend-001-http`:** T16 → T17
5. **E · `feature/backend-001-public-reads`:** T18 → T19
6. **F · `feature/backend-001-staff-auth`:** T20 → T21
7. **G · `feature/backend-001-orders`:** T22 → T23 → T24 → T25 → T26 → T27 → T28 → T29 → T30
8. **H · `feature/backend-001-realtime`:** T31 → T32 → T33 → T34 → T35 → T36
9. **I · `feature/backend-001-closing`:** T37 → T38 → T39 → T40 → T41 → T42 → T43

T44 tiene número 44 porque se agregó en la v1.1; se implementa al cerrar el Bloque B. T36 suma `npm run build` al workflow (D-142). Nombres de bloque de las ramas: D-144 (el patrón lo fija D-136).

## Decisiones resueltas en la v1.1
Q1 → D-129 · Q2 → D-130 · Q3 → D-133 · Q4 → D-131 · Q5 → D-132 · Q6 → D-134 · Q7 → D-135 · Q8 → D-136 · Q9 → D-137.

C1 → D-138 · C2 → D-139 · C3 → D-140 · C4 → D-141 · C5 → D-142 · C6 → D-143 · nombres de ramas y bases → D-144.

## Decisiones pendientes
Sin pendientes.

## Aprobación
- [x] Aprobado por el usuario · Fecha: 2026-10-24 (D-145)
