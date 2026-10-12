# Constitución del proyecto: restaurante

**Estado:** APROBADO (2026-10-11) · **Versión:** 1

> Documento de la Fase 0. Define las reglas del proyecto. Cada elección referencia la decisión del usuario que la originó.

## 1. Proyecto
- Cliente / empresa: Proyecto propio (D-003)
- Tipo: sistema de pedidos en tiempo real. Este repo contiene el backend (API REST + WebSockets) y el frontend (Vista Cliente y Vista Restaurante).
- Objetivo de negocio: producto para varios restaurantes (multi-local). El modelo de datos tiene que separar la información por restaurante (D-019).
- Usuarios principales: clientes (ven el menú, arman el carrito, hacen el pedido y siguen su estado en tiempo real) y personal del restaurante (cocineros/dueño, con login, que gestionan la cola de pedidos).

## 2. Stack
| Capa | Elección | Decisión |
|---|---|---|
| Framework (backend) | Node.js + Express (API REST) + Socket.IO (tiempo real) | D-005 |
| Framework (frontend) | Lo define el compañero | — |
| Lenguaje (backend) | TypeScript | D-005 |
| Estilos / UI | Lo define el compañero (frontend) | D-017 |
| Base de datos | PostgreSQL en Supabase | D-006, D-009 |
| ORM | Prisma | D-007 |
| Autenticación | Supabase Auth, solo para el personal (cocineros/dueño); el backend verifica el token en REST y en Socket.IO | D-009 |
| Testing | Vitest + Supertest | D-016 |
| Gestor de paquetes | npm | D-016 |

## 3. Hosting y entornos
| Entorno | Dónde | URL | Decisión |
|---|---|---|---|
| Desarrollo | Local (`C:\Proyectos\restaurante`) | localhost | D-001 |
| Preview / staging | A decidir antes del primer deploy | | D-010 |
| Producción | A decidir antes del primer deploy (debe soportar WebSockets/Socket.IO) | | D-010 |

## 4. Estándares adoptados
| Estándar | Adoptado | Excepciones aprobadas |
|---|---|---|
| `docs/estandares/codigo.md` | Sí | Nombres del dominio en español, resto del código en inglés (D-012, D-013). La estructura Next.js no aplica: la define el diseño del backend |
| `docs/estandares/git.md` | Sí, tal cual (D-014) | — |
| `docs/estandares/diseno.md` | Lo decide el compañero (es del frontend) (D-017) | — |
| `docs/estandares/deploy.md` | Parcial (D-017) | Por ahora solo la sección Supabase: `DATABASE_URL` con pooling para la app y `DIRECT_URL` para las migraciones. El resto se adopta cuando se decida el hosting (D-010) |
| `docs/estandares/definicion-de-terminado.md` | Sí: secciones Código y Backend / datos (D-015) | Una migración se revierte con otra migración hacia adelante (Prisma no genera reversas). Interfaz y Entrega web no aplican al backend |

## 5. Principios y restricciones del proyecto
- Equipo de 2 personas: el usuario hace el backend y el compañero el frontend. Nunca commit directo a `main`.
- Flujo git: `docs/estandares/git.md` tal cual: `main` (producción), `develop` (integración), ramas `feature/*`, `fix/*`, `hotfix/*` y `chore/*`, Conventional Commits en inglés (D-014). Transición acordada con el compañero: se crea `develop` desde `main` y se trabaja en ramas `feature/*`; `backend` y `frontend` dejan de usarse (su borrado se confirma aparte) (D-018).
- La configuración de agentes y skills (`CLAUDE.md`, `.claude/`, `docs/` del equipo, `plantillas/`) no se commitea.
- `specs/` se sube a GitHub para que el compañero vea lo aprobado (D-004).
- Las decisiones de stack se consultan con el compañero antes de aprobarlas (D-002).
- Estructura del repo: carpetas hermanas `backend/` y `frontend/`, cada una con su propio `package.json` (D-008). El front se subió en la raíz; el compañero lo mueve a `frontend/` (D-039).
- Specs separadas por lado: `specs/backend/NNN-…` y `specs/frontend/NNN-…`, cada lado con su propia numeración. `specs/constitucion.md` es común (D-040).
- Nombres de tablas, campos, estados y eventos en español (`Producto`, `Pedido`, `Pedido_Detalle`, `nuevo_pedido`…). Es una excepción aprobada por el usuario a la regla "código y nombres en inglés" de `CLAUDE.md` §6 y de `docs/estandares/codigo.md` (D-012). Funciones, variables y archivos siguen en inglés (D-013). Ej.: modelo `Pedido`, `createOrder()`, `order-controller.ts`.

## 6. Comandos
- Desarrollo: · Build: · Tests: · Lint:

## 7. Registro de decisiones del proyecto
| ID | Tema | Opción elegida por el usuario | Fecha |
|---|---|---|---|
| D-001 | Ubicación del proyecto | Mover de OneDrive a `C:\Proyectos\restaurante` | 2026-10-11 |
| D-002 | Cómo definir el stack (el repo estaba vacío) | Elegirlo ahora en Fase 0 (`/nuevo-sistema`), consultándolo con el compañero | 2026-10-11 |
| D-003 | Para qué es el proyecto | Proyecto propio | 2026-10-11 |
| D-004 | ¿`specs/` se sube a GitHub? | Sí, compartida | 2026-10-11 |
| D-005 | Lenguaje y framework del backend (opciones: Express / Fastify / NestJS / FastAPI) | Node.js + TypeScript + Express + Socket.IO | 2026-10-11 |
| D-006 | Motor SQL y dónde corre en desarrollo (opciones: PostgreSQL en Neon/Supabase / PostgreSQL local con Docker / MySQL) | PostgreSQL en Neon/Supabase | 2026-10-11 |
| D-007 | ORM (opciones: Prisma / Drizzle / TypeORM) | Prisma | 2026-10-11 |
| D-008 | Organización del repo (opciones: carpetas `backend/` + `frontend/` / monorepo con workspaces / backend en la raíz) | Carpetas `backend/` y `frontend/` | 2026-10-11 |
| D-009 | Base y login. El usuario agregó el requisito de login solo para cocineros/dueño (opciones: Supabase + Auth / Neon + Better Auth / Neon + JWT propio) | Supabase: base de datos + Supabase Auth | 2026-10-11 |
| D-010 | Hosting del backend (opciones: decidir antes del 1er deploy / servidor persistente / Vercel Functions / VPS) | Decidirlo antes del primer deploy | 2026-10-11 |
| D-011 | Adopción de estándares (opciones: con excepciones / tal cual / uno por uno) | Revisarlos uno por uno | 2026-10-11 |
| D-012 | Idioma de tablas, campos, estados y eventos (opciones: todo inglés / código inglés + contrato español / todo español) | Todo en español, como en el pedido original | 2026-10-11 |
| D-013 | `codigo.md`: alcance del español (opciones: dominio en español y resto en inglés / todo el código en español) | Dominio en español, resto en inglés | 2026-10-11 |
| D-014 | `git.md` (opciones: ramas backend/frontend + commits en inglés / ídem en español / estándar tal cual) | Estándar tal cual: `develop` + `feature/*`, Conventional Commits en inglés | 2026-10-11 |
| D-015 | DoD: migraciones reversibles con Prisma (opciones: revertir con migración nueva / script de reversa por migración) | Revertir con migración nueva | 2026-10-11 |
| D-016 | Herramientas de `stack.md` (opciones: estándar / con pnpm / con Jest) | Estándar: npm, TS strict, Zod en los bordes, ESLint+Prettier, Vitest+Supertest, env validado en `src/env.ts` | 2026-10-11 |
| D-017 | `deploy.md` y `diseno.md` (opciones: Supabase ya y el resto después / ambos tal cual) | Sección Supabase de `deploy.md` ya; el resto al decidir el hosting. `diseno.md` lo decide el compañero | 2026-10-11 |
| D-018 | Ramas `backend`/`frontend` con el nuevo flujo (opciones: migrar / híbrido / esperar) | Primero: esperar a hablarlo con el compañero. Resuelto después de hablarlo: migrar a `develop` + `feature/*` | 2026-10-11 |
| D-019 | Objetivo del proyecto (opciones: aprendizaje / restaurante real / varios restaurantes) | Producto para varios restaurantes (multi-local) | 2026-10-11 |
| D-039 | El front quedó en la raíz, no en `frontend/` (opciones: el front se mueve a `frontend/` / front en la raíz y back en `backend/`) | El front se mueve a `frontend/` (lo hace el compañero) | 2026-10-11 |
| D-040 | Dos specs numeradas 001 (opciones: la nuestra pasa a 003 / carpetas por lado / dejar las dos como 001) | Carpetas por lado: `specs/backend/` y `specs/frontend/` | 2026-10-11 |
| D-041 | Alcance del commit de `specs/` (opciones: commit local sin push / commit + push + PR / push sin PR) | Commit local en `chore/backend-specs` (desde `develop`), sin push hasta alinear el contrato | 2026-10-11 |

## 8. Specs
| Spec | Estado | Fase |
|---|---|---|
| `backend/001-pedidos-tiempo-real` | Requisitos APROBADOS (2026-10-11); se reabren para alinearlos con el front (D-038) | 1 — Alineación con el front |
| `frontend/001-menu-cliente` (del compañero, en la rama `frontend`) | Aprobada por el compañero | — |

## Aprobación
- [x] Aprobado por el usuario · Fecha: 2026-10-11 (el usuario confirmó que el stack se habló con el compañero, D-002)
