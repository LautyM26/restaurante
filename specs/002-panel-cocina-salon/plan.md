# Plan 002: Panel de cocina y salón

- **Estado:** aprobado (por el usuario, 2026-10-20)
- **Fecha:** 2026-10-17
- **Spec:** `specs/002-panel-cocina-salon/spec.md` (61 RF, 12 RNF, 44 CL; decisiones P1-P20 del 2026-10-20)
- **Tareas:** `specs/002-panel-cocina-salon/tasks.md`

> Lectura de diseño: *tablero operativo para cocina y salón, leído de reojo a 1,5 m con las manos ocupadas; oscuro y sobrio como un dashboard SaaS (ref 2), con la energía de las alertas de la ref 3 reservada para lo que importa, sobre la identidad "Fogón" de la 001 (carbón + brasa). Prioridad: escanear, actuar con un toque y no perder ninguna alerta.*
>
> Las marcas **(P#)** remiten a las decisiones del usuario del 2026-10-20 (spec §9), que aprobaron todas las recomendaciones. Backend: Node.js + Express + Supabase, de Uriel (P1). Las tareas de autenticación son dominio **CRÍTICO** (gobernanza del proyecto): no se implementan sin aprobación explícita del usuario.

---

## 0. Resumen en una línea por capa

| Capa | Decisión |
|---|---|
| Entrada | Segunda página de Vite: `panel.html` → `src/panel/main.tsx` → `<PanelApp/>`. La carta (`index.html`) no cambia. |
| Arquitectura | Las mismas capas de la 001: `domain` (reglas puras nuevas: tablero, reglas de alertas, cola de alertas, sesión) → `services` (contratos nuevos `AuthService`, `RealtimeStatusService`, `TableService` + mocks + decorador `withStaffAuth`) → `panel/*` (providers y pantallas) → `ui` (kit compartido; se suma `Dialog`). |
| Estado | Sin librerías: `AuthProvider`, `StationProvider`, `BoardProvider` (suscribir primero + buffer + `mergeOrder`, movimientos optimistas), `AlertsProvider` (`useReducer(alertQueueReducer)`), `SoundProvider`. |
| Datos | El mismo mock de pedidos de la 001 (localStorage + BroadcastChannel): cliente en una pestaña, panel en otra. Ingreso simulado con usuarios de demostración. El adaptador real REST + WebSocket se diseña (§7.5-§7.6), no se implementa. |
| Seguridad | La interfaz nunca ve el token; solo `AuthService` y el decorador. Token corto en memoria + renovación por cookie `httpOnly` (P3); token del WebSocket por primer mensaje `system.auth` (P4). |
| Alertas | Reglas puras evento → alerta (prioridad, sonido, clave de deduplicación) + cola pura (críticas de a una, pila de 3, ráfagas agrupadas, obsoletas retiradas). Modal `alertdialog` para críticas; pila lateral para altas e informativas. |
| Sonido | Web Audio sintetizado, sin archivos (P17); desbloqueo con el primer gesto (incluido el "Ingresar"). |
| Visual | Tokens de la 001 + pocos nuevos. Barra de tres píldoras flotantes y cifras gigantes (ref 2); modales y avisos con entrada lateral y escalonado (ref 3); tarjeta "comanda" con acción en píldora hueso con círculo y flecha (P13). |
| Tests | Vitest + Testing Library + jsdom + axe-core, TDD por tarea, fakes nuevos (`fakeAuthService`, `fakeSoundPlayer`, `fakeRealtimeStatus`, `fakeTableService`); integración cliente ↔ panel con el mock real. |

---

## 1. Stack, dependencias y desviaciones

### 1.1 Dependencias
**Ninguna nueva.** Todo lo que la 002 necesita ya está en el proyecto o es nativo del navegador (skill `ponytail`):

| Necesidad | Se usa | Se descarta | Por qué |
|---|---|---|---|
| Modales | `<dialog>` nativo + Motion (como `Sheet` de la 001, D3) | Radix Dialog, Headless UI | Foco, `inert` y top layer nativos; patrón ya probado en la 001. |
| Avisos apilados | Componente propio (`AlertStack`) | Sonner | La cola tiene reglas de negocio (prioridades, ráfagas, obsoletas) que viven en el dominio; Sonner solo resolvería la presentación y sumaría una dependencia. |
| Sonido | Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`) | Archivos `.mp3`, Howler.js | Sin descargas ni licencias; tonos distinguibles generados en el momento. |
| Pantalla encendida | Screen Wake Lock API (`navigator.wakeLock`) | NoSleep.js | Nativo en los navegadores objetivo (Safari 16.4+, Chrome 84+, Firefox 126+); requiere HTTPS. |
| Arrastrar tarjetas | Nada (P8) | dnd-kit | Fuera de alcance. |
| Router | Nada | React Router | Dos pantallas por estado de sesión (ingreso / tablero); sin URLs internas. |

### 1.2 Desviaciones
Las mismas aprobadas en la 001 (React + Vite en lugar de Live Server, `npm test` en lugar de `node --test`; plan 001 §1.2). Nueva: **ninguna**. `panel.html` en la raíz es la "segunda entrada de Vite" que ya preveía la 001 (D2).

---

## 2. Estructura de carpetas y archivos

Entre paréntesis, la tarea que crea (C) o modifica (M) cada archivo. Las marcas **[P9]**, **[P12]** y **[P18]** solo indican qué decisión origina cada archivo; las tres están confirmadas (2026-10-20) y se implementan.

```
panel.html                     metas de la 001 + <meta name="robots" content="noindex, nofollow">; <title>Panel · Fogón</title>;
                               <div id="root">; script /src/panel/main.tsx                                         (T1 C)
vite.config.ts                 build.rollupOptions.input = { main: index.html, panel: panel.html }                 (T1 M)

src/
  config.ts                    + constantes del panel (§2.1)                                                       (T1 M)
  domain/types.ts              statusHistory[] suma `by?: 'staff' | 'customer'` (opcional, aditivo; C5)            (T5 M)

  domain/                      puro, sin React ni DOM
    board.ts                   estaciones, columnas, orden, acción principal, cifras, tiempos                      (T1 C)
    alertRules.ts              evento del tablero → AlertDraft[] (prioridad, sonido, clave)                        (T1 C)
    alertQueue.ts              reducer de la cola + selectores                                                     (T1 C)
    session.ts                 needsRefresh, isExpired                                                             (T1 C)
    orderStatus.ts             [P9] previousStep() y opción allowStepBack en canTransition/applyTransition         (T1 M)

  services/
    contracts.ts               + AuthService, StaffUser, StaffSession, AuthState, RealtimeStatusService,
                               TableService [P12], PanelServices; ServiceErrorCode + UNAUTHORIZED,
                               INVALID_CREDENTIALS, RATE_LIMITED; details.retryAfterSec                            (T2 M, T5 M, T9 M)
    withStaffAuth.ts           decorador de OrderService para operaciones del personal                             (T2 C)
    index.ts                   + createPanelServices() (sigue siendo el ÚNICO punto de elección)                   (T2 M, T5 M, T9 M)
    PanelServicesContext.tsx   <PanelServicesProvider> + usePanelServices()                                        (T2 C)
    apiConfig.ts               API_CONFIG = { restaurantSlug: 'fogon' }: ÚNICO lugar del slug del restaurante (K3);
                               lo usan el mock de ingreso (restaurante del usuario demo) y el adaptador HTTP futuro (T2 C)
    mock/
      staffUsers.ts            usuarios de demostración (solo mock)                                                (T2 C)
      mockAuthService.ts       ingreso, restauración, renovación, vencimiento, límite de intentos                  (T2 C)
      mockRealtimeStatus.ts    'live' | 'connecting' | 'offline' desde online/offline + forzado de demo             (T5 C)
      mockTableService.ts      [P12] llamadas en localStorage + BroadcastChannel('restaurante.tables')             (T9 C)
      mockOrderService.ts      [P9] updateOrderStatus acepta retroceder un paso (como el backend, D-060)           (T5 M)
      mockOrderService.ts      + cancelByCustomer(id, clientRequestId) solo del mock: `pending` → `cancelled` con
                               `by: 'customer'` en esa entrada del historial (P11, K5)                             (T5 M)
      demoHelpers.ts           + expireToken(), revokeSession(), setConnection(), cancelAsCustomer(), callWaiter() [P12] (T2 M, T5 M, T9 M)

  ui/
    Dialog.tsx                 modal centrado sobre <dialog> (variantes 'dialog' | 'alertdialog')                  (T3 C)
    PillAction.tsx             píldora hueso con círculo y flecha (acción principal)                               (T6 C)

  i18n/es.ts, en.ts            + claves panel.* (§8)                                                               (T1-T9 M)

  panel/
    main.tsx                   fuentes, estilos, <PanelApp/>; en DEV instala window.__demo con los extras        (T1 C; T2 M)
    PanelApp.tsx               árbol de providers (§3)                                                             (T1 C; T3-T9 M)
    auth/
      AuthContext.tsx          <AuthProvider> + useAuth(): estado, login, logout                                   (T3 C)
      AuthGate.tsx             restoring → PanelSplash; signedOut → LoginScreen; signedIn/expired → hijos           (T3 C)
      LoginForm.tsx            formulario reutilizable (pantalla y modal de sesión vencida)                        (T3 C)
      LoginScreen.tsx          composición de la ref 2 (palabras escalonadas) + LoginForm                          (T3 C)
      SessionExpiredDialog.tsx alertdialog con LoginForm sobre el tablero congelado                                (T3 C)
      PanelSplash.tsx          carga breve mientras se restaura la sesión                                          (T3 C)
    station/
      StationContext.tsx       'kitchen' | 'floor' | null, recordado con safeStorage                               (T4 C)
      StationPicker.tsx        dos opciones gigantes Cocina / Salón                                                (T4 C)
    shell/
      PanelShell.tsx           layout: barra, banner, franja de llamadas, cifras, tablero, alertas                (T4 C; T5-T9 M)
      PanelTopBar.tsx          tres píldoras flotantes (ref 2)                                                     (T4 C; T5, T8 M)
      StationSwitch.tsx        SegmentedControl Cocina | Salón                                                     (T4 C)
      AccountMenu.tsx          divulgación: usuario, idioma, estación (celular), cerrar sesión                    (T4 C; T7 M)
      KpiStrip.tsx             cifras gigantes con divisores diagonales                                            (T4 C; T6 M)
      ConnectionPill.tsx       En vivo / Reconectando / Sin conexión + hora de actualización                       (T5 C)
      OfflineBanner.tsx        aviso persistente a los 30 s sin conexión                                           (T5 C)
      useTitleBadge.ts         "(3) Cocina · Fogón"                                                                (T7 C)
      useWakeLock.ts           pantalla encendida (P18)                                                            (T8 C)
    board/
      BoardContext.tsx         <BoardProvider>: carga, tiempo real, sincronización, movimientos, demora           (T5 C; T7 M)
      KanbanBoard.tsx          grilla de columnas (≥ 768) / columna con selector (< 768)                           (T6 C)
      KanbanColumn.tsx         encabezado fijo + lista con desplazamiento propio                                   (T6 C)
      ColumnTabs.tsx           selector de columnas con contadores (< 768)                                         (T6 C)
      OrderTicket.tsx          tarjeta "comanda" (completa y compacta)                                             (T6 C)
      TicketLines.tsx          líneas, opciones y notas                                                            (T6 C)
      CancelOrderDialog.tsx    confirmación de cancelación                                                         (T6 C)
      BoardStates.tsx          esqueleto, error con "Reintentar", vacío                                            (T6 C)
    alerts/
      AlertsContext.tsx        <AlertsProvider>: cola, sonido, anuncios, repetición de críticas                    (T7 C; T8 M)
      AlertDialogHost.tsx      la crítica actual ("1 de 3")                                                        (T7 C)
      AlertStack.tsx           pila de altas e informativas                                                        (T7 C)
      alertText.ts             AlertDraft → texto con t() (se traduce al cambiar idioma)                           (T7 C)
    sound/
      soundPlayer.ts           createWebAudioPlayer(): SoundPlayer + CUES                                          (T8 C)
      SoundContext.tsx         <SoundProvider>: estado, silencio recordado, desbloqueo con el primer gesto         (T8 C)
      SoundPill.tsx            "Activar sonido" (píldora blanca) / silenciar                                       (T8 C)
    calls/                     [P12]
      CallsContext.tsx         llamadas abiertas, suscripción, resolver                                            (T9 C)
      CallsStrip.tsx           franja "Llamadas" del Salón                                                         (T9 C)

  features/                    [P12] lado del cliente
    hero/Hero.tsx              botón "Llamar al mozo" junto a TableBadge                                           (T9 M)
    orders/OrderCard.tsx       botón "Llamar al mozo" en el aviso de demora                                        (T9 M)
    layout/CallWaiterButton.tsx  botón con enfriamiento de 60 s                                                    (T9 C)
  state/useCallWaiter.ts       [P12] envío, enfriamiento por mesa en sessionStorage                                (T9 C)

  styles/index.css             + tokens del panel (§9.2) y clases .btn-bone, .ticket, .ticket-stamp, .kpi-divider,
                               .column-fade; html.panel con escala ≥ 1600 px                                       (T1 M; T4, T6 M)

tests/
  panelUtils.tsx               renderPanel(ui, { services, station, authState, lang }) + expectNoA11yViolations    (T1 C)
  fixtures/fakeAuthService.ts  AuthService controlable (estado, login que falla, vencer)                           (T2 C)
  fixtures/fakeRealtimeStatus.ts                                                                                   (T5 C)
  fixtures/fakeSoundPlayer.ts  registra play(cue), estado controlable                                              (T7 C)
  fixtures/fakeTableService.ts [P12]                                                                               (T9 C)
  fixtures/boardOrders.ts      constructor de pedidos con statusHistory coherente (usa makeOrder)                  (T1 C)
  domain/…, services/…, panel/… (espejo de src/)
```

### 2.1 Constantes nuevas (`src/config.ts`)
| Constante | Valor | Uso |
|---|---|---|
| `ALERT_HIGH_MS` | 10000 | Duración de una alerta alta |
| `ALERT_INFO_MS` | 4000 | Duración de una informativa (igual que `TOAST_MS`) |
| `MAX_VISIBLE_ALERTS` | 3 | Pila visible |
| `BURST_WINDOW_MS` / `BURST_MIN` | 3000 / 3 | Ráfaga de pedidos nuevos (RF37) |
| `SOUND_MIN_GAP_MS` | 1000 | Separación mínima entre sonidos (RF43) |
| `CRITICAL_REPEAT_MS` / `CRITICAL_REPEAT_MAX` | 30000 / 5 | Repetición de críticas (RF44) |
| `OFFLINE_ESCALATE_MS` | 30000 | Aviso persistente sin conexión (RF51) |
| `UNDO_MS` | 5000 | "Deshacer" [P9] |
| `NOW_TICK_MS` | 15000 | Reloj del tablero (tiempos y demora) |
| `RESYNC_OVERLAP_MS` | 5000 | Margen de `since` al resincronizar |
| `SELF_ECHO_TTL_MS` | 10000 | Cuánto se recuerda un movimiento propio para no alertar su eco |
| `SESSION_REFRESH_LEAD_MS` | 60000 | Renovar el token 60 s antes de vencer |
| `MOCK_TOKEN_TTL_MS` / `MOCK_SHIFT_MS` | 15 min / 12 h | Solo el mock de ingreso |
| `CALL_COOLDOWN_MS` | 60000 | [P12] Enfriamiento de "Llamar al mozo" |

Sin variables de entorno nuevas: el vencimiento se prueba con las ayudas de demo (§7.4).

---

## 3. Arquitectura de componentes

```
<PanelApp>                                 html.classList.add('panel') (escala tipográfica ≥ 1600 px)
 └─ <PanelServicesProvider services={createPanelServices()}>
     └─ <I18nProvider>                     mismo idioma recordado que la carta (restaurante.lang)
         └─ <MotionConfig reducedMotion="user">
             └─ <LiveRegionProvider>       región cortés única (altas e informativas)
                 └─ <SoundProvider>        arriba del ingreso: "Ingresar" desbloquea el audio (RF3)
                     └─ <AuthGate>
                          ├─ restoring  → <PanelSplash/>
                          ├─ signedOut  → <LoginScreen>  (palabras escalonadas + <LoginForm/>)
                          └─ signedIn | expired →
                              <StationProvider>
                               └─ <StationGate>  sin estación → <StationPicker/>
                                   └─ <AlertsProvider station>          cola, sonido, anuncios
                                       └─ <BoardProvider station>       comandas, sincronización, movimientos
                                           └─ [<CallsProvider>]         [P12]
                                               └─ <PanelShell>
                                                    ├─ <PanelTopBar>
                                                    │    ├─ píldora marca: IconTile Fire + "Fogón" · "Cocina"
                                                    │    ├─ <StationSwitch/>          (≥ 768 px)
                                                    │    └─ <ConnectionPill/> · <SoundPill/> · <AccountMenu/>
                                                    ├─ <OfflineBanner/>
                                                    ├─ [<CallsStrip/>]                (Salón, P12)
                                                    ├─ <KpiStrip/>
                                                    ├─ <KanbanBoard>
                                                    │    ├─ <ColumnTabs/>             (< 768 px)
                                                    │    └─ <KanbanColumn> × n → <OrderTicket> × n
                                                    │                                   └─ <TicketLines/>, <PillAction/>, "Cancelar"
                                                    ├─ <CancelOrderDialog/>
                                                    ├─ <AlertStack/>
                                                    ├─ <AlertDialogHost/>
                                                    └─ <SessionExpiredDialog/>        (estado 'expired')
```

- **Por qué `SoundProvider` arriba del `AuthGate`:** el toque en "Ingresar" es un gesto del usuario; si el proveedor de sonido ya existe, `LoginForm` llama a `sound.unlock()` dentro de ese gesto y el navegador permite el audio sin el botón "Activar sonido" (RF3, RF42).
- **Por qué el tablero sigue montado con la sesión vencida:** RF7 pide mantenerlo visible y congelado; `BoardProvider` no se desmonta en `expired`, deja de recibir eventos (lo garantiza `withStaffAuth`) y se resincroniza al volver a `signedIn`.
- **Cerrar sesión** sí desmonta todo lo que está debajo de `AuthGate` (RF8): comandas, cola de alertas y suscripciones desaparecen de memoria.

---

## 4. Manejo de estado: qué vive dónde y por qué

| Estado | Dónde vive | Persistencia | Por qué |
|---|---|---|---|
| Sesión (`AuthState`: restoring, signedOut, signedIn, expired) | `AuthService` (fuente) reflejado en `AuthProvider` | Real: cookie `httpOnly` del backend (P3); mock: `sessionStorage['restaurante.mock.staffSession']` | La interfaz solo conoce usuario y vencimiento; el token nunca entra a React (RNF6). |
| Token de acceso | Dentro de `AuthService` (memoria) | Ninguna (P3-A) | Solo lo leen el decorador y el futuro adaptador. |
| Estación | `StationProvider` | `localStorage['restaurante.panel.station']` vía `safeStorage` | Es del dispositivo (RF10); sobrevive a cerrar sesión (RF8). |
| Silencio | `SoundProvider` | `localStorage['restaurante.panel.muted']` | Preferencia del dispositivo (RF45). |
| Estado del audio (locked, ready, unsupported) | `SoundPlayer` | Ninguna | Depende del gesto de cada carga de página. |
| Comandas del tablero | `BoardProvider`: `Map<id, BoardEntry>` | Ninguna (fuente: servicio) | Se reconstruye en cada carga; cerrar sesión lo borra (RF8). |
| Movimientos en curso | `BoardProvider`: `pendingMoves: Record<id, { from, to }>` | Ninguna | Capa optimista sobre el dato del servidor (RF23). |
| Ecos propios | `BoardProvider`: `selfMoves: Map<"id:status", expiresAt>` | Ninguna | Para no alertar lo que hizo este dispositivo (RF40). |
| `lastSeen` (mayor `updatedAt`) y hora de última actualización | `BoardProvider` | Ninguna | `since` de la resincronización (RF52) y "desactualizado" (RF50). |
| Demoras ya alertadas | `BoardProvider`: `Set<id>` | Ninguna | Una sola alerta por comanda y dispositivo (RF48). |
| Cola de alertas | `AlertsProvider`: `useReducer(alertQueueReducer)` | Ninguna | Reglas puras testeables; RF36-RF40. |
| Estado de conexión | `RealtimeStatusService` | Ninguna | Las pantallas no saben de sockets (RNF8). |
| Columna visible en celular, menú abierto, modal de cancelación | `useState` local | Ninguna | Estado de interfaz aislado. |
| [P12] Llamadas abiertas | `CallsProvider` | Ninguna (fuente: servicio) | Igual que las comandas. |
| [P12] Enfriamiento de "Llamar al mozo" | `useCallWaiter` | `sessionStorage['restaurante.callCooldown.table-{id}']` | Que recargar no permita repetir el aviso (RF54). |

---

## 5. Flujo de datos

### 5.1 Ingreso y restauración (RF1-RF6) — CRÍTICO
```
PanelApp monta → AuthProvider: authService.restore()       (estado 'restoring' → <PanelSplash/>)
  ├─ sesión vigente → 'signedIn'                            (RF6; real: POST /api/auth/refresh con la cookie)
  └─ nada / vencida → 'signedOut' → <LoginScreen/>
LoginForm submit (gesto):
  sound.unlock()                                            ← dentro del gesto (RF3)
  if submitting → return                                    (RF5)
  authService.login(email, password)
    ├─ ok → 'signedIn' → StationGate (estación recordada o <StationPicker/>)      (RF3, RF10)
    ├─ INVALID_CREDENTIALS → "Correo o contraseña incorrectos"; password = ''; foco en contraseña   (RF4)
    ├─ RATE_LIMITED → "Demasiados intentos. Probá de nuevo en {n} s" (details.retryAfterSec); botón deshabilitado hasta vencer
    └─ NETWORK / SERVER → "No pudimos conectar. Revisá la conexión." + el mismo botón reintenta
```
Formulario: `<form>` con `<label>` visibles, `type="email" autocomplete="username" inputmode="email"` y `type="password" autocomplete="current-password"`, botón "Mostrar contraseña" (`aria-pressed`), sin bloquear pegar (WCAG 3.3.8). Error asociado con `aria-describedby` y anunciado (RF4). En DEV, una nota "Modo demostración: demo@fogon.test / fogon".

### 5.2 Renovación, vencimiento y 401 (RF7, RF9) — CRÍTICO
```
authService.getAccessToken():
  needsRefresh(expiresAt, now)  (vence en < 60 s) → renovar (una sola renovación en vuelo, las demás la esperan)
     ├─ ok → token nuevo
     └─ falla (401 / turno terminado / revocada) → estado 'expired' → devuelve null
withStaffAuth (operaciones del personal):
  token = await getAccessToken(); null → throw ServiceError('UNAUTHORIZED')
  error UNAUTHORIZED del servidor → await authService.handleUnauthorized() (renueva una vez) → relanza (NO reintenta el PATCH, RF9)
AuthState 'expired':
  - withStaffAuth deja de entregar eventos 'staff'
  - BoardProvider: acciones deshabilitadas; tablero atenuado (opacity .55 + "Desactualizado · 21:04")
  - <SessionExpiredDialog> (alertdialog, no se cierra con Escape) con <LoginForm/>; muestra el correo del usuario
  - reingreso ok → 'signedIn' → BoardProvider.resync('auth') ; si es OTRO usuario/restaurante → BoardProvider se
    vuelve a montar (key = user.id + restaurant.slug) y la cola de alertas se vacía (CL9)
Cerrar sesión (RF8): Dialog de confirmación ("Tenés 2 alertas sin confirmar" si las hay) → authService.logout()
  (si falla la red, limpia igual lo local) → 'signedOut' → se desmonta todo debajo de AuthGate.
```

### 5.3 Carga del tablero y tiempo real (RF13-RF15, RF49, RF53, RNF8)
```
BoardProvider (key = sesión):
  1. unsubscribe = orderService.subscribe(onEvent, { kind: 'staff' })      ← PRIMERO, con buffer (igual que MyOrdersProvider)
  2. list = await orderService.listOrders({ statuses: ACTIVE_STATUSES })   loading → ready | error ("Reintentar")
  3. entries = upsert(list); lastSeen = max(updatedAt); delayAlerted = { ids ya demorados }   (sin alertas, RF53)
  4. los eventos del buffer se aplican como origen 'resync' (solo críticas individuales + resumen)
  5. en vivo: onEvent(e)
onEvent(e) → applyChange(e.order, origin):
  prev = entries.get(id)
  merged = mergeOrder(prev?.order, e.order); merged === prev?.order → ignorar (viejo o igual)    (CL26)
  origin = selfMoves vigente para `${id}:${status}` ? 'self' : 'live'
  status final:
    delivered → quitar del tablero
    cancelled → si alertRules.needsCancelAck(prev.status, station) → entry.cancelAck = 'pending' (sello)   (RF35, P10)
                si no → quitar
    otro → upsert
  alerts.push(alertsForChange({ type, order: merged, previous: prev?.order.status }, { station, origin }))
  alerts.prune(item => sigueVigente(item, entries))                                                         (RF40)
```
`BoardEntry = { order: Order; cancelAck?: 'pending' }`. Estado mostrado de una tarjeta = `pendingMoves[id]?.to ?? order.status`.

### 5.4 Cambio de estado (RF23-RF31)
```
move(id, to):
  if pendingMoves[id] → return                                             (RF30, CL12)
  from = entries.get(id).order.status
  pendingMoves[id] = { from, to }; selfMoves.set(`${id}:${to}`, now + SELF_ECHO_TTL_MS)   ← antes de llamar (el mock emite el eco en la misma pestaña)
  try   order = await orderService.updateOrderStatus(id, to, from)
        applyChange(order, 'self')                                          (noop del servidor = mismo pedido, RF27)
        [P9] si to ∈ {accepted, preparing, ready} → alerts.push({ kind: 'move.undo', priority: 'info', ttl: UNDO_MS,
             action: () => move(id, from) })                               (RF31)
  catch ServiceError:
        STATUS_CONFLICT     → applyChange(details.order, 'live'); alerta 'move.conflict'      (RF26, CL11)
        INVALID_TRANSITION  → getOrders([id]) → applyChange o quitar; alerta 'move.invalid'   (RF28, CL27)
        UNAUTHORIZED        → alerta 'move.failed' motivo 'session'; sin reintento            (RF9, CL8)
        NETWORK / SERVER    → alerta 'move.failed' con "Reintentar" → move(id, to) si el estado sigue siendo `from` (RF29)
  finally delete pendingMoves[id]
cancel(id): CancelOrderDialog abierto con la comanda → "Cancelar pedido" → move(id, 'cancelled')
  si mientras está abierto la comanda pasa a final → el modal se cierra con alerta 'order.noLongerActive' (CL27)
```
La animación entre columnas ocurre al cambiar el estado mostrado (optimista); si se revierte, vuelve con la misma transición.

### 5.5 Alertas (RF32-RF41)
```
evento del tablero ─► alertRules.alertsForChange / alertsForResync / alertForDelay  (puro)  ─► AlertDraft[]
AlertsProvider.push(drafts):
  dispatch({ type: 'push', draft, now })        alertQueue: dedupe por `key`; ráfaga: ≥ 3 'order.new' en 3 s → una 'order.newBurst' con count
  por cada alerta aceptada:
    priority ≥ high && draft.sound → sound.play(cue)          (SoundPlayer respeta SOUND_MIN_GAP_MS y el silencio)
    priority ≠ critical → announce(alertText(draft, t))      (LiveRegion cortés, RF38)
    priority = critical → AlertDialogHost (role="alertdialog": el lector la anuncia al recibir el foco)
crítica actual: setInterval(CRITICAL_REPEAT_MS) → sound.play(cue) hasta CRITICAL_REPEAT_MAX o 'ack'                  (RF44)
"Entendido" → dispatch ack → BoardProvider.acknowledgeCancel(orderId) (saca la tarjeta sellada)                     (RF35)
"Ver" → BoardProvider.focusOrder(id): cambia de columna en celular, scrollIntoView({ block: 'nearest' }), foco y resaltado 1,2 s (RF39)
cambio de estación → dispatch({ type: 'stationChanged', station })                                                  (RF11)
título: useTitleBadge(titleCount(entries, station), station)                                                         (RF41)
```
Pausa de los temporizadores: cada aviso de la pila lleva su propio temporizador que se pausa con puntero, foco y `document.hidden` (skill `emil-design-eng`: "pause toast timers when the tab is hidden").

### 5.6 Sonido (RF42-RF46)
```
SoundProvider:
  player = createWebAudioPlayer()            sin AudioContext → 'unsupported' (RF46)
  primer pointerdown/keydown en el documento (captura, una vez) → player.unlock()   ← cualquier toque desbloquea
  "Activar sonido" (SoundPill) → player.unlock(); si sigue 'locked' → "El navegador bloqueó el sonido. Tocá de nuevo."
  AudioContext 'statechange' → 'suspended' (iOS al bloquear la tablet) → 'locked' → vuelve a aparecer el botón
  muted (localStorage) → play() no suena; SoundPill muestra "Silenciado"
```

### 5.7 Demora (RF47-RF48)
`now = useNow(NOW_TICK_MS) + realtime.serverOffsetMs()`. En cada tic, `BoardProvider` recorre las `pending`: `isDelayed(order, now)` y no está en `delayAlerted` → `alerts.push(alertForDelay(order, station))` y se agrega al set. La tarjeta y `boardCounts` usan la misma función, así la marca aparece sin recargar (CL28). Con 15 s de tic, la marca aparece a más tardar 15 s después de cumplirse el plazo.

### 5.8 Conexión y resincronización (RF50-RF52)
```
realtime.subscribe(status):
  'live' → ConnectionPill "En vivo"; si antes no lo estaba → BoardProvider.resync('reconnect')
  'connecting' | 'offline' → "Reconectando…" / "Sin conexión" + "Actualizado 21:04"; tablero con marca "Desactualizado"
  no-live ≥ OFFLINE_ESCALATE_MS → <OfflineBanner/> + sound.play('connection') una vez por corte
visibilitychange (visible) → resync('foreground')
resync(reason):
  since = lastSeen − RESYNC_OVERLAP_MS → listOrders({ since })  (todos los estados, también finales)
  changes = cada pedido devuelto vs entries → applyChange(…, 'resync')
  alerts.push(alertsForResync(changes, station))   → 'sync.summary' ("Llegaron 3 pedidos…") + críticas individuales
```
En el mock, `realtime` nace de `online`/`offline` del navegador y de `window.__demo.setConnection()`; `serverOffsetMs()` = 0. En el adaptador real, sale del estado del WebSocket y del `ts` de `system.welcome`.

### 5.9 [P12] Llamar al mozo (RF54-RF58)
```
Cliente: CallWaiterButton (mesa válida) → useCallWaiter.call() → tableService.callWaiter(tableId)
  ok → "Avisamos al mozo" (anunciado) + enfriamiento 60 s persistido por mesa       error → mensaje + "Reintentar" (RF58)
Mock: una llamada abierta por mesa (si existe, actualiza `at`); emite table.waiter_called por BroadcastChannel
Salón: CallsProvider = subscribe primero + listOpenCalls(); table.waiter_called → alerta alta 'table.call' (sonido 'call')
  "Atendida" → resolveCall(callId) → table.call_resolved → se quita en todos los dispositivos (RF56)
```

### 5.10 Idioma (RF59-RF60)
`I18nProvider` compartido con la carta; selector ES | EN dentro de `AccountMenu`. Las alertas guardan clave + variables (`AlertDraft.vars`) y se traducen al dibujarse, así cambian de idioma solas (RF60, CL44). Nombres de platos con `localize()`.

---

## 6. Dominio nuevo (puro, sin React ni DOM)

```ts
// src/domain/board.ts
export type Station = 'kitchen' | 'floor'
export type ColumnId = 'new' | 'accepted' | 'preparing' | 'ready' | 'inKitchen'
export interface ColumnDef { id: ColumnId; statuses: readonly OrderStatus[]; compact: boolean }
export const ACTIVE_STATUSES: readonly OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready']
export const STATION_COLUMNS: Record<Station, readonly ColumnDef[]> = {
  kitchen: [new(pending), accepted, preparing, ready],                // compact: false
  floor:   [ready, inKitchen(pending|accepted|preparing, compact: true)],
}
export function columnFor(status: OrderStatus, station: Station): ColumnId | null
export function enteredStatusAt(order: Order): string                // última entrada de statusHistory con el estado actual; respaldo updatedAt
export function groupBoard<T extends { order: Order }>(entries: T[], station: Station, statusOf?: (e: T) => OrderStatus): Record<ColumnId, T[]>
                                                                       // orden: createdAt asc; en 'ready', enteredStatusAt asc (RF17)
export interface PrimaryAction { to: OrderStatus; label: 'confirm' | 'start' | 'ready' | 'deliver'; emphasis: 'primary' | 'secondary' }
export function primaryAction(status: OrderStatus, station: Station): PrimaryAction | null
                                                                       // kitchen: pending→confirm, accepted→start, preparing→ready, ready→deliver(secondary)
                                                                       // floor:   ready→deliver; resto → null (P7)
export function elapsedMinutes(fromIso: string, nowMs: number): number   // floor, nunca negativo (CL29)
export function boardCounts(orders: Order[], station: Station, nowMs: number):
  { new: number; inProgress: number; ready: number; inKitchen: number; delayed: number }
export function titleCount(orders: Order[], station: Station): number    // kitchen: pending; floor: ready (RF41)

// src/domain/alertRules.ts
export type AlertPriority = 'critical' | 'high' | 'info'
export type SoundCue = 'new' | 'ready' | 'cancelled' | 'delayed' | 'call' | 'connection'
export type AlertKind =
  | 'order.new' | 'order.newBurst' | 'order.ready' | 'order.cancelled' | 'order.delayed' | 'order.steppedBack'
  | 'order.noLongerActive' | 'move.conflict' | 'move.invalid' | 'move.failed' | 'move.undo'
  | 'sync.summary' | 'table.call'
export type ChangeOrigin = 'live' | 'resync' | 'self'
export type BoardChange =
  | { type: 'created'; order: Order }
  | { type: 'status'; order: Order; previous: OrderStatus }
export interface AlertDraft {
  key: string                       // dedupe: p. ej. 'order.new:<id>', 'order.cancelled:<id>'
  kind: AlertKind; priority: AlertPriority; sound?: SoundCue
  orderId?: string
  vars: Record<string, string | number>   // code, table, count, status, previous…
  validWhile?: { orderId: string; status: OrderStatus }   // obsoleta si la comanda ya no está en ese estado (RF40)
  ttlMs?: number                    // por defecto según prioridad
}
export function alertsForChange(change: BoardChange, ctx: { station: Station; origin: ChangeOrigin }): AlertDraft[]  // tabla spec §3.4; 'self' → []
export function alertsForResync(changes: BoardChange[], station: Station): AlertDraft[]  // resumen + críticas individuales (RF52)
export function alertForDelay(order: Order, station: Station): AlertDraft                 // alta en cocina, info en salón (RF48)
export function needsCancelAck(previous: OrderStatus, station: Station): boolean           // kitchen: accepted|preparing; floor: ready (RF35)
export function isStepBack(previous: OrderStatus, next: OrderStatus): boolean

// src/domain/alertQueue.ts
export interface AlertItem extends AlertDraft { id: number; at: number; count?: number }
export interface AlertQueueState { critical: AlertItem[]; stack: AlertItem[]; nextId: number; recentNew: number[] }
export type AlertQueueAction =
  | { type: 'push'; draft: AlertDraft; now: number }
  | { type: 'dismiss'; id: number } | { type: 'ack'; id: number }
  | { type: 'prune'; isValid: (item: AlertItem) => boolean }
  | { type: 'stationChanged'; station: Station; keep: (item: AlertItem) => boolean }
  | { type: 'clear' }
export function alertQueueReducer(state: AlertQueueState, action: AlertQueueAction): AlertQueueState
export function selectVisible(state: AlertQueueState, max = MAX_VISIBLE_ALERTS):
  { current?: AlertItem; criticalPosition: { index: number; total: number }; visible: AlertItem[]; hiddenCount: number }
// reglas: misma key → no duplica (actualiza `at`); críticas FIFO; pila: la más nueva arriba;
// ráfaga: al llegar la BURST_MIN-ésima 'order.new' dentro de BURST_WINDOW_MS, las 'order.new' de la ventana se
// reemplazan por una 'order.newBurst' con count (y las siguientes de la ventana suman al count, sin sonido nuevo).

// src/domain/session.ts
export function needsRefresh(expiresAtIso: string, nowMs: number, leadMs = SESSION_REFRESH_LEAD_MS): boolean
export function isExpired(expiresAtIso: string, nowMs: number): boolean

// src/domain/orderStatus.ts  [P9]
export function previousStep(status: OrderStatus): OrderStatus | null      // accepted→pending, preparing→accepted, ready→preparing
canTransition(from, to, opts?: { allowStepBack?: boolean })               // por defecto false: la 001 no cambia
applyTransition(order, to, expectedStatus, nowIso, opts?)                 // pasa opts a canTransition
```

---

## 7. Capa de servicios

### 7.1 Contratos nuevos (`src/services/contracts.ts`)
```ts
export type ServiceErrorCode = /* los de la 001 */ | 'UNAUTHORIZED' | 'INVALID_CREDENTIALS' | 'RATE_LIMITED'
// ServiceErrorDetails + { retryAfterSec?: number }   // RATE_LIMITED

export interface StaffUser { id: string; name: string; email: string; restaurant: { slug: string; name: string } }
export interface StaffSession { user: StaffUser; expiresAt: string }            // SIN token: la interfaz no lo ve
export type AuthState =
  | { status: 'restoring' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: StaffSession }
  | { status: 'expired'; user: StaffUser }

export interface AuthService {
  getState(): AuthState
  subscribe(listener: (state: AuthState) => void): () => void
  /** Al abrir el panel: renueva con lo que haya (cookie de renovación en el real). */
  restore(): Promise<AuthState>
  /** INVALID_CREDENTIALS | RATE_LIMITED | NETWORK | SERVER */
  login(email: string, password: string): Promise<StaffSession>
  /** Siempre limpia lo local, aunque falle la red. */
  logout(): Promise<void>
  /** SOLO para adaptadores y `withStaffAuth`. Renueva si vence en < 60 s; null si la sesión no es renovable ('expired'). */
  getAccessToken(): Promise<string | null>
  /** El servidor respondió 401: intenta renovar una vez; false → 'expired'. */
  handleUnauthorized(): Promise<boolean>
}

export type RealtimeStatus = 'live' | 'connecting' | 'offline'
export interface RealtimeStatusService {
  getStatus(): RealtimeStatus
  subscribe(listener: (status: RealtimeStatus) => void): () => void
  /** hora del servidor − hora local, en ms (0 si no se conoce). CL29 */
  serverOffsetMs(): number
}

// [P12] reemplaza el bloque comentado "Extensión reservada" de la 001
export interface WaiterCall { callId: string; tableId: number; at: string }
export type TableEvent =
  | { type: 'table.waiter_called'; callId: string; tableId: number; at: string }
  | { type: 'table.call_resolved'; callId: string; tableId: number; at: string }
export interface TableService {
  callWaiter(tableId: number): Promise<WaiterCall>        // si la mesa ya tiene una abierta, devuelve esa con `at` actualizado
  listOpenCalls(): Promise<WaiterCall[]>                  // personal
  resolveCall(callId: string): Promise<WaiterCall>        // personal
  subscribe(listener: (event: TableEvent) => void, filter: SubscriptionFilter): () => void
}

export interface Services { menuService: MenuService; orderService: OrderService; tableService?: TableService }  // [P12] opcional
export interface PanelServices {
  orderService: OrderService            // ya envuelto con withStaffAuth
  authService: AuthService
  realtime: RealtimeStatusService
  tableService?: TableService           // [P12]
}
```
`OrderEvent` y `OrderService` **no cambian**: el panel usa `listOrders`, `updateOrderStatus`, `getOrders` y `subscribe({ kind: 'staff' })` tal como los dejó la 001.

### 7.2 `withStaffAuth(orderService, authService): OrderService`
- `updateOrderStatus` y `listOrders` sin `tableIds`: piden `getAccessToken()`; `null` → `UNAUTHORIZED` sin llamar al servicio. Si el servicio responde `UNAUTHORIZED` → `handleUnauthorized()` y relanza (sin reintentar, RF9).
- `subscribe(listener, { kind: 'staff' })`: entrega eventos solo mientras `authService.getState().status === 'signedIn'` (R8.4 del backend replicado en el cliente).
- `createOrder`, `findByClientRequestId`, `getOrders` y `subscribe` por mesas pasan sin tocar (son del cliente).
- Con el backend real, el adaptador HTTP agrega `Authorization: Bearer` y traduce 401; el decorador se mantiene como defensa en profundidad: ninguna operación del personal sale sin sesión.

### 7.3 Mocks
- **`createMockAuthService({ storage, now, latencyMs, users, tokenTtlMs, shiftMs })`:** `login` compara con `staffUsers.ts` (`demo@fogon.test` / `fogon`, restaurante `{ slug: API_CONFIG.restaurantSlug, name: 'Fogón' }`); 5 fallos en 60 s → `RATE_LIMITED` con `retryAfterSec`. Guarda `{ user, token, expiresAt, shiftEndsAt }` en `sessionStorage['restaurante.mock.staffSession']` **solo como simulación de la cookie `httpOnly`** (el adaptador real no guarda el token en almacenamiento, P3). `restore()` renueva si `shiftEndsAt` no pasó. `getAccessToken()` renueva si `needsRefresh`; si el turno terminó o la sesión fue revocada → `expired`.
- **`createMockRealtimeStatus({ target })`:** `online`/`offline` del navegador; `force(status | null)` para la demo.
- **[P12] `createMockTableService({ storage, channelFactory, now, newId })`:** `localStorage['restaurante.mock.calls']`, `BroadcastChannel('restaurante.tables')`, una llamada abierta por mesa, valida mesa 1-20 → `INVALID_TABLE`.
- **[P9] `mockOrderService.updateOrderStatus`:** usa `applyTransition(…, { allowStepBack: true })`, igual que el backend (D-060). La interfaz solo lo usa dentro del "Deshacer" de 5 s.
- **`mockOrderService.cancelByCustomer(id, clientRequestId)` (solo mock, P11):** simula R6 del backend: solo en `pending` (si no, `INVALID_TRANSITION`); `clientRequestId` distinto → `NOT_FOUND`; agrega `{ status: 'cancelled', at, by: 'customer' }` y emite `order.status_changed`. No entra en el contrato `OrderService`: el botón del cliente es de una spec posterior. Las entradas que agrega el personal no llevan `by`, así los tests de la 001 no cambian.
- **El mock no valida `restaurant`** (K3): siempre es el restaurante de `API_CONFIG`.
- `createPanelServices()` en `services/index.ts`: reutiliza la instancia de `buildMockServices` (mismo storage y canal que la carta), envuelve el `orderService` y arma auth, realtime y tables. Una instancia por página.

### 7.4 Ayudas de demo (solo DEV)
| Ayuda | Para probar |
|---|---|
| `window.__demo.expireToken()` | Renovación silenciosa (CL6) |
| `window.__demo.revokeSession()` | Sesión vencida no renovable (CL7, CL8) |
| `window.__demo.setConnection('offline' \| 'connecting' \| 'live' \| null)` | Indicador, banner de 30 s y resincronización (CL24, CL25) |
| `window.__demo.cancelAsCustomer('K7F2')` | Cancelación del cliente en `pending` con "Cancelado por el cliente" (CL16) |
| `window.__demo.callWaiter(12)` [P12] | Llamada de mesa sin abrir la carta |
| Las de la 001 (`setStatus`, `advance`, `list`, `reset`…) | Cambios "desde otro dispositivo", cancelaciones en curso (CL14, CL15) |

### 7.5 Cambios propuestos al contrato del backend (revisar con el compañero)
Se suman al contrato del 17/10 (plan 001 §7.3-§7.4) y responden a la spec §10.

**C1. Endpoints de ingreso (P2).**
| Método | Ruta | Entrada | Respuestas |
|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` | 200 `{ accessToken, expiresAt, user: StaffUser }` + `Set-Cookie: refresh=…; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age ≤ 12 h` · 401 `INVALID_CREDENTIALS` (mismo mensaje para correo o contraseña) · 429 `RATE_LIMITED` (`details.retryAfterSec` + `Retry-After`) · 400 `VALIDATION` |
| POST | `/api/auth/refresh` | cookie | 200 igual que login (rota la cookie) · 401 `UNAUTHORIZED` |
| POST | `/api/auth/logout` | cookie | 204; revoca la renovación y borra la cookie |
| GET | `/api/auth/me` | `Authorization: Bearer` | 200 `StaffUser` · 401 |
Token de acceso: JWT corto (15 min) con `sub`, `restaurant` (slug) y `exp`. El backend (Node.js + Express, P1) implementa estas rutas envolviendo Supabase Auth; el frontend no usa el SDK de Supabase (P2). El token vive solo en memoria y se renueva con la cookie (P3).

**C2. Rutas que exigen token del personal.**
| Requiere token | Pública |
|---|---|
| `PATCH /api/orders/{id}/status` · `GET /api/orders` sin `ids`/`tableId`/`clientRequestId` (re-sync del panel) · WS `/ws/orders?scope=staff` · `GET /api/auth/me` · [P12] `GET /api/tables/calls`, `POST /api/tables/calls/{callId}/resolve` | `GET /api/menu` · `GET /api/tables/{id}` · `POST /api/orders` · `GET /api/orders` con `ids`, `tableId` o `clientRequestId` · WS `/ws/orders?tableId=…` · [P12] `POST /api/tables/{tableId}/calls` |
Coincide con R8.1-R8.3 y R10.3-R10.4 del backend.

**C3. Códigos de error nuevos:** `UNAUTHORIZED` (401: falta, venció o es inválido), `INVALID_CREDENTIALS` (401, solo en login), `RATE_LIMITED` (429). Un pedido de otro restaurante sigue siendo 404 `NOT_FOUND` (R5.9).

**C4. Token en el WebSocket (P4):** primer mensaje `system.auth` (detalle en §7.6) y cierres nuevos 4401 / 4403.

**C5. Quién hizo cada cambio:** `statusHistory[]` suma `by?: 'staff' | 'customer'` (opcional, aditivo). Con la cancelación del cliente aceptada (P11, K5), permite mostrar "Cancelado por el cliente" (CL16). El frontend tolera que falte. La ruta de cancelación del cliente (R6) la define el backend; el panel solo recibe `order.status_changed` a `cancelled`.

**C6. Restaurante en cada llamada (K3, decidido 2026-10-20):** el frontend acepta enviar `restaurant=<slug>` como exige el backend: en los GET (`?restaurant=fogon`), en el WebSocket (`/ws/orders?…&restaurant=fogon`) y en el cuerpo de `POST /api/orders` y de `POST /api/tables/{tableId}/calls`. El slug sale de **una única configuración de la capa de servicios** (`src/services/apiConfig.ts`, `API_CONFIG.restaurantSlug = 'fogon'`); las pantallas nunca lo ven ni lo arman, y el mock no lo valida. En las rutas y el WebSocket del personal, el backend comprueba que coincida con el restaurante del token → 403 / cierre 4403 (P20: el restaurante que se muestra sale de la sesión).
**Impacto en lo que dejó la 001:** el contrato de plan 001 §7.3-§7.4 suma el parámetro `restaurant` en todas las rutas y en el WebSocket por mesas; el adaptador HTTP futuro (`services/http/`) lo agrega en cada llamada leyendo `API_CONFIG`; los tipos del dominio (`CreateOrderInput`, `Order`) **no cambian** (el adaptador inyecta el campo); el QR sigue siendo `?mesa=12` (un restaurante por despliegue; un QR con restaurante queda para cuando haya más de un local).

**C7. Hora del servidor:** el panel estima la diferencia de reloj con el `ts` de `system.welcome` y la cabecera `Date` (CL29). No requiere cambios, solo que `ts` sea la hora del servidor en UTC.

**C8. [P12] Llamadas de mesa.**
| Dirección | Mensaje / ruta | Contenido |
|---|---|---|
| Cliente → servidor | `POST /api/tables/{tableId}/calls` (en lugar del mensaje WS reservado: el cliente necesita respuesta y reintento, RF58) | 201/200 `WaiterCall`; una abierta por mesa; 429 si repite antes de 60 s; 404 mesa inexistente |
| Servidor → personal | WS `table.waiter_called` | `{ callId, tableId, at }` |
| Servidor → personal | WS `table.call_resolved` (nuevo) | `{ callId, tableId, at }` |
| Personal | `GET /api/tables/calls?status=open` | `WaiterCall[]` (re-sync) |
| Personal | `POST /api/tables/calls/{callId}/resolve` | 200 `WaiterCall` |
`table.call_waiter` por WebSocket queda reservado (se puede retirar).

**C9. Retroceso (P9, K4):** sin cambios: el backend lo conserva como respaldo de la API; la interfaz lo usa solo dentro del "Deshacer" de 5 s.

**C10. Mesa inválida (K7):** `POST /api/orders` con mesa inexistente o inactiva responde **404** con código `INVALID_TABLE` (el usuario se lo pide al backend). Afecta al adaptador de la 001, no al panel.

**Fuera del contrato del frontend (K10):** el límite de 20 pedidos por minuto por IP lo desactiva o lo sube el backend (acción del usuario con Uriel).

### 7.6 Protocolo de autenticación del WebSocket del personal (P4-A)
```
Cliente                                                     Servidor
open wss://<host>/ws/orders?scope=staff&restaurant=fogon      (slug de API_CONFIG, C6)
→ { v:1, id, type:'system.auth', ts, payload:{ token } }    (dentro de 5 s; antes de eso, cualquier otro mensaje → cierre 4401)
                                                            valida firma, exp y restaurante
← system.welcome { connectionId, heartbeatSec, subscription:{ scope:'staff', restaurant }, tokenExpiresAt }
   … eventos, ping/pong y re-sync REST como en el plan 001 §7.4 …
(60 s antes de tokenExpiresAt) → system.auth { token renovado }
← system.auth_ok { tokenExpiresAt }
token vencido sin renovar → cierre 4401                    token válido de otro restaurante → cierre 4403
```
| Cierre | Significado | El frontend |
|---|---|---|
| 4401 | No autorizado (sin token, inválido, vencido) | `handleUnauthorized()`: si renueva, reconecta enseguida (una vez seguida); si no, estado `expired` y sin reintentos |
| 4403 | Prohibido (otro restaurante) | Sin reintento; `expired` con mensaje |
El resto de los cierres y el backoff no cambian (plan 001 §7.4). El token nunca va en la URL. *Alternativa (P4-B):* `POST /api/ws-ticket` con Bearer → `{ ticket, expiresInSec: 30 }` de un solo uso en `?ticket=`; en ese caso la renovación con la conexión abierta exige reconectar.

---

## 8. Idiomas (i18n)

Claves nuevas en `es.ts` / `en.ts` con prefijo `panel.` (el test de claves de la 001 cubre que estén en ambos). Principales:

| Clave | ES | EN |
|---|---|---|
| panel.title | {station} · {brand} | {station} · {brand} |
| panel.station.kitchen / floor | Cocina / Salón | Kitchen / Floor |
| panel.station.choose | ¿Dónde vas a trabajar? | Where are you working? |
| panel.login.email / password | Correo / Contraseña | Email / Password |
| panel.login.submit / submitting | Ingresar / Ingresando | Sign in / Signing in |
| panel.login.showPassword | Mostrar contraseña | Show password |
| panel.login.invalid | Correo o contraseña incorrectos. | Incorrect email or password. |
| panel.login.rateLimited | Demasiados intentos. Probá de nuevo en {seconds} s. | Too many attempts. Try again in {seconds} s. |
| panel.login.network | No pudimos conectar. Revisá la conexión. | We couldn't connect. Check your connection. |
| panel.login.demo | Modo demostración: {email} / {password} | Demo mode: {email} / {password} |
| panel.session.expired | Tu sesión venció | Your session expired |
| panel.session.expiredBody | Volvé a ingresar para seguir recibiendo pedidos. | Sign in again to keep receiving orders. |
| panel.logout / logoutConfirm | Cerrar sesión / ¿Cerrar sesión en este dispositivo? | Sign out / Sign out on this device? |
| panel.logout.pending_one / _other | Hay 1 alerta sin confirmar. / Hay {count} alertas sin confirmar. | There is 1 unconfirmed alert. / There are {count} unconfirmed alerts. |
| panel.column.new / accepted / preparing / ready / readyFloor / inKitchen | Nuevas / Confirmadas / En preparación / Listas / Listas para servir / En cocina | New / Confirmed / Preparing / Ready / Ready to serve / In the kitchen |
| panel.column.empty | Nada por acá | Nothing here |
| panel.board.empty | Sin comandas activas. Actualizado {time}. | No active orders. Updated {time}. |
| panel.board.error / offline | No pudimos cargar las comandas. / Estás sin conexión. | We couldn't load orders. / You're offline. |
| panel.kpi.new / inProgress / ready / delayed / inKitchen / calls | Nuevas / En preparación / Listas / Demoradas / En cocina / Llamadas | New / Preparing / Ready / Delayed / In the kitchen / Calls |
| panel.ticket.table | Mesa {n} | Table {n} |
| panel.ticket.elapsed | hace {min} min | {min} min ago |
| panel.ticket.inStatus | {status} hace {min} min | {status} for {min} min |
| panel.ticket.delayed | Demorada · {min} min | Delayed · {min} min |
| panel.ticket.note / orderNote | Nota / Nota del pedido | Note / Order note |
| panel.ticket.saving | Guardando | Saving |
| panel.action.confirm / start / ready / deliver / cancel / undo | Confirmar / Empezar / Listo / Entregar / Cancelar / Deshacer | Confirm / Start / Ready / Deliver / Cancel / Undo |
| panel.cancel.title / body / confirm / keep | Cancelar el pedido {code} / Mesa {table} · {status}. No se puede deshacer. / Cancelar pedido / Volver | Cancel order {code} / Table {table} · {status}. This can't be undone. / Cancel order / Go back |
| panel.ticket.cancelledStamp / cancelledBy | Cancelado / Cancelado por el cliente | Cancelled / Cancelled by the customer |
| panel.alert.new | Pedido nuevo · Mesa {table} · {code} · {count} platos | New order · Table {table} · {code} · {count} dishes |
| panel.alert.newBurst | {count} pedidos nuevos | {count} new orders |
| panel.alert.ready | Listo para servir · Mesa {table} · {code} | Ready to serve · Table {table} · {code} |
| panel.alert.cancelledCooking | Pedido {code} cancelado · Mesa {table} · Estaba {status}. No lo sigas preparando. | Order {code} cancelled · Table {table} · It was {status}. Stop preparing it. |
| panel.alert.cancelledReady | Pedido {code} cancelado · Mesa {table}. No lo lleves a la mesa. | Order {code} cancelled · Table {table}. Don't take it to the table. |
| panel.alert.cancelled | Pedido {code} cancelado · Mesa {table} | Order {code} cancelled · Table {table} |
| panel.alert.delayed | {code} lleva {min} min sin confirmar · Mesa {table} | {code} has waited {min} min unconfirmed · Table {table} |
| panel.alert.steppedBack | {code} volvió a {status} | {code} went back to {status} |
| panel.alert.conflict | Otro dispositivo ya pasó {code} a {status}. | Another device already moved {code} to {status}. |
| panel.alert.invalid / noLongerActive | {code} ya está {status}. / Esta comanda ya no está activa. | {code} is already {status}. / This order is no longer active. |
| panel.alert.failed / failedSession | No se guardó el cambio de {code}. / No se guardó: tu sesión venció. | {code} wasn't updated. / Not saved: your session expired. |
| panel.alert.syncSummary_one / _other | Llegó 1 pedido mientras estabas sin conexión. / Llegaron {count} pedidos mientras estabas sin conexión. | 1 order arrived while you were offline. / {count} orders arrived while you were offline. |
| panel.alert.call | Mesa {table} llama al mozo | Table {table} is calling a server |
| panel.alert.ack / view / more | Entendido / Ver / y {count} avisos más | Got it / View / and {count} more |
| panel.alert.position | {index} de {total} | {index} of {total} |
| panel.connection.live / connecting / offline / updated | En vivo / Reconectando… / Sin conexión / Actualizado {time} | Live / Reconnecting… / Offline / Updated {time} |
| panel.connection.banner | Sin conexión: los pedidos nuevos no están llegando. | Offline: new orders aren't coming in. |
| panel.sound.enable / on / muted / blocked / unsupported | Activar sonido / Sonido activado / Silenciado / El navegador bloqueó el sonido. Tocá de nuevo. / Sonido no disponible en este dispositivo | Turn on sound / Sound on / Muted / The browser blocked sound. Tap again. / Sound isn't available on this device |
| panel.calls.title / resolve / since | Llamadas / Atendida / hace {min} min | Calls / Done / {min} min ago |
| table.callWaiter / called / callError | Llamar al mozo / Avisamos al mozo / No pudimos avisar. Probá de nuevo. | Call a server / We let your server know / We couldn't send it. Try again. |

Sin rayas (—) en textos de interfaz; presupuesto de largo +30-40 % para el inglés (regla de la 001).

---

## 9. Lenguaje visual (adaptado de las referencias 2 y 3)

### 9.1 Qué se toma de cada referencia y cómo convive con "Fogón"
Las dos referencias son **landings**, no dashboards: se toma su lenguaje visual, no su estructura.

| Referencia | Se abstrae (concreto) | Adaptación al panel | Se ignora |
|---|---|---|---|
| **Ref 2 · Securify** | Barra de **tres píldoras flotantes** (`neutral-900/90` + blur, `rounded-full`): marca a la izquierda, navegación al centro (oculta en celular), CTA **blanco** a la derecha · **cifras gigantes** (`text-5xl font-medium tracking-tight`) con subrótulo chico `white/70` · **divisores diagonales** de 1 px (`w-24 bg-white/40 rotate-[±20deg]`, ocultos en celular) · tipografía con `letter-spacing: -0.04em; line-height: 0.95` · palabras gigantes escalonadas en posiciones asimétricas · degradado inferior hacia el fondo · paleta acromática y transiciones mínimas (solo hover) | `PanelTopBar`: marca + estación · `StationSwitch` · conexión, sonido y cuenta; el CTA blanco pasa a ser **"Activar sonido"** mientras el audio está bloqueado (lo único que el personal tiene que hacer sí o sí) · `KpiStrip` con cifras gigantes y divisores diagonales · `LoginScreen` con "COCINA" / "Y SALÓN" escalonadas · máscara degradada al pie de las columnas con desplazamiento · sobriedad: color solo para estado y acción | Video de fondo, logo SVG, textos y cifras de la ref, minúsculas en toda la interfaz, Readex Pro (P14) |
| **Ref 3 · CargoX** | Curvas `EXPO_OUT [0.16, 1, 0.3, 1]` y `EASE_OUT [0.25, 0.46, 0.45, 0.94]` · **overlay con `AnimatePresence`** que entra con `scale + opacity` y **ítems escalonados desde abajo** · titulares que **entran desde lados opuestos** (`x: ∓400`, stagger 0,13 s) · **CTA en píldora con un extremo circular y flecha que rota** (−135° → −90° en hover; hover `scale 1.08, y −2`; tap `0.97`) · **inputs en píldora** (`bg white/8` → `white/14` al enfocar, `scale 1.01`) · acento amarillo `#ffda00` sobre azul petróleo · Barlow Condensed 800 | **Modales críticos** con fondo atenuado, panel `scale .96 → 1` y contenido escalonado (40 ms) · **avisos** que entran desde el borde derecho y salen por el mismo lado · login con las palabras entrando desde lados opuestos (pero 40 px, no 400) · **`PillAction`**: píldora hueso con círculo oscuro y flecha que rota −45° → 0° (apunta a la columna siguiente) · inputs del ingreso en píldora · el amarillo de atención pasa a **`ember-400`** | Mockup de iPhone, mapa, íconos de transporte, flotación infinita, formulario de contacto, redes, amarillo y petróleo |

**Conflictos y cómo conviven (decididos el 2026-10-20, P13-P15):**
1. **Paleta (P15):** negro puro de la ref 2 y amarillo/petróleo de la ref 3 → carbón cálido de la 001 (`coal-950` ≈ negro) y **brasa** como único acento; el "blanco" de la ref 2 es `bone-50`.
2. **Tipografía (P14):** Readex Pro en minúsculas (ref 2) → Barlow / Barlow Condensed (la ref 3 ya usa Condensed 800). Se toma de la ref 2 el interletrado cerrado y el interlineado 0,9 **solo en cifras**; la interfaz sigue en sentence case y los códigos en mayúsculas.
3. **Vidrio:** la ref 2 lo usa en la barra; la skill `design-taste-frontend` lo desaconseja en dashboards → vidrio **solo en las píldoras de la barra** (máximo tres superficies con blur); columnas y tarjetas son sólidas.
4. **Movimiento:** los desplazamientos de 400 px de la ref 3 son de landing → 24-40 px; las acciones frecuentes (mover tarjetas, decenas de veces por turno) casi no animan (skills `animate` y `emil-design-eng`: frecuencia alta = movimiento mínimo).
5. **Acción principal (P13):** CTA blanco (ref 2) + píldora con flecha (ref 3) → **píldora hueso con flecha** en las tarjetas; el botón brasa (`GlowButton`) queda para "Ingresar" y "Reintentar".

### 9.2 Paleta y contraste
Se reutilizan todos los tokens de la 001 (plan 001 §9.2). Nuevos en `@theme`:

| Token | Valor | Uso |
|---|---|---|
| `--color-bone-200` | `#e6ddd2` | Hover de la píldora hueso (como `hover:bg-neutral-200` de la ref 2) |
| `--radius-column` | `20px` | Columnas del tablero |
| `--z-banner` | `32` | `OfflineBanner` |
| `--z-alerts` | `45` | `AlertStack` (los modales van en el top layer de `<dialog>`) |

Superficies: escenario `coal-950` (sin la luz de brasa del pie, para no ensuciar el tablero), columnas `coal-900`, tarjetas `coal-800` con borde hairline (la diferencia de superficie es 1,08:1, por eso el borde es obligatorio), píldoras de la barra `.glass`.

Contraste calculado (WCAG 2.1) de las combinaciones nuevas; las de la 001 siguen valiendo:

| Texto | Superficie | Contraste | Uso |
|---|---|---|---|
| `coal-950` | `bone-50` | 17,6 | Texto de `PillAction` y de "Activar sonido" |
| `coal-950` | `bone-200` | 14,7 | `PillAction` en hover |
| `bone-50` | nota (`ember-700` al 25 % sobre `coal-800` = `#3b2014`) | 13,3 | Notas de línea y del pedido |
| `ash-300` | nota | 6,4 | Rótulo "Nota" |
| `chili-400` | sello (`coal-950` al 75 % sobre `coal-800`) | 6,9 | "CANCELADO" |
| `chili-400` | tinte demora (`chili-400` al 12 % sobre `coal-800`) | 5,2 | Chip "Demorada" |
| `herb-400` | tinte listo (12 % sobre `coal-800`) | 7,4 | Chip y cifra "Listas" |
| `bone-50` / `ash-300` / `ash-500` | `coal-800` (tarjeta) | 15,4 / 7,4 / 5,5 | Principal (≥ 7:1, RNF2) / secundario / terciario |
| `ash-500` | `coal-700` (deshabilitado) | 4,8 | Acción deshabilitada |
| borde `ember-500` | `coal-800` | 5,9 (≥ 3:1) | Resaltado de tarjeta recién llegada / foco de "Ver" |

### 9.3 Tipografía (tablet 1024 px; ≥ 1600 px `html.panel { font-size: 112.5% }`)
| Rol | Familia | Tamaño | Interlineado | Tracking |
|---|---|---|---|---|
| Palabras del ingreso | Condensed 800, MAYÚSCULAS | `clamp(3.5rem, 12vw, 9rem)` | 0.86 | −0.02em |
| Cifras del resumen (ref 2) | Condensed 600, `tabular-nums` | `clamp(2.25rem, 3.2vw, 3.5rem)` | 0.9 | −0.03em |
| Contador de columna | Condensed 600, `tabular-nums` | 2rem | 0.9 | −0.02em |
| Código de comanda | Condensed 800, MAYÚSCULAS | 1.75rem (28 px, RNF2) | 1 | 0.02em |
| Mesa (Salón la agranda) | Condensed 600 | 1.5rem (Salón 2rem) | 1 | 0 |
| Nombre de columna, subrótulos | Barlow 500, sentence case | 0.9375rem / 0.8125rem | 1.2 | 0.01em |
| Línea: cantidad + plato | Condensed 600 + Barlow 600 | 1.0625rem | 1.3 | 0 |
| Opciones | Barlow 400 | 0.9375rem | 1.35 | 0 |
| Notas | Barlow 500 | 0.9375rem | 1.4 | 0 |
| Botones | Barlow 600 | 1rem | 1 | 0.005em |
| Inputs del ingreso | Barlow 400 | 16px | 1.4 | 0 |
Sin fuentes nuevas: Condensed 600/800 y Barlow 400/500/600 ya se cargan en la 001.

### 9.4 Forma, capas y espaciado (regla de radios única)
- **Píldora (`rounded-full`):** todo lo interactivo de una línea (botones, `PillAction`, inputs del ingreso, chips, píldoras de la barra, selector de columnas). **16 px:** tarjetas y avisos de la pila. **20 px:** columnas. **28 px:** modales. Nada más (skill `design-taste-frontend`, *shape consistency lock*).
- Densidad de tablero: escala de espaciado 8 / 12 / 16 / 24 / 32 px (skill `ui-ux-pro-max`, densidad 8); márgenes laterales 16 px (celular) y 24 px (≥ 768).
- Capas: escenario 0 · tablero 10 · barra 30 · banner 32 · pila de alertas 45 · modales en top layer.
- Objetivos táctiles: `PillAction` 56 px de alto, ancho completo de la tarjeta; "Cancelar", "Ver", "Entendido", cerrar, pestañas de columna y opciones de estación ≥ 48 px; separación ≥ 8 px (RNF2).

### 9.5 Componentes firma
**PanelTopBar (ref 2):** fija arriba (`env(safe-area-inset-top) + 12px`), tres grupos con `justify-between`: (1) píldora `.glass` con `IconTile` `Fire` + "Fogón" + punto separador + estación en `ash-300`; (2) `StationSwitch` (`SegmentedControl` de la 001) en píldora `.glass`, oculto < 768; (3) `ConnectionPill` + `SoundPill` + `AccountMenu`. Alto 56 px.

**ConnectionPill:** punto de 8 px + texto: "En vivo" (`herb-400`), "Reconectando…" (`ember-400`, el punto respira con opacidad 1,6 s salvo movimiento reducido), "Sin conexión" (`chili-400`); debajo, en `ash-500`, "Actualizado 21:04" cuando no está en vivo. Nunca dice "En vivo" sin una conexión real (skill `ui-ux-pro-max`: *label telemetry as live only when backed by a current source*).

**SoundPill:** bloqueado → **píldora blanca `bone-50`** con `SpeakerSimpleSlash` y "Activar sonido" (el CTA blanco de la ref 2); listo → botón redondo de 48 px `SpeakerHigh` / `SpeakerSlash` con `aria-pressed` y nombre "Silenciar sonido"; no disponible → `SpeakerSimpleX` con texto.

**AccountMenu:** botón píldora con inicial del usuario; patrón de divulgación (`aria-expanded`, Escape y toque afuera cierran): nombre y restaurante, idioma ES | EN, estación (en celular), "Cerrar sesión".

**KpiStrip (ref 2):** fila sin cajas (skill `design-taste-frontend`: con densidad alta, las métricas respiran sin tarjetas): cada cifra con su subrótulo debajo; entre cifras, divisor diagonal `h-px w-16 bg-hairline rotate-[20deg]` (alternando ±20°), oculto < 768. "Demoradas" en `chili-400` si es > 0; "Listas" en `herb-400`. Cada cifra es texto ("3 nuevas"), no solo número.

**KanbanColumn:** `coal-900`, radio 20, padding 8, gap 8. Encabezado fijo: hairline superior de 2 px con el tono del estado (decorativo: `ember-500` nuevas, `ash-300` confirmadas, `ember-300` en preparación, `herb-400` listas), ícono de estado (`STATUS_ICON` de la 001), nombre y contador grande. Cuerpo con `overflow-y: auto`, `overscroll-behavior: contain` y máscara `linear-gradient(to bottom, #000 calc(100% - 32px), transparent)` solo cuando hay más contenido (`data-overflow`). Es una `<section aria-labelledby>`; la lista es `<ol>`.

**OrderTicket ("comanda"):** `<article>` `coal-800`, radio 16, hairline, padding 12-16.
- Encabezado: código (Condensed 800, 28 px) y "Mesa 12" (en Salón, la mesa primero y a 32 px); debajo, "21:04 · hace 7 min" y "En preparación hace 3 min" en `ash-300`/`ash-500` con `tabular-nums`.
- Líneas (`TicketLines`): "2×" en Condensed 600 + nombre en Barlow 600; opciones en `ash-300` separadas por " · "; **nota** en bloque `#3b2014` con borde izquierdo `ember-500` de 3 px e ícono `NotePencil`; la nota general al final, igual. Nunca se truncan (CL19).
- Pie: `PillAction` a todo el ancho + "Cancelar" (texto `chili-400`, 48 px, a la izquierda, menos peso).
- Estados: **recién llegada** (borde `ember-500` + brillo interior que se apaga en 1,2 s por opacidad); **guardando** (`PillAction` con `aria-busy` y "Guardando", tarjeta sin cambio de opacidad); **demorada** (barra izquierda de 4 px `chili-400` + chip "Demorada · 12 min" con `Timer`); **cancelada con sello** (velo `coal-950/75`, sello "CANCELADO" Condensed 800 en `chili-400` con borde de 2 px rotado −6°, botón "Entendido"; las acciones quedan `inert`); **sesión vencida** (todo el tablero `opacity .55` + `inert`).
- Variante **compacta** (Salón, "En cocina"): código, mesa, `StatusPill`, tiempo y "3 platos"; detalle en `<details>`.

**PillAction (refs 2 + 3):** `<button>` píldora `bone-50`, texto `coal-950` Barlow 600, alto 56 px; a la derecha un círculo de 40 px `coal-950` con `ArrowRight` `bone-50`, rotado −45° en reposo y 0° en hover (puntero fino) y `:active` (200 ms out-strong); `:active` `scale(.97)`; hover `bg-bone-200`. Variante `secondary` (Entregar en Cocina): borde hairline, fondo transparente, texto `bone-50`. Deshabilitado: `coal-700` + `ash-500`.

**Dialog / AlertDialogHost / CancelOrderDialog / SessionExpiredDialog (ref 3):** `<dialog>` modal, fondo `rgb(12 10 9 / .72)` con `backdrop-filter: blur(8px)` (en ese momento las píldoras de la barra quedan detrás, así que sigue habiendo pocas superficies con blur), panel `coal-800`, radio 28, `max-width: 480px`, padding 24. Crítica: hairline superior de 2 px `chili-400`, `IconTile` con `WarningOctagon` en `chili-400`, título en Condensed 800 ("PEDIDO K7F2 CANCELADO"), mesa y estado anterior grandes, "1 de 3", un único botón `PillAction` "Entendido" con el foco inicial; `role="alertdialog"`, sin cierre con Escape ni tocando el fondo. Confirmación de cancelar: "Cancelar pedido" (botón `chili-400` sólido con texto `coal-950`, contraste 7,1) y "Volver" con el foco inicial (la opción segura).

**AlertStack (ref 3):** ≥ 768 px, arriba a la derecha debajo de la barra, ancho 380 px; < 768, arriba a lo ancho. Cada aviso: `coal-800` radio 16 hairline, `IconTile` con el ícono y tono del tipo, título (Barlow 600) + detalle (`ash-300`), "Ver" y cerrar (48 px); barra de tiempo restante de 2 px (`scaleX`, lineal) que se detiene con la pausa. "y 2 avisos más" como fila final. No es región viva (anuncia `LiveRegion`).

**OfflineBanner:** franja `chili-400` al 12 % con borde inferior `chili-400`, ícono `WifiSlash`, texto `bone-50`; debajo de la barra, ocupa su lugar (empuja el contenido, no tapa).

**LoginScreen (ref 2 + ref 3):** escenario `coal-950` con el degradado inferior de la ref 2; "COCINA" arriba a la izquierda y "Y SALÓN" más abajo a la derecha (`aria-hidden`, decorativas), en Condensed 800 con brillo brasa de la 001; formulario abajo a la izquierda (la posición del párrafo de la ref 2), ancho 360 px: marca, inputs píldora (`bg rgb(255 240 225 / .06)` → `.10` al enfocar, borde hairline, alto 52 px, 16 px), `GlowButton` "Ingresar". En celular, palabras arriba y formulario debajo, en columna.

**StationPicker:** dos `<button>` grandes en grilla (una columna en celular), cada uno con la palabra gigante ("Cocina" / "Salón", Condensed 800 `clamp(3rem, 8vw, 6rem)`), ícono (`CookingPot` / `BellRinging`) y una línea de ayuda; `coal-900`, radio 20, hairline; foco y hover con borde `ember-500`.

**[P12] CallsStrip:** franja horizontal sobre el tablero del Salón con fichas píldora "Mesa 12 · hace 2 min · Atendida"; desplazamiento horizontal propio si no entran.

### 9.6 Layout responsivo y tamaños objetivo
| Ancho | Cocina | Salón |
|---|---|---|
| < 768 (celular del salón, mínimo 360; sin romperse a 320) | Barra compacta (marca + conexión + sonido + cuenta), resumen en una fila de 4 cifras chicas, `ColumnTabs` + una columna, página con desplazamiento normal | Igual, con "Listas para servir" seleccionada por defecto |
| 768-1023 (tablet chica del salón, vertical) | 2 columnas visibles con desplazamiento horizontal propio del tablero (`scroll-snap-type: x mandatory`) | 2 columnas (entran) |
| 1024-1599 (tablet de 10" horizontal de cocina; escritorio) | `grid-cols-4`, alto del tablero = `100dvh` − barra − resumen; columnas con desplazamiento propio | `grid-cols-[1.4fr_1fr]` |
| ≥ 1600 (monitor: no es objetivo, P19) | Igual, con `font-size: 112.5%` | Igual |
Dispositivos objetivo (P19): tablets de 10" horizontales en cocina; celulares y tablets chicas en salón. Verificación visual mínima de cada tarea con interfaz: 375 × 812, 768 × 1024 y 1024 × 768; la última tarea repite 375, 768, 1024 y 1280, y 1920 como control.

---

## 10. Movimiento

Criterio de las skills `animate`, `emil-design-eng` y `motion`: primero "¿se anima?", según frecuencia; solo `transform` y `opacity`; salida más rápida que la entrada; mismo camino de ida y vuelta; transiciones (no keyframes) en lo que se dispara seguido; movimiento reducido incluido.

| Interacción | Frecuencia | Decisión | Herramienta | Curva y duración |
|---|---|---|---|---|
| Tarjeta cambia de columna (propia u optimista) | Alta (decenas por turno) | Mínima: solo posición | Motion `layout="position"` + `layoutId` dentro de `LayoutGroup` | 180 ms out-strong; reducido: sin animación |
| Tarjeta llega (en vivo) | Media | Para encontrarla con la vista | Motion | opacity + `translateY(8px → 0)` 240 ms expo; brillo de borde por opacidad 1,2 s; reducido: solo el brillo |
| Tarjeta sale (entregada, "Entendido") | Media | Evitar salto | `AnimatePresence` | opacity + `scale(.98)` 160 ms out-strong |
| Contador de columna y cifras | Media | Estado | `AnimatePresence mode="popLayout"` | `translateY(±8px)` + opacity 180 ms |
| Aviso de la pila entra / sale (ref 3) | Ocasional | Estado | Motion (transiciones) | entra desde la derecha `translateX(24px → 0)` + opacity 320 ms expo; sale por la derecha 180 ms out-strong; celular: desde arriba `translateY(-12px)` |
| Modal crítico (ref 3) | Rara | Interrumpir | Motion sobre `<dialog>` | fondo opacity 200 ms; panel `scale(.96 → 1)` + opacity 240 ms expo, centrado; contenido escalonado 40 ms con `translateY(12px → 0)`; salida opacity + `scale(.98)` 160 ms |
| Flecha de `PillAction` (ref 3) | Alta | Feedback | CSS | `rotate(-45deg → 0)` 200 ms out-strong en hover y `:active` |
| Presión | Alta | Feedback | CSS `:active` | `scale(.97)` 120 ms |
| Ingreso (ref 2 + ref 3) | Una vez por carga | Deleite breve | Motion | palabras desde lados opuestos `translateX(∓40px → 0)` + opacity, 700 ms expo, stagger 130 ms; formulario `translateY(12px)` 500 ms; total ≤ 1,1 s; reducido: sin entrada |
| Punto "Reconectando…" | Continuo mientras dura | Estado vivo | CSS | opacity 1 → .4, 1,6 s; reducido: quieto |
| Barra de tiempo del aviso | Por aviso | Estado | CSS `transform: scaleX` | lineal, dura lo que el aviso; se pausa |
| Resaltado de "Ver" | Ocasional | Orientación | CSS | borde `ember-500` opacity 1 → 0 en 1,2 s |
| "Deshacer" [P9] | Por acción | Estado | CSS `scaleX` | lineal 5 s |
**Nunca:** animaciones en bucle en tarjetas (la demora es una barra quieta, RNF11), `scale(0)`, `transition: all`, animar `width/height/top/left`, animar acciones hechas con teclado.

---

## 11. Sonido (`soundPlayer.ts`)

Tonos generados con `OscillatorNode` + envolvente de `GainNode` (ataque 8 ms, caída exponencial), ganancia pico 0,25, sin archivos (P17):

| Cue | Onda | Notas (Hz × ms) | Carácter |
|---|---|---|---|
| `new` | sine | 659 × 120, pausa 60, 880 × 160 | Dos notas ascendentes: "llegó algo" |
| `ready` | sine | 1047 × 100, 1319 × 100, 1568 × 180 | Campanita de tres notas |
| `cancelled` | triangle | 440 × 180, pausa 80, 330 × 260 | Dos notas descendentes graves |
| `delayed` | sine | 523 × 250, pausa 150, 523 × 250 | Pulso doble neutro |
| `call` | sine | 1200 × 600 con caída larga, ×2 | Timbre |
| `connection` | triangle | 330 × 300, pausa 100, 262 × 400 | Grave y largo |
`play(cue)` no hace nada si el estado no es `ready`, si está silenciado o si pasaron menos de `SOUND_MIN_GAP_MS` desde el anterior. `unlock()` crea el `AudioContext` dentro del gesto y llama a `resume()`.

---

## 12. Decisiones y alternativas descartadas

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| D1 | `panel.html` como segunda entrada de Vite | Ruta interna con router / `panel/index.html` | Decisión ya tomada (memory, D2 de la 001); separa los bundles y no necesita reescrituras SPA. |
| D2 | `AuthService` detrás de la capa de servicios, con mock | Llamar a Supabase o a `fetch` desde las pantallas | RNF7: cambiar de proveedor no toca pantallas. |
| D3 | La interfaz nunca ve el token | Guardar el token en el contexto de React | Menos superficie de fuga (RNF6); solo el decorador y el adaptador lo usan. |
| D4 | Token corto en memoria + cookie `httpOnly` (P3-A) | `sessionStorage` / `localStorage` | Un script inyectado no puede leer la cookie; recargar no pide contraseña. |
| D5 | `system.auth` como primer mensaje del WebSocket (P4-A) | Token en la URL / ticket | El token no queda en logs y se renueva sin reconectar. |
| D6 | Decorador `withStaffAuth` | Chequear sesión en cada componente | Un solo lugar; defensa en profundidad también con el backend real. |
| D7 | Estación como vista del dispositivo (P6-A) | Rol en el token | El backend tiene un único rol. |
| D8 | Reglas de alertas y cola como funciones puras | Lógica dentro de los componentes | Testeables sin DOM; la tabla §3.4 de la spec se prueba fila por fila. |
| D9 | Críticas en `<dialog>` `alertdialog`; resto en pila propia | Todo como avisos / librería de toasts | Una cancelación en curso no puede pasar desapercibida; la pila tiene reglas propias. |
| D10 | Movimiento optimista con capa `pendingMoves` | Esperar la respuesta para mover | La cocina siente la respuesta al instante (RNF4); el conflicto se resuelve con `expectedStatus`. |
| D11 | Botones por tarjeta (P8-A) | Arrastrar y soltar | Manos ocupadas, teclado y WCAG 2.5.7. |
| D12 | Web Audio sintetizado (P17-A) | Archivos de audio | Sin descargas ni licencias. |
| D13 | Desbloqueo de audio con el primer gesto cualquiera + "Ingresar" | Solo el botón "Activar sonido" | Menos fricción; el botón queda como respaldo visible. |
| D14 | `RealtimeStatusService` separado | Estados de conexión dentro de `OrderService` | `OrderService` sigue sin saber de transporte (RNF10 de la 001). |
| D15 | Resincronizar con `since` al volver la conexión, al volver a primer plano y al reingresar | Recargar todo | Menos datos y misma consistencia (`mergeOrder`). |
| D16 | Píldora hueso para la acción principal (P13-A) | `GlowButton` en cada tarjeta | La brasa pierde fuerza si está en 30 botones a la vez (skill `impeccable`: la rareza le da fuerza al acento). |
| D17 | Sin vidrio en columnas ni tarjetas | Glassmorphism general | Skill `design-taste-frontend`: inapropiado en dashboards; costo de rendimiento. |
| D18 | Una llamada abierta por mesa, REST para crearla (P12) | Mensaje WS reservado `table.call_waiter` | El cliente necesita respuesta y reintento (RF58). |
| D19 | Sin virtualización de listas | `react-window` | 50-60 comandas (escala del backend, RNF4 del back) no lo justifican; se mide en T10. |
| D20 | Sin variables de entorno nuevas para el mock de ingreso | `VITE_MOCK_TOKEN_TTL_S`, etc. | Las ayudas de demo cubren las pruebas manuales (`ponytail`). |
| D21 | Slug del restaurante en `src/services/apiConfig.ts`, inyectado por la capa de servicios (K3) | Slug en la URL del QR o en las pantallas | El usuario aceptó enviarlo; un solo lugar, y las pantallas no cambian si el backend deja de exigirlo. |
| D22 | El panel recibe la cancelación del cliente; el botón de la carta queda para otra spec (P11, K5) | Agregar el botón en la 002 | No es trivial ni estaba previsto: cambia la carta de la 001, suma un método a `OrderService` y la ruta R6 no está definida. |

---

## 13. Estrategia de tests y verificación

### 13.1 Capas
| Capa | Herramienta | Qué se prueba |
|---|---|---|
| Unitaria | Vitest | `board`, `alertRules` (tabla §3.4 fila por fila), `alertQueue`, `session`, `orderStatus` [P9], `soundPlayer` con `AudioContext` falso |
| Servicio | Vitest + fakes (storage en memoria, `fakeChannel`, `now`) | `mockAuthService` (ingreso, intentos, restaurar, renovar, vencer, revocar), `withStaffAuth`, `mockRealtimeStatus`, `mockTableService` [P12], ayudas de demo |
| Componente | Testing Library + user-event + axe-core | Por rol y nombre accesible; `expectNoA11yViolations` en cada pantalla y cada modal |
| Integración | Testing Library: `CustomerApp` y `PanelApp` con el mock real compartiendo storage y `fakeChannel` | Flujo cliente → panel → cliente (spec §8.2) |
| Visual | MCP de Chrome DevTools | Por tarea con interfaz: 375 × 812, 768 × 1024 y 1024 × 768; final: 375, 768, 1024, 1280 y 1920 (control), con y sin movimiento reducido |
| Rendimiento (RNF4) | DevTools Performance, CPU ×4, 60 comandas sembradas con `__demo` | INP de la acción principal; ráfaga de 10 eventos sin tareas > 50 ms |
| Accesibilidad (RNF3) | Lighthouse + teclado | ≥ 95 en ingreso, estación y tablero; recorrido completo con teclado |
| Hardware real | Tablet y celular | Paso manual del usuario (spec §8.7) |

### 13.2 Reglas
- TDD estricto: rojo → mínimo para verde → triangular → refactor en verde. Sin aserciones triviales.
- Consultas por `getByRole` / `getByLabelText`; las columnas se ubican por su `section` con nombre ("Nuevas, 3 comandas").
- `vi.useFakeTimers()` para duraciones de avisos, ráfagas, repetición de críticas, demora, banner de 30 s, enfriamiento y renovación de token.
- `renderPanel()` envuelve en `MotionConfig` sin duración y permite inyectar servicios, estación, estado de sesión e idioma.
- Las pruebas de autenticación verifican además que el token **no** aparece en el DOM, en `localStorage` ni en la URL (RNF6).
- `npm test` en verde y `npm run build` sin errores (con las dos entradas) para cerrar una tarea.

### 13.3 Matriz de cobertura
| Requisito | Tarea | Prueba principal |
|---|---|---|
| RF1 | T1, T3 | `tests/panel/PanelApp.test.tsx` (sin sesión no hay datos); build con dos entradas |
| RF2, RF4, RF5 | T3 | `tests/panel/auth/LoginForm.test.tsx`; `LoginScreen.test.tsx` |
| RF3 | T3, T8 | `LoginForm.test.tsx` (llama a `sound.unlock` en el submit); `PanelApp.test.tsx` (va a estación) |
| RF6 | T2, T3 | `tests/services/mockAuthService.test.ts` (restore); `AuthGate.test.tsx` (splash → tablero) |
| RF7, RF9 | T2, T3, T5 | `mockAuthService.test.ts`; `tests/services/withStaffAuth.test.ts`; `SessionExpiredDialog.test.tsx`; `BoardContext.test.tsx` (401 en move) |
| RF8 | T3, T4 | `AuthContext.test.tsx`; `AccountMenu.test.tsx` (confirmación, limpieza) |
| RF10-RF12 | T1, T4 | `tests/domain/board.test.ts`; `StationContext.test.tsx`; `StationPicker.test.tsx`; `StationSwitch.test.tsx` |
| RF13-RF15, RF18 | T5, T6 | `BoardContext.test.tsx`; `KanbanBoard.test.tsx`; `BoardStates.test.tsx` |
| RF16, RF17 | T1, T6 | `board.test.ts` (orden, tiempos); `OrderTicket.test.tsx` |
| RF19 | T1, T4, T6 | `board.test.ts` (`boardCounts`); `KpiStrip.test.tsx` |
| RF20, RF21 | T6 | `KanbanColumn.test.tsx` (región con encabezado y lista desplazable); verificación visual |
| RF22 | T6 | `KanbanBoard.test.tsx` con `useMediaQuery` simulado; `ColumnTabs.test.tsx` |
| RF23, RF27, RF29, RF30 | T5, T6 | `BoardContext.test.tsx` (optimista, noop, red, doble toque); `OrderTicket.test.tsx` |
| RF24 | T1, T6 | `board.test.ts` (`primaryAction`); `OrderTicket.test.tsx` |
| RF25 | T6 | `CancelOrderDialog.test.tsx` |
| RF26, RF28 | T5 | `BoardContext.test.tsx` (`STATUS_CONFLICT`, `INVALID_TRANSITION`, CL27) |
| RF31 [P9] | T1, T5, T7 | `orderStatus.test.ts`; `mockOrderService.test.ts`; `BoardContext.test.tsx` (deshacer) |
| RF32-RF37, RF40 | T1, T7 | `tests/domain/alertRules.test.ts`; `alertQueue.test.ts`; `AlertsContext.test.tsx`; `AlertDialogHost.test.tsx`; `AlertStack.test.tsx` |
| RF38 | T7 | `AlertsContext.test.tsx` (texto anunciado; crítica como `alertdialog`) |
| RF39 | T6, T7 | `KanbanBoard.test.tsx` (`focusOrder`); `AlertStack.test.tsx` ("Ver") |
| RF41 | T7 | `useTitleBadge.test.tsx` |
| RF42-RF46 | T8 | `soundPlayer.test.ts`; `SoundContext.test.tsx`; `SoundPill.test.tsx` |
| RF47, RF48 | T1, T5, T6 | `board.test.ts`; `BoardContext.test.tsx` (una vez, sin recargar, timers falsos); `OrderTicket.test.tsx` |
| RF49, RF52, RF53 | T5 | `BoardContext.test.tsx` (suscribe primero, buffer, eco propio, resync con `since`, sin retrocesos, cancelación del cliente); `mockOrderService.test.ts` (`cancelByCustomer`) |
| RF50, RF51 | T5 | `ConnectionPill.test.tsx`; `OfflineBanner.test.tsx` (30 s) |
| RF54-RF58 [P12] | T9 | `mockTableService.test.ts`; `useCallWaiter.test.tsx`; `CallWaiterButton.test.tsx`; `CallsStrip.test.tsx` |
| RF59, RF60 | T4, T7 | `AccountMenu.test.tsx` (idioma); `AlertStack.test.tsx` (alertas traducidas al cambiar); `dictionaries.test.ts` |
| RF61 [P18] | T8 | `useWakeLock.test.tsx` |
| RNF1, RNF2, RNF10, RNF11 | T3-T10 | Verificación visual por tarea; tabla §9.2 |
| RNF3 | todas las de UI, T10 | `expectNoA11yViolations`; Lighthouse y teclado en T10 |
| RNF4, RNF5 | T10 | Traza de rendimiento; prueba de 12 h acelerada con timers falsos (sin fugas de suscripciones) en `BoardContext.test.tsx` |
| RNF6 | T2, T3 | `mockAuthService.test.ts`, `LoginForm.test.tsx` (token fuera del DOM, storage y URL; autocompletado) |
| RNF7, RNF8 | T2, T5 | `withStaffAuth.test.ts`; `mockAuthService.test.ts` (el usuario demo pertenece al restaurante de `API_CONFIG`); `BoardContext.test.tsx` con `fakeOrderService` |
| RNF12 | T4, T8 | storage que lanza error en `StationContext.test.tsx` y `SoundContext.test.tsx` |
| Flujo completo | T10 | `tests/panel/flow.test.tsx` |

**Adaptador real (fuera de la 002):** su tarea futura probará con un `WebSocket` falso: `system.auth` dentro de 5 s, `welcome` después del auth, renovación con `auth_ok`, cierre 4401 → renovar y reconectar una vez, 4403 sin reintento, más todo lo del plan 001 §13.3.

---

## 14. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El backend (Node.js + Express + Supabase) todavía no tiene las rutas de ingreso ni el `system.auth` acordados (K2, K6) | `AuthService` aísla el proveedor; solo cambia el adaptador. El usuario revisa §7.5-§7.6 con Uriel; el frontend avanza con el mock. |
| Navegadores que bloquean el audio o lo suspenden al bloquear la tablet (iOS) | Desbloqueo con cualquier gesto, `statechange` → vuelve "Activar sonido", alertas siempre visuales (RF46). |
| Wake Lock solo con HTTPS | Opcional (RF61); en la prueba por IP local no aplica; documentado en el paso manual. |
| Rendimiento de `layout` de Motion con 60 tarjetas | Solo `layout="position"` y solo en la tarjeta que cambia; medición en T10; si falla, se quita la animación entre columnas (fundido). |
| Fatiga de alertas | Prioridades, ráfagas agrupadas, alertas obsoletas retiradas, sin alertas por acciones propias, repetición de críticas acotada. |
| XSS roba el token en memoria | El token no está en storage ni en el DOM; React escapa el contenido (notas del cliente incluidas); recomendar CSP en producción (backend / hosting). |
| Cookie de renovación entre orígenes distintos (front y API en dominios diferentes) | Recomendar servir panel y API en el mismo sitio (proxy `/api`); si no, `SameSite=None` + CORS con credenciales + protección CSRF (a acordar). |
| Reloj de la tablet desfasado | `serverOffsetMs()` y tiempos nunca negativos (CL29). |
| El mock de ingreso da una falsa sensación de seguridad | Spec §3.6; nota visible "Modo demostración" en DEV; la protección real es del servidor. |
| Retroceso aplicado por otro dispositivo (K4) aunque el panel no lo use | `mergeOrder` por `updatedAt` ya lo soporta; alerta informativa (CL35). |
| Cambiar `canTransition` [P9] rompe tests de la 001 | La opción `allowStepBack` es opcional con valor por defecto `false`; la suite de la 001 debe seguir verde sin cambios. |
| Dos pestañas del panel suenan dos veces | Riesgo aceptado (spec §3.6). |

---

## 15. Seguridad del panel (dominio CRÍTICO): checklist de implementación
1. El token solo vive dentro de `AuthService` (memoria); en el mock, `sessionStorage` documentado como simulación.
2. Nunca en URL, `console.*`, atributos `data-*`, estado de React ni mensajes de error.
3. Formulario: `autocomplete="username"` / `"current-password"`, pegar permitido, error genérico, límite de intentos respetado.
4. Cerrar sesión: `logout()` + desmontar providers del tablero (borra comandas y alertas de memoria) + limpiar la clave de sesión del mock.
5. Sin sesión, el panel no pide comandas ni se suscribe (`withStaffAuth` + `AuthGate`).
6. `<meta name="robots" content="noindex, nofollow">` en `panel.html`.
7. Ningún dato del restaurante en `panel.html` (el HTML es la cáscara vacía).
8. Revisión con la skill `security-review` disponible en el entorno al cerrar T3 (reporte adjunto).

---

## 16. Qué queda para después
- Adaptador real `services/http/` (REST + WebSocket con `system.auth`), cuando el backend exista.
- Botón "Cancelar" del cliente (aceptado, P11; backend R6), QR con restaurante cuando haya más de un local, límite de 50 líneas (K3, K5, K9): cambios de la 001.
- Adaptador HTTP de la 001: agregar `restaurant` desde `API_CONFIG` (C6) y tratar el 404 `INVALID_TABLE` (C10).
- Arrastrar tarjetas, historial de entregadas, demoras por estado, impresión.
