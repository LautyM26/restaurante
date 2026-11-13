# Cómo trabajamos en este repositorio

Guía común para las dos personas del equipo **y para sus agentes de IA**. Si sos un agente (Claude u otro), leé este archivo antes de tocar código, ramas o specs. Ante una duda que esta guía no resuelva, preguntale a tu persona antes de improvisar.

- **Frontend** (carta del cliente y panel de cocina/salón): Lautaro.
- **Backend** (API REST + WebSocket): Uriel.

## 1. Metodología: Specification-Driven Development (SDD)

Nada se programa sin una especificación aprobada.

1. **Spec**: qué se construye y por qué (requisitos, casos límite, preguntas abiertas con decisión del responsable).
2. **Plan / diseño**: cómo se construye (contratos, modelo de datos, archivos afectados).
3. **Tareas**: lista ordenada y chica; se implementa **una tarea por vez**.
4. **Implementación con TDD**: primero el test en rojo, después el código mínimo para pasarlo, después refactor con todo en verde.

Una tarea está **terminada** solo cuando los tests y el build de su lado pasan, sin romper tests existentes.

Las specs viven en `specs/` y se suben a GitHub para que el otro vea lo aprobado:
- Backend: `specs/backend/NNN-nombre/`.
- Frontend: `specs/NNN-nombre/` (por ahora en la raíz de `specs/`; pasará a `specs/frontend/`, ver sección 3).
- Común a los dos: `specs/constitucion.md`.

Si un cambio de un lado afecta el contrato del otro (rutas, campos, eventos, estados), **se acuerda entre los dos antes de implementarlo** y se deja escrito en la spec que corresponda.

## 2. Ramas (Git Flow)

| Rama | Para qué |
|---|---|
| `main` | Producción. Solo recibe merges de `develop` cuando se publica una versión. **Nunca se commitea directo.** |
| `develop` | **Integración. Es la rama por defecto del repo.** Todo el trabajo termina acá. |
| `feature/<nombre>` | Una funcionalidad o tarea. Sale de `develop` actualizado. |
| `fix/<nombre>` | Corrección de un error en `develop`. |
| `hotfix/<nombre>` | Corrección urgente sobre `main`. |
| `chore/<nombre>` | Mantenimiento, configuración, documentación. |

Flujo de cada trabajo:

```bash
git checkout develop && git pull           # partir de develop al día
git checkout -b feature/<nombre>           # rama propia
# ... commits ...
git merge develop                          # traer lo nuevo de develop antes del PR
git push -u origin feature/<nombre>
# abrir un Pull Request hacia develop (es el destino por defecto)
```

- Cada uno trabaja en sus propias ramas. **No se pushea a la rama del otro** sin avisar.
- Los PR van a `develop` y los revisa la otra persona antes del merge.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/) **100 % en inglés**, en los dos lados (decisión D-014): `type(scope): description`.

```
feat(backend): add GET /api/menu
feat(hero): add immersive 3d carousel
fix(cart): keep line notes when merging equal lines
docs(specs): approve backend 001 design
```

Tipos habituales: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

> Los commits del frontend anteriores al 2026-11-12 tienen la descripción en español. No se reescriben; la regla vale de acá en adelante.

## 3. Stack oficial

### Backend (`backend/`)

**Node.js + Express + TypeScript**, con:
- WebSocket nativo con la librería `ws` (no Socket.IO).
- **Prisma** sobre **PostgreSQL en Supabase**.
- **Supabase Auth** para el personal (cocina, salón, dueño); el backend verifica el token en REST y en el WebSocket.
- Tests: Vitest + Supertest.

> ⚠️ **No usamos FastAPI ni Python.** Algunos documentos viejos mencionan "JWT en FastAPI": está desactualizado. El backend es Node.js + Express + Supabase.

### Frontend (raíz del repo)

> **Migración planificada a monorepo.** Hoy el frontend vive en la raíz del repo y sus specs en `specs/NNN-nombre/`. Está planificado moverlo a `frontend/` (junto a `backend/`) y sus specs a `specs/frontend/`, para alinearnos con la constitución (D-039, D-040). La mudanza **no se hace todavía** para no romper rutas ni configuración en medio de la Spec 002 del frontend; se hará en su propia rama `chore/` y se avisará antes.

React + Vite + TypeScript, Tailwind CSS v4, Motion (`motion/react`), íconos Phosphor. Tests: Vitest + Testing Library + jsdom + axe-core. Dos entradas: `index.html` (carta del cliente, `/?mesa=12`) y `panel.html` (panel de cocina y salón).

Mientras el backend no esté conectado, el frontend usa un backend simulado detrás de una capa de servicios (`src/services/`); `src/services/index.ts` es el único punto de cambio para pasar al backend real.

### Comandos

| | Frontend (raíz) | Backend (`backend/`) |
|---|---|---|
| Desarrollo | `npm run dev` | `npm run dev` |
| Tests | `npm test` | `npm test` |
| Build | `npm run build` | `npm run build` |

## 4. Convenciones del contrato entre frontend y backend

El detalle está en `specs/backend/001-pedidos-tiempo-real/diseno.md` (backend) y en `specs/001-menu-cliente/plan.md` §6-§7 (frontend). Lo esencial:

- **Todo en inglés**: rutas, parámetros, campos, estados, eventos y código. Los textos que ve el cliente están en español (inglés como segundo idioma de la carta).
- **JSON en camelCase**: `dishId`, `totalCents`, `clientRequestId`.
- **Dinero en centavos enteros**: ARS con impuestos incluidos (`totalCents: 125000` = $1.250,00).
- **Fechas en ISO 8601, UTC, con `Z`**: lo que produce `Date.prototype.toISOString()` (`2026-11-12T18:30:00.000Z`). En la base: `timestamptz`.
- **Ids**: UUID.
- **Prefijo `/api`** en todas las rutas REST.
- **Errores**: `{ "code": "STATUS_CONFLICT", "message": "...", "details"?: {...} }`, con `code` en MAYÚSCULAS_CON_GUION_BAJO.
- **Estados del pedido**: `pending` → `accepted` → `preparing` → `ready` → `delivered`, más `cancelled` desde cualquier estado no final. Cambios de estado con `PATCH /api/orders/{id}/status` y `expectedStatus` (si no coincide: 409 `STATUS_CONFLICT`).
- **Tiempo real**: WebSocket en `/ws/orders`; todo mensaje usa el sobre `{ v, id, type, ts, payload }` (`ts` = hora del servidor en UTC).
- **Idempotencia** al crear pedidos: `clientRequestId` + cabecera `Idempotency-Key`.

## 5. Qué no se sube a git

- **Configuración personal de agentes y skills**: `CLAUDE.md`, `.claude/`, `opencode/`, `skills/`, `docs/` del equipo, `plantillas/`. Cada uno tiene su propio sistema y no se mezclan.
- **Secretos**: ningún `.env`. Solo se suben los `.env.example` (sin valores reales), revisados por una persona antes del commit.
- Carpetas generadas: `node_modules/`, `dist/`, `graphify-out/`.

## 6. Para agentes de IA

- Este archivo y `specs/` son la fuente de verdad compartida. Tu memoria o configuración local puede estar desactualizada: ante una contradicción, gana lo que está en el repo.
- No commitees ni pushees a `main`, ni a ramas del otro integrante.
- No cambies un contrato compartido (sección 4) sin que tu persona lo haya acordado con la otra.
- Si una spec o un plan aprobado parecen incorrectos, pará y avisá en lugar de improvisar.
