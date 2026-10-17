# Plan 001: Base del proyecto y menú del cliente

- **Estado:** aprobado
- **Fecha:** 2026-10-11
- **Spec:** `specs/001-menu-cliente/spec.md` (48 RF, 10 RNF, 39 CL)
- **Tareas:** `specs/001-menu-cliente/tasks.md`

> Lectura de diseño: *app de pedido en mesa para comensales con el celular en la mano, con un lenguaje oscuro e inmersivo de "brasa" (carbón + luz cálida), tipografía condensada de pizarra de cocina y movimiento con propósito; se apoya en Tailwind v4 + Motion, sin sistema de diseño de terceros.*

---

## 0. Resumen en una línea por capa

| Capa | Decisión |
|---|---|
| Arquitectura | SPA React + Vite + TypeScript en capas: `domain` (lógica pura, sin React) → `services` (interfaces + mock) → `state` (contextos y hooks) → `features` (pantallas) → `ui` (kit visual compartido con la 002). |
| Estado | Sin librerías de estado: `useReducer` + Context para el pedido en curso (con el intento de envío persistido), un `MyOrdersProvider` montado siempre, `useState` local para la UI. |
| Datos | Interfaces `MenuService` / `OrderService`, independientes del transporte. Mock con `localStorage` + `BroadcastChannel`. El backend real se conecta con un adaptador REST + WebSocket (§7.3-§7.4), fuera de la 001. |
| Consistencia | Reglas puras en el dominio: `mergeOrder` (gana el `updatedAt` más nuevo), `applyTransition`, `validateLine`, `isDishOrderable`, `isDelayed`. Las reutiliza la 002 y el futuro adaptador. |
| Idiomas | Diccionarios tipados ES/EN propios + `Intl`; contenido de la carta con textos `{ es, en }`. |
| Visual | Tokens en `@theme` de Tailwind v4: carbón, hueso, brasa. Barlow Condensed + Barlow. Botón "brasa", píldora de vidrio, anillo 3D de platos, panel de carta superpuesto al anillo. |
| Tests | Vitest + Testing Library + jsdom + `axe-core`, TDD por tarea, carpeta `tests/`, verificación visual móvil en cada tarea con interfaz. |

---

## 1. Stack, dependencias y desviaciones

### 1.1 Dependencias (versiones: la última estable al ejecutar T1, fijadas en `package.json`)

| Paquete | Tipo | Para qué | Por qué este y no otro |
|---|---|---|---|
| `react`, `react-dom` | prod | UI | Stack confirmado por el usuario. |
| `motion` | prod | Animaciones (`import … from "motion/react"`) | Stack confirmado. Nunca importar de `framer-motion` (skill `motion`). |
| `@phosphor-icons/react` | prod | Íconos de comida e interfaz | Glifos de comida y de alertas que también usará la 002 (`design-taste-frontend` §3.C desaconseja Lucide y prohíbe SVG hechos a mano). |
| `@fontsource/barlow-condensed`, `@fontsource/barlow` | prod | Tipografías autoalojadas | Sin dependencia de Google Fonts en runtime (wifi de restaurante, privacidad, sin FOIT). |
| `vite`, `@vitejs/plugin-react`, `typescript` | dev | Build y dev server | Plantilla oficial `react-ts`. |
| `tailwindcss`, `@tailwindcss/vite` | dev | Estilos (Tailwind v4 con plugin de Vite, verificado con Context7) | v4 configura tokens en CSS con `@theme`. Requiere Safari 16.4+, Chrome 111+, Firefox 128+ (spec, supuesto 11). |
| `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | dev | Tests | Decisión del usuario. Setup con `import '@testing-library/jest-dom/vitest'` (verificado con Context7). |
| `axe-core` | dev | Análisis automático de accesibilidad en tests (RNF2) | Estándar de facto; sin envoltorios extra. La regla `color-contrast` se desactiva en jsdom (no calcula estilos); el contraste se garantiza con la tabla de §9.2. |

**Sin** router, sin librería de estado, sin librería de i18n, sin librería de datos remotos, sin librería de componentes (skill `ponytail`).

### 1.2 Desviaciones respecto de `docs/constitution.md` y `opencode/`, aprobadas por el usuario
| Documento | Dice | Se hace | Motivo |
|---|---|---|---|
| `constitution.md` §2, `opencode/claude.md` §3 | HTML/CSS/JS + Live Server | React + Vite (`npm run dev`) + Tailwind + Motion | Stack confirmado por el usuario. Se mantiene: mobile-first, HTML semántico, CSS estructurado (tokens en `@theme` + clases de componente en `@layer components`). |
| `opencode/agents/implementer.md` y `opencode/agents/reviewer.md` | `node --test` | `npm test` (= `vitest run`) | Stack React; decisión del usuario. **Esos archivos no se editan** (no es permiso del planner): el coordinador indica `npm test` al delegar cada tarea. |
| Referencias (`ref1`) | `<a href="#">` para botones, coordenadas absolutas, canvas escalado | `<button>` reales y layout fluido | HTML semántico (constitución) y pedido explícito de flexibilizar los "PIXEL CONTRACT". |
| `constitution.md` §2 (código en inglés) | Identificadores en inglés | Excepción: el parámetro de URL `?mesa=` queda en español | Es texto visible para el usuario en el QR; en el código se lee como `tableParam` / `tableId`. |

### 1.3 Lenguaje: TypeScript
Confirmado por el usuario ("ideal para escalar y tipar bien los contratos de datos que van al backend"). Los contratos de dominio y los sobres del protocolo WebSocket (§7.4) se comparten con la 002 y se proponen al backend. *Alternativa descartada:* JavaScript + JSDoc.

---

## 2. Estructura de carpetas y archivos

Convención del proyecto (`opencode/commands/code.md`): código en `src/`, tests en `tests/` (espejo de `src/`). La app Vite vive en la raíz del repo. Entre paréntesis, la tarea que crea cada archivo.

```
index.html                      metas de §11; <html lang="es">                                         (T1)
package.json                    scripts: dev (vite --host), build, preview, test (vitest run), test:watch (T1)
vite.config.ts                  plugins react() + tailwindcss(); bloque test: jsdom, setupFiles, include tests/** (T1)
tsconfig.json / tsconfig.app.json / tsconfig.node.json   (plantilla react-ts; types vitest/globals)  (T1)
.env.example                    VITE_MOCK_LATENCY_MS=400, VITE_MOCK_AUTO_ADVANCE=false               (T1)

src/
  main.tsx                      monta <App/>, fuentes, styles/index.css; en DEV instala window.__demo  (T1, T3)
  config.ts                     RESTAURANT = { name: 'Fogón', currency: 'ARS' }; MAX_QTY=20, NOTE_MAX=140, ORDER_NOTE_MAX=200,
                                MY_ORDERS_WINDOW_H=12, CODE_UNIQUE_WINDOW_H=24, TOAST_MS=4000                (T1)
  lib/
    id.ts                       createId(crypto?) → randomUUID si existe, si no UUID v4 con getRandomValues (T2)

  domain/                       TypeScript puro, sin React ni DOM. Lo reutiliza la 002.                (T2)
    types.ts                    tipos de §6
    table.ts                    parseTableParam(search) → { kind: 'valid', tableId } | { kind: 'missing' } | { kind: 'invalid', raw }
    text.ts                     countVisibleChars(s), limitVisibleChars(s, max)  (Intl.Segmenter; respaldo [...s])
    pricing.ts                  unitPriceCents(dish, selection), lineTotalCents(dish, selection, qty), cartTotalCents(lines, menu)
    selection.ts                toggleOption(group, selection, optionId), validateSelection(dish, selection) → GroupError[],
                                isDishOrderable(dish)
    lineValidation.ts           validateLine(menu, line) → LineIssue[]
    cart.ts                     lineKey(dishId, selection, note), addQuantity(current, added) → { quantity, capped },
                                cartReducer(state, action), submissionFingerprint(input)
    orderStatus.ts              ORDER_FLOW, FINAL_STATUSES, isFinal, stepIndex, canTransition, applyTransition
    orderMerge.ts               mergeOrder(current, incoming), upsertOrders(list, incoming[])
    delay.ts                    PENDING_DELAY_MINUTES = 10, isDelayed(order, nowMs)
    myOrders.ts                 selectRecentEntries(entries, nowIso, windowHours), selectVisibleOrders(orders, keepIds)
    shortCode.ts                SHORT_CODE_ALPHABET, generateShortCode(random), generateUniqueCode(existing, random)
    menuOrder.ts                sortMenu(menu) → categorías y platos por `order`; descarta platos con categoryId huérfano

  services/
    contracts.ts                MenuService, OrderService, SubscriptionFilter, ServiceError                 (T3)
    storage.ts                  safeStorage(local|session): get/set/remove con try/catch y respaldo en memoria (T3)
    ServicesContext.tsx         <ServicesProvider services> + useServices()                                (T3)
    index.ts                    createServices(): ÚNICO punto donde se elige mock o backend real           (T3)
    mock/
      menuData.ts               carta de demostración ES/EN (6 categorías, ~18 platos, con casos límite)   (T3)
      mockMenuService.ts        getMenu(), getTable(id)                                                   (T3)
      mockOrderService.ts       createOrder, findByClientRequestId, getOrders, listOrders, updateOrderStatus, subscribe (T3)
      demoHelpers.ts            installDemoHelpers(orderService) → window.__demo (solo DEV)                (T3)
    (futuro, NO en la 001) http/   adaptadores REST + WebSocket según §7.3-§7.4

  i18n/                                                                                                   (T4)
    es.ts, en.ts                diccionarios (en: `satisfies Record<keyof typeof es, string>`)
    format.ts                   interpolate, pluralKey, formatPrice, formatTime, localize
    I18nContext.tsx             <I18nProvider> + useI18n()

  state/
    TableContext.tsx            mesa: checking | valid | missing | invalid | unverified, retry(), markInvalid() (T5)
    useMenu.ts                  carga, retry, refresh silencioso en visibilitychange                      (T6)
    CartContext.tsx             useReducer(cartReducer) + sessionStorage por mesa (líneas, nota, intento pendiente) (T7)
    useSubmitOrder.ts           máquina de envío (§5.4)                                                    (T8)
    myOrdersStore.ts            registro local de pedidos enviados (localStorage) + suscripción in-tab y entre pestañas (T8)
    MyOrdersContext.tsx         <MyOrdersProvider>: pedidos del dispositivo, activos, novedad, eventos   (T9)
    useNow.ts                   reloj que avanza cada 30 s (para isDelayed)                               (T9)

  app/
    App.tsx                     providers (§3)                                              (T1 mínimo; T4, T5, T7, T9 lo amplían)
    CustomerApp.tsx             pantallas 'menu' | 'orders', restaura scroll, aviso de estado          (T5; T9 lo amplía)
    useHashScreen.ts            pantalla según hash + history.state (§5.8)                             (T5)
    useBackToClose.ts           "atrás" cierra la hoja abierta (§5.8)                                  (T7)

  ui/                           Kit visual compartido con la 002. Cada pieza nace en la primera tarea que la usa.
    motion.ts                   EASE, DUR, SPRING                                                       (T5)
    GlassPill.tsx, IconTile.tsx, SegmentedControl.tsx                                                     (T4, T5)
    TableBadge.tsx, LiveRegion.tsx                                                                        (T5)
    GlowButton.tsx, Skeleton.tsx, DishVisual.tsx                                                          (T6)
    Sheet.tsx, QuantityStepper.tsx                                                                         (T7)
    StatusPill.tsx, Toast.tsx                                                                              (T9)

  features/
    layout/   TopBar.tsx (T5; T9 agrega contador y novedad), LanguageToggle.tsx (T4)
    menu/     MenuScreen.tsx, CategoryTabs.tsx, MenuSection.tsx, DishRow.tsx, TableNotice.tsx (T5), MenuStates.tsx, useScrollSpy.ts (T6)
    dish/     DishSheet.tsx, OptionGroupField.tsx, NoteField.tsx                                         (T7)
    cart/     CartBar.tsx, CartSheet.tsx, CartLineItem.tsx, PriceChangeNotice.tsx                        (T8)
    orders/   OrdersScreen.tsx, OrderCard.tsx, OrderTimeline.tsx, SentCheck.tsx                          (T9)
    hero/     Hero.tsx, DishRing.tsx, ringMath.ts, EmberField.tsx, useIntroOnce.ts                       (T10)

  styles/
    index.css                   @import "tailwindcss"; @theme (§9); base móvil (§11); @layer components (.btn-ember, .glass);
                                media queries de accesibilidad                                         (T1; T5, T6 agregan clases)

tests/
  setup.ts                      jest-dom/vitest; stubs: matchMedia, IntersectionObserver, ResizeObserver, scrollIntoView,
                                scrollTo, HTMLDialogElement.showModal/close si faltan                                    (T1)
  utils.tsx                     renderWithProviders(ui, { services, lang, url, … }) en <MotionConfig transition={{duration:0}} reducedMotion="always">;
                                expectNoA11yViolations(container) con axe-core (sin color-contrast)                      (T1)
  fixtures/menu.ts              carta mínima con todos los casos límite                                                  (T2)
  fixtures/storage.ts           storage en memoria y storage que lanza error                                             (T2)
  fixtures/fakeChannel.ts       BroadcastChannel falso en memoria (simula 2 pestañas)                                    (T3)
  fixtures/fakeOrderService.ts  OrderService falso escrito a mano, sin transporte (RNF10)                                (T3)
```

---

## 3. Arquitectura de componentes

```
<App>                                        lee window.location.search una vez
 └─ <ServicesProvider services={createServices()}>
     └─ <I18nProvider>                       lang (localStorage), <html lang> sincronizado
         └─ <MotionConfig reducedMotion="user">
             └─ <TableProvider parsed={parseTableParam(search)}>    getTable; estados de §5.1
                 └─ <MyOrdersProvider currentTableId>              pedidos del dispositivo (todas las mesas), siempre montado
                     └─ <CartProvider tableId>                      useReducer + sessionStorage por mesa
                         └─ <CustomerApp>                           useHashScreen(), useMenu()
                             ├─ <LiveRegion/>                       una región aria-live="polite" para toda la app
                             ├─ <TopBar>                            píldora de vidrio fija
                             │    ├─ marca (IconTile con ícono Fire + "Fogón")           ← identidad de RF4
                             │    ├─ <LanguageToggle>  (SegmentedControl ES | EN)
                             │    └─ "Mis pedidos" (Receipt + contador de activos + punto de novedad), visible según RF42
                             ├─ <Toast/>                            aviso de cambio de estado en la carta (RF47)
                             │
                             ├─ pantalla 'menu' → <MenuScreen>
                             │    ├─ <Hero>                         (T10)
                             │    │    ├─ <EmberField/>, <TableBadge/>, <h1> 2 líneas, <p>, <GlowButton> "Ver la carta" (scrollIntoView)
                             │    │    └─ <DishRing dishes={destacados pedibles}/>   aria-hidden
                             │    ├─ <section id="carta" class="panel">  se superpone al tercio inferior del anillo
                             │    │    ├─ <TableNotice/>              mesa missing | invalid | checking | unverified (+ Reintentar)
                             │    │    ├─ <CategoryTabs/>             sticky, scroll-spy, indicador con layoutId
                             │    │    ├─ <MenuStates/>               skeleton | error + Reintentar | vacío
                             │    │    └─ <MenuSection category> × n → <DishRow dish onOpen/> × n
                             │    ├─ <DishSheet dishId onClose/>      (Sheet + useBackToClose)
                             │    │    ├─ <DishVisual/>, nombre, descripción, etiquetas
                             │    │    ├─ <OptionGroupField group/> × n
                             │    │    ├─ <QuantityStepper min=1 max=20/>, <NoteField max=140/>
                             │    │    └─ pie: <GlowButton> "Agregar   $ 12.400"  |  <TableNotice compact/>
                             │    ├─ <CartBar/>                       fija abajo, solo si hay líneas
                             │    └─ <CartSheet onSent/>              (Sheet + useBackToClose; se desmonta al cerrar, el estado vive en CartContext)
                             │         ├─ <CartLineItem/> × n         (QuantityStepper con "Quitar", motivo si la línea no es válida)
                             │         ├─ <NoteField max=200/>, total, mesa
                             │         ├─ <PriceChangeNotice/>        si el restaurante devolvió un total nuevo (RF46)
                             │         └─ <GlowButton loading> "Enviar pedido" + error en línea
                             │
                             └─ pantalla 'orders' → <OrdersScreen highlightId>
                                  ├─ estado vacío / aviso de mesa (RF42, CL30)
                                  └─ <OrderCard order highlighted? delayed?/> × n
                                       ├─ <SentCheck/>               solo el recién enviado
                                       ├─ código, mesa, hora, <StatusPill/>
                                       ├─ "Tu pedido está tardando, avisá al mozo" si isDelayed (RF48)
                                       ├─ <OrderTimeline/>, <details> líneas + total confirmado
                                       └─ aviso si cancelado
                                  └─ <GlowButton> "Pedir algo más" → goBackToMenu()
```

**Por qué hojas y no pantallas para ficha y resumen:** el cliente no pierde el contexto de la carta y vuelve con un gesto o con "atrás" (RF43); patrón conocido de apps de delivery (`apple-design` §16 *Familiarity*).

---

## 4. Manejo de estado: qué vive dónde y por qué

| Estado | Dónde vive | Persistencia | Por qué ahí |
|---|---|---|---|
| Mesa | `TableContext` (raíz) | ninguna: se deriva de la URL | Global, cambia poco (`ui-ux-pro-max`, react: Context para datos globales que cambian poco). |
| Idioma | `I18nContext` | `localStorage['restaurante.lang']` | Global, cambia rara vez. |
| Carta | `useMenu()` en `CustomerApp`, por props | ninguna | Un fetch + refresco silencioso; sin librería de caché. |
| Pedido en curso: líneas, nota general e **intento de envío pendiente** `{ clientRequestId, fingerprint, startedAt }` | `CartContext` con `useReducer(cartReducer)` | `sessionStorage['restaurante.cart.table-{id}']` | Reducer puro testeable. Guarda IDs y selección; precios y nombres se derivan de la carta vigente (RF44). El intento pendiente persistido evita duplicados tras recargar o reabrir el resumen (RF26). |
| Estado del envío (`idle`, `sending`, `unresolved`, `priceChanged`, `rejected`, `error`) | `useSubmitOrder()` en `CartSheet` | se reconstruye desde el intento pendiente | Efímero; la verdad persistente es el intento pendiente. |
| Registro de pedidos enviados | `myOrdersStore` | `localStorage['restaurante.myOrders']` = `[{ orderId, tableId, createdAt }]` | Sobrevive a cerrar la pestaña; compartido por las pestañas del navegador (= mismo dispositivo). Avisa cambios en la pestaña y entre pestañas (evento `storage`). |
| Pedidos del dispositivo, activos, novedad | `MyOrdersContext` (siempre montado) | ninguna (fuente: servicio) | Lo usan la TopBar (contador y novedad), el aviso de la carta y "Mis pedidos". |
| Pantalla actual | `useHashScreen()` | hash (`#/orders`) + `history.state` | "Atrás" funciona sin router (RF32). |
| Hoja abierta | `useState` en `MenuScreen` + `useBackToClose` | entrada de historial propia | "Atrás" cierra la hoja (RF43). |
| Recién enviado (`justSentOrderId`) | `useState` en `CustomerApp` | ninguna | Solo para destacar la confirmación. |
| Selección en la ficha, categoría activa | `useState` local | ninguna | Estado de UI aislado. |
| Valores continuos (fase del anillo, arrastre) | refs + `useAnimationFrame` / motion values | ninguna | Nunca en `useState` (`design-taste-frontend` §3.B, §5.D). |
| Intro ya reproducida | `useIntroOnce()` | `sessionStorage['restaurante.intro']` | Una vez por sesión (RF5). |

Todos los accesos a almacenamiento pasan por `safeStorage`: si el navegador lo bloquea, funcionan en memoria (RNF8).

---

## 5. Flujo de datos

### 5.1 Del QR a la mesa (RF1-RF3, RF41)
```
QR → https://<host>/?mesa=12
parseTableParam(search): URLSearchParams.get('mesa') (si se repite, vale la primera); vacío → missing;
  /^\d{1,3}$/ y 1..999 → valid (con ceros a la izquierda: "012" → 12); cualquier otra cosa → invalid
  ├─ missing/invalid → {status:'missing'|'invalid'}      → TableNotice; agregar/enviar deshabilitados
  └─ valid(12)       → {status:'checking', tableId:12} → menuService.getTable(12)
                          ├─ existe → {status:'valid'}           → TableBadge "Mesa 12"
                          ├─ null   → {status:'invalid'}
                          └─ error  → {status:'unverified'}      → TableNotice con "Reintentar" (retry());
                                                                   reintento automático en 'online'
markInvalid(): lo usa el envío si el restaurante responde INVALID_TABLE.
```

### 5.2 Carga y refresco de la carta (RF7-RF10, RF45)
`useMenu()` → `getMenu()` → `loading` (Skeleton) → `ready` (`sortMenu`: categorías y platos por `order`, platos huérfanos descartados, categorías vacías ocultas) | `error` (mensaje según `ServiceError.code` y `navigator.onLine`; "Reintentar" → `retry()`).
`refresh()` silencioso: en `visibilitychange` → visible y después de un rechazo del envío (`LINES_REJECTED`, `PRICE_CHANGED`, `VALIDATION`). Mientras refresca se sigue mostrando la carta actual; si falla, no se muestra error (se reintenta en el próximo disparador). El pedido en curso no se toca: sus líneas se re-validan solas porque se derivan de la carta (RF44).

### 5.3 De la ficha al pedido en curso (RF13-RF20, RF19, RF43)
```
DishRow: si !isDishOrderable(dish) → "Agotado", botón deshabilitado, no abre (RF13, P4)
DishRow (tap) → setOpenDishId(id) → <DishSheet> (useBackToClose empuja una entrada de historial)
  selection: toggleOption(...)                 single reemplaza; multiple: opciones no elegidas deshabilitadas al llegar a max (RF17)
  errors = validateSelection(dish, selection)  "Elegí {n} opción/opciones" junto al grupo (RF16)
  total  = lineTotalCents(dish, selection, qty)
  "Agregar" (habilitado si no hay errores y la mesa es valid)
     → cart.addLine({ dishId, selection, note, quantity })
        cartReducer 'add': key = lineKey(...); addQuantity(existente, nueva) → { quantity: min(20, suma), capped }
     → si capped: anuncio y aviso "Máximo 20 por plato" (P6)
     → anuncio en LiveRegion "Agregado: {plato} × {n}" + ping visual en CartBar
       (con movimiento reducido: sin ping, borde de la CartBar resaltado 1,5 s por opacidad) (RF19, CL22)
     → cerrar hoja (history.back si la entrada de la hoja está arriba)
```

### 5.4 Envío (RF24-RF27, RF44, RF46)
```
CartSheet "Enviar pedido" (habilitado si mesa valid, ≥1 línea y validateLine(menu, línea) vacío para todas)
useSubmitOrder.submit():
  if status ∈ {sending} → return                                         (doble toque, RF24)
  input = { clientRequestId, tableId, items:[{ lineId, dishId, quantity, selection, note }], note,
            expectedTotalCents: cartTotalCents(lines, menu) }
  fp = submissionFingerprint(input sin clientRequestId)
  pending = cart.pendingSubmission
  clientRequestId = (pending && pending.fingerprint === fp) ? pending.clientRequestId : createId()
  cart.setPending({ clientRequestId, fingerprint: fp, startedAt })      ← persistido ANTES de enviar
  orderService.createOrder(input)
    ├─ ok(order)                  → myOrdersStore.add(order) → myOrders.register(order) → cart.clear() (borra pending)
    │                                → onSent(order.id) → navigate('orders')                            (RF25)
    ├─ PRICE_CHANGED (409)        → cart.clearPending(); refresh carta; status 'priceChanged' con
    │                                details { totalCents, lines[{lineId, unitPriceCents}] } → <PriceChangeNotice>:
    │                                "Aceptar y enviar" (nuevo intento con expectedTotalCents = details.totalCents)
    │                                | "Revisar pedido" (vuelve a editable)                               (RF46, P1)
    ├─ LINES_REJECTED (422)       → cart.clearPending(); refresh carta; líneas marcadas con su motivo  (RF27)
    ├─ INVALID_TABLE (422)        → cart.clearPending(); table.markInvalid(); pedido en curso se conserva (CL1)
    ├─ VALIDATION (400)           → cart.clearPending(); refresh; "No pudimos procesar el pedido. Revisá cantidades y notas."
    └─ NETWORK / SERVER / timeout → status 'unresolved': pedido en curso BLOQUEADO para edición      (RF26)
           "Reintentar"     → reenvía con el MISMO clientRequestId (el servidor devuelve el pedido si ya existía)
           "Editar pedido"  → resolve(): findByClientRequestId(id)
                                 ├─ Order → camino ok
                                 ├─ null  → cart.clearPending() → editable (el próximo envío usa un id nuevo)
                                 └─ error → sigue bloqueado: "Sin conexión. Probá de nuevo."
Al montar la app o abrir el resumen con un pending persistido → resolve() automático (también en 'online').
```

### 5.5 Seguimiento en tiempo real (RF28-RF31, RF39, RF42, RF47, RF48)
```
MyOrdersProvider (siempre montado):
  entries = selectRecentEntries(myOrdersStore.read(), now, 12)            todas las mesas del dispositivo (P3)
  tableIds = únicos(entries.tableId) ∪ { mesa actual válida }
  1. unsubscribe = orderService.subscribe(onEvent, { kind: 'tables', tableIds })   ← PRIMERO, con buffer
  2. orders = upsertOrders([], await getOrders(ids))                                  NOT_FOUND → se quitan del store
  3. se aplican los eventos del buffer con mergeOrder → luego en vivo
  onEvent(e): si e.order.id ∉ ids → ignorar
              orders = upsertOrders(orders, [e.order])                     mergeOrder: gana updatedAt más nuevo; igual → se queda el actual
              si e.type === 'order.status_changed' y realmente cambió:
                 anunciar "Pedido {code}: {estado}" en LiveRegion (RF29)
                 si pantalla === 'menu' → Toast arriba de la carta (TOAST_MS) + hasNews = true (RF47, P2)
  myOrdersStore cambia (esta pestaña: register(order); otra pestaña: evento 'storage')
              → recalcular ids/tableIds → re-suscribir si cambian → getOrders de los ids nuevos → upsert (RF28, CL31)
  'visibilitychange' (visible) y 'online' → refresh(): getOrders(ids) → upsert (nunca retrocede, RF30)
  Expone: orders, activeOrders (no finales), hasNews, clearNews(), register(order), refresh()

OrdersScreen: muestra selectVisibleOrders(orders, keepIds): activos + los que pasaron a final mientras la pantalla
  está montada (keepIds); al entrar llama clearNews(). useNow(30 s) re-evalúa isDelayed(order, now) (RF48, P5).
TopBar: activeOrders.length + punto de novedad si hasNews; visible según RF42.
```
`MyOrdersProvider` no sabe cómo llegan los eventos (RNF10): en la demo, `BroadcastChannel`; con backend, el adaptador WebSocket (§7.4). La consistencia (sin duplicados, sin retrocesos, sin huecos entre carga y suscripción) la garantizan el orden "suscribir primero" y `mergeOrder`, que se prueban en la 001.

### 5.6 Sincronización entre pestañas en modo demostración (RF40)
```
Pestaña A                                   Pestaña B (otra pestaña del cliente; en la 002, el panel)
createOrder/updateOrderStatus
  → guarda en localStorage                  BroadcastChannel('restaurante.orders').onmessage
  → notifica listeners locales              → notifica sus listeners → UI actualizada
  → channel.postMessage(event)
myOrdersStore.add → localStorage            evento 'storage' (clave restaurante.myOrders) → MyOrdersProvider recarga ids
```
`BroadcastChannel` no entrega el mensaje a la pestaña que lo emite: por eso el mock notifica primero a sus listeners locales. Cada operación relee `localStorage` antes de escribir.

### 5.7 Idioma (RF33-RF35)
`LanguageToggle` → `setLang('en')` → `localStorage` + `document.documentElement.lang` → re-render: `t()` para la interfaz, `localize()` para carta, ficha abierta y pedidos (fallback a `es`), `formatPrice` / `formatTime` con el locale. La selección de la ficha y el pedido en curso no se tocan (CL19).

### 5.8 Navegación e historial (RF32, RF43)
- `useHashScreen()` → `{ screen, navigate(screen, { replace? }), goBackToMenu() }`. Escucha `hashchange` y `popstate`.
  - `navigate('orders')` hace `history.pushState({ app: 'restaurante', from: 'menu' }, '', '#/orders')`.
  - `goBackToMenu()`: si `history.state?.from === 'menu'` → `history.back()`; si no (se entró directo a `#/orders`) → `history.replaceState(…, '#/')`.
  - "Ver la carta" de la portada usa `scrollIntoView` (no cambia el hash; el `id="carta"` queda solo como ancla semántica).
- `useBackToClose(open, close)`: al abrir una hoja hace `pushState({ sheet: true })` con la misma URL; un `popstate` con la hoja abierta llama a `close()`; cerrar desde la UI hace `history.back()` si la entrada de la hoja está arriba. Así el "atrás" del sistema cierra la hoja (RF43).
- `CustomerApp` guarda `scrollY` al salir de la carta y lo restaura al volver (RF32).

---

## 6. Modelo de dominio (contrato compartido con la 002 y el backend)

`src/domain/types.ts`. JSON camelCase. Importes en **centavos enteros**. Fechas ISO 8601 UTC.

```ts
export type Lang = 'es' | 'en';
export interface LocalizedText { es: string; en?: string }              // 'en' opcional → fallback a 'es'

export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten_free' | 'spicy';
export type CategoryVisual = 'starter' | 'main' | 'grill' | 'pasta' | 'dessert' | 'drink';

export interface Option { id: string; name: LocalizedText; priceDeltaCents: number; available: boolean }
export interface OptionGroup {
  id: string; name: LocalizedText; type: 'single' | 'multiple';
  min: number;                 // 0 = opcional; >= 1 = obligatorio
  max: number;                 // 'single' ⇒ max = 1
  options: Option[];
}
export interface Dish {
  id: string; categoryId: string; order: number;
  name: LocalizedText; description: LocalizedText;
  priceCents: number; imageUrl?: string;
  tags: DietaryTag[]; available: boolean; featured: boolean;
  optionGroups: OptionGroup[];
}
export interface Category { id: string; name: LocalizedText; order: number; visual: CategoryVisual }
export interface Menu { categories: Category[]; dishes: Dish[] }

export type Selection = Record<string, string[]>;                       // groupId → optionIds

export interface CartLine { key: string; dishId: string; quantity: number; selection: Selection; note: string }
export interface PendingSubmission { clientRequestId: string; fingerprint: string; startedAt: string }
export interface CartState { lines: CartLine[]; note: string; pending?: PendingSubmission }

export type LineIssueReason = 'dish_not_found' | 'dish_unavailable' | 'option_not_found' | 'option_unavailable' | 'selection_invalid';
export interface LineIssue { reason: LineIssueReason; groupId?: string; optionId?: string }

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export interface OrderItemOption { groupId: string; optionId: string; name: LocalizedText; priceDeltaCents: number }
export interface OrderItem {
  lineId: string; dishId: string; name: LocalizedText;                  // snapshot al momento del pedido
  quantity: number; unitPriceCents: number; options: OrderItemOption[]; note?: string;
}
export interface Order {
  id: string; code: string; clientRequestId: string;
  tableId: number;
  items: OrderItem[]; note?: string; totalCents: number;
  status: OrderStatus;
  createdAt: string; updatedAt: string;                                 // updatedAt cambia en cada transición
  statusHistory: { status: OrderStatus; at: string }[];
}

export interface CreateOrderInput {
  clientRequestId: string;                                              // idempotencia (§3.4 de la spec)
  tableId: number;
  items: { lineId: string; dishId: string; quantity: number; selection: Selection; note?: string }[];
  note?: string;
  expectedTotalCents: number;                                           // reconfirmación de precio (RF46)
}

export type OrderEvent =                                                // unión cerrada: solo pedidos
  | { type: 'order.created'; order: Order }
  | { type: 'order.status_changed'; order: Order; previousStatus: OrderStatus };
```

Reglas puras (todas con pruebas en T2):
```ts
ORDER_FLOW = ['pending', 'accepted', 'preparing', 'ready', 'delivered']; FINAL_STATUSES = ['delivered', 'cancelled']
canTransition(from, to)  // siguiente en ORDER_FLOW, o 'cancelled' desde no final; from === to → false
applyTransition(order, to, expectedStatus, nowIso):
  order.status === to                → { kind: 'noop' }                       (spec §3.2)
  order.status !== expectedStatus    → { kind: 'conflict', current: order }
  !canTransition(order.status, to)   → { kind: 'invalid' }
  otherwise                          → { kind: 'applied', order: { …order, status: to, updatedAt: nowIso, statusHistory: [...] } }
mergeOrder(current | undefined, incoming): !current → incoming;
  incoming.updatedAt > current.updatedAt → incoming; si no → current             (sin retrocesos ni duplicados)
upsertOrders(list, incoming[]) → lista por id aplicando mergeOrder, ordenada por createdAt desc
isDishOrderable(dish) = dish.available && dish.optionGroups.every(g => g.options.filter(o => o.available).length >= g.min)
validateLine(menu, line) → LineIssue[]   // plato inexistente / no pedible / opción inexistente / no disponible / validateSelection
addQuantity(current, added) → { quantity: Math.min(20, current + added), capped: current + added > 20 }
submissionFingerprint(input) → JSON canónico (líneas por lineId, opciones ordenadas) sin clientRequestId
PENDING_DELAY_MINUTES = 10; isDelayed(order, nowMs) = order.status === 'pending' && nowMs - Date.parse(order.createdAt) >= 10 min
SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
generateUniqueCode(existingCodesLast24h, random) → reintenta hasta 20 veces; si no encuentra, lanza error
```

---

## 7. Capa de servicios

### 7.1 Interfaces (`src/services/contracts.ts`)
```ts
export type ServiceErrorCode =
  | 'NETWORK' | 'SERVER' | 'NOT_FOUND' | 'VALIDATION'
  | 'INVALID_TABLE' | 'LINES_REJECTED' | 'PRICE_CHANGED' | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_TRANSITION' | 'STATUS_CONFLICT';

export interface ServiceErrorDetails {
  lines?: { lineId: string; dishId: string; reason: LineIssueReason; optionId?: string; groupId?: string }[]; // LINES_REJECTED
  totalCents?: number; priceLines?: { lineId: string; unitPriceCents: number }[];                           // PRICE_CHANGED
  order?: Order;                                                                                            // STATUS_CONFLICT
}
export class ServiceError extends Error {
  constructor(public code: ServiceErrorCode, message: string, public details?: ServiceErrorDetails) { super(message) }
}

export type SubscriptionFilter = { kind: 'tables'; tableIds: number[] } | { kind: 'staff' };

export interface MenuService {
  getMenu(): Promise<Menu>;
  getTable(tableId: number): Promise<{ id: number } | null>;
}
export interface OrderService {
  createOrder(input: CreateOrderInput): Promise<Order>;
  findByClientRequestId(clientRequestId: string): Promise<Order | null>;
  getOrders(ids: string[]): Promise<Order[]>;                                       // omite los inexistentes
  listOrders(filter: { tableIds?: number[]; statuses?: OrderStatus[]; since?: string }): Promise<Order[]>;  // 002 y re-sync
  updateOrderStatus(id: string, status: OrderStatus, expectedStatus: OrderStatus): Promise<Order>;          // 002
  subscribe(listener: (event: OrderEvent) => void, filter: SubscriptionFilter): () => void;
}
export interface Services { menuService: MenuService; orderService: OrderService }
```
- Las pantallas solo conocen estas interfaces vía `useServices()`. `services/index.ts` es el **único** lugar que elige la implementación (RNF4).
- **Independiente del transporte (RNF10):** nada de `BroadcastChannel`, `WebSocket`, sobres, estados de conexión ni reintentos en la interfaz.
- **Tratamiento de errores en la UI:** `NETWORK`/`SERVER` → mensajes de §8; `NOT_FOUND` en `getOrders` → el id se quita del registro local sin aviso; `IDEMPOTENCY_CONFLICT` → se trata como intento sin resolver (`resolve()`); `INVALID_TRANSITION` y `STATUS_CONFLICT` solo los recibe la 002 (el cliente no cambia estados).
- **Extensión reservada para la 002 ("Llamar al mozo", RNF9). No se crea en la 001:**
  ```ts
  interface TableService {                       // servicio separado: el contrato de pedidos no cambia
    callWaiter(tableId: number, note?: string): Promise<{ callId: string }>;
    subscribe(listener: (e: TableEvent) => void, filter: SubscriptionFilter): () => void;
  }
  type TableEvent = { type: 'table.waiter_called'; callId: string; tableId: number; at: string };
  ```
  El adaptador WebSocket compartirá una sola conexión: los mensajes `order.*` van a los listeners de `OrderService`, los `table.*` a los de `TableService`, y los tipos desconocidos se ignoran (compatibilidad hacia adelante).

### 7.2 Mock (`services/mock/`)
- **Inyección de dependencias:** `createMockOrderService({ storage, channelFactory, now, random, latencyMs, autoAdvance, menuService })`.
- **Persistencia:** `localStorage['restaurante.mock.orders']` (lista de `Order`). Con `safeStorage`; si falla, en memoria.
- **createOrder:** valida mesa (1-20) → `INVALID_TABLE`; ítems no vacíos, cantidades 1-20, notas dentro del límite (`countVisibleChars`) → `VALIDATION`; `validateLine` por línea → `LINES_REJECTED` con `details.lines`; precios con `domain/pricing`; si `expectedTotalCents` ≠ total calculado → `PRICE_CHANGED` sin registrar nada; si ya existe un pedido con ese `clientRequestId` y el mismo `submissionFingerprint` → devuelve ese pedido; con otro contenido → `IDEMPOTENCY_CONFLICT`; `code` con `generateUniqueCode` sobre los creados en 24 h; estado `pending`; emite `order.created`.
- **findByClientRequestId**, **getOrders**, **listOrders** (`since` filtra por `updatedAt`).
- **updateOrderStatus:** usa `applyTransition`: `noop` → devuelve el pedido sin evento; `conflict` → `STATUS_CONFLICT` con `details.order`; `invalid` → `INVALID_TRANSITION`; `applied` → guarda y emite `order.status_changed` con `previousStatus`.
- **subscribe:** listeners locales + `BroadcastChannel('restaurante.orders')`; filtra por `tableIds` (o todo con `staff`).
- **Latencia simulada:** `VITE_MOCK_LATENCY_MS` (400 ms por defecto; 0 en tests).
- **Avance automático (demo sin 002):** `VITE_MOCK_AUTO_ADVANCE=true` → la pestaña que creó el pedido lo avanza a `accepted` (5 s), `preparing` (10 s), `ready` (25 s), `delivered` (40 s). Apagado por defecto.
- **Ayudas de demo (solo `import.meta.env.DEV`):** `window.__demo = { list(), setStatus(codeOrId, status), advance(codeOrId), setPrice(dishId, cents), setAvailable(dishId, bool), reset() }`. Permiten probar a mano cambios de estado, precio (RF46) y disponibilidad (RF44) desde la consola. `setPrice`/`setAvailable` modifican la carta mock en `localStorage['restaurante.mock.menuOverrides']`.
- `// ponytail:` escritura "última gana" entre pestañas simultáneas; aceptable en demo.

### 7.3 Contrato propuesto para el backend del compañero
JSON camelCase (en FastAPI/Pydantic: `alias_generator=to_camel`). Errores `{ "code": ServiceErrorCode, "message": string, "details"?: ServiceErrorDetails }`.

| Método | Ruta | Cuerpo / query | Respuestas | Uso |
|---|---|---|---|---|
| GET | `/api/menu` | | 200 `Menu` (ambos idiomas) | 001 |
| GET | `/api/tables/{tableId}` | | 200 `{ id }` · 404 | 001 |
| POST | `/api/orders` | `CreateOrderInput`; header `Idempotency-Key` | ver reglas de idempotencia | 001 |
| GET | `/api/orders` | `ids=a,b` · `tableId=12&tableId=5` (repetible) · `status=pending,accepted` · `since=<ISO>` (updatedAt posterior) · `clientRequestId=<id>` | 200 `Order[]`. Sin `ids`/`since`/`clientRequestId`, `tableId` devuelve solo los creados en las últimas 12 h | 001 y 002 |
| PATCH | `/api/orders/{id}/status` | `{ "status": OrderStatus, "expectedStatus": OrderStatus }` | 200 `Order` (aplicado o sin cambios) · 409 `STATUS_CONFLICT` (`details.order`) · 409 `INVALID_TRANSITION` · 404 | 002 |
| WS | `/ws/orders?tableId=12&tableId=5` (mesas) · `/ws/orders?scope=staff` (panel) | protocolo §7.4 | cierres 4400 / 4404 / 4408 | 001 y 002 |

**Reglas de idempotencia de `POST /api/orders` (spec §3.4):**
1. `Idempotency-Key` y `body.clientRequestId` deben coincidir; si no → 400 `VALIDATION`.
2. La clave se guarda solo cuando el pedido se registra, por al menos 24 h.
3. Clave ya registrada + mismo contenido canónico (`submissionFingerprint`) → 200 con el pedido original (sin nuevo evento).
4. Clave ya registrada + contenido distinto → 409 `IDEMPOTENCY_CONFLICT`.
5. Rechazos (`VALIDATION`, `INVALID_TABLE`, `LINES_REJECTED`, `PRICE_CHANGED`) no registran nada ni guardan la clave; el cliente usa una clave nueva en el siguiente intento.
6. Respuesta exitosa nueva → 201 `Order`. Orden de validación: mesa → forma (400) → líneas (422 `LINES_REJECTED`, con `details.lines[].reason`) → precio (409 `PRICE_CHANGED`, con `details.totalCents` y `details.priceLines`).
7. Tiempo de espera del cliente: 15 s; vencido, el cliente lo trata como resultado desconocido y consulta `GET /api/orders?clientRequestId=`.

Otras reglas: recalcular precios y disponibilidad (no confiar en el cliente); generar `id` y `code` único en 24 h; `updatedAt` en cada cambio; transiciones con `applyTransition`; publicar el evento por WebSocket solo después del `COMMIT`.

### 7.4 Protocolo WebSocket propuesto (tiempo real)
Decisión del usuario (D5): WebSocket (backend probablemente FastAPI + Python; conexión bidireccional para "Llamar al mozo" en la 002).

**Endpoint y suscripción.** `wss://<host>/ws/orders` (`ws://` en desarrollo). Se fija al abrir con query params, que salen de `SubscriptionFilter`:
- `{ kind: 'tables', tableIds: [12, 5] }` → `/ws/orders?tableId=12&tableId=5`: eventos de pedidos de esas mesas (el cliente sigue las mesas de sus pedidos activos más la actual).
- `{ kind: 'staff' }` → `/ws/orders?scope=staff`: todos los pedidos (panel 002).
- Validación en el handshake: mesas existentes, `scope` conocido, `Origin` permitido.

| Código de cierre | Significado | El cliente reintenta |
|---|---|---|
| 1000 | Cierre normal (sin listeners) | No |
| 4400 | Parámetros inválidos | No (permanente) |
| 4404 | Alguna mesa no existe | No (permanente) |
| 4408 | Sin `system.pong` durante dos intervalos | Sí |
| 1001 / 1006 / 1011 / otros | Servidor reiniciando, red caída, error interno | Sí |

**Sobre común** (ambos sentidos):
```ts
export interface WsEnvelope<TType extends string = string, TPayload = unknown> {
  v: 1; id: string; type: TType; ts: string; payload: TPayload;      // id: UUID para descartar duplicados
}
```

**Servidor → cliente**
| `type` | `payload` | Cuándo |
|---|---|---|
| `system.welcome` | `{ connectionId; heartbeatSec; subscription: { tableIds: number[] } \| { scope: 'staff' } }` | Primer mensaje de cada conexión |
| `order.created` | `{ order: Order }` | Después del `COMMIT` |
| `order.status_changed` | `{ order: Order; previousStatus: OrderStatus }` | Después del `COMMIT` |
| `system.ping` | `{}` | Cada `heartbeatSec` (25 s) |
| `system.error` | `{ code: 'BAD_MESSAGE' \| 'NOT_IMPLEMENTED' \| ServiceErrorCode; message }` | Mensaje inválido (no cierra) |
| `table.waiter_called` | `{ callId; tableId; at }` | **Reservado 002** (solo `staff`) |

**Cliente → servidor**
| `type` | `payload` | Cuándo |
|---|---|---|
| `system.pong` | `{}` | Respuesta a cada `system.ping` |
| `table.call_waiter` | `{ tableId; note? }` | **Reservado 002**; en la 001 no se envía (el servidor puede responder `NOT_IMPLEMENTED`) |

Los clientes **ignoran** cualquier `type` desconocido.

**Heartbeat.** Ping cada 25 s; si el cliente no recibe ningún mensaje en 50 s, cierra y reconecta; si el servidor no recibe `pong` en dos intervalos, cierra con 4408.

**Reconexión con backoff.** Cierres reintentables: espera `min(30 s, 1 s × 2^intento)` ± 20 % de jitter; contador a cero al recibir `system.welcome`; reconexión inmediata en `visibilitychange` (visible) y `online`; sin reintento con 4400/4404.

**Re-sincronización por REST después de CADA `system.welcome` (también el primero).** El adaptador guarda, por suscripción, `lastSeen` = mayor `updatedAt` recibido. Primera conexión: `since = momento de subscribe() − 5 s`. Consulta: mesas → `GET /api/orders?tableId=…&since=<lastSeen>`; staff → `GET /api/orders?since=<lastSeen>` (**todos los estados**, también `delivered` y `cancelled`, para que el panel no deje pedidos fantasma). Por cada pedido devuelto emite `order.created` si no lo conocía u `order.status_changed` con el estado que conocía; luego entrega lo que llegó en vivo durante la consulta. Así no hay huecos entre la carga inicial del consumidor (que también suscribe primero) y la conexión.

**Orden y duplicados.** Descarta `id` de sobre ya vistos (últimos 200) y aplica `mergeOrder` (el del dominio): nunca entrega un pedido con `updatedAt` anterior al conocido.

**En el frontend (futuro `services/http/`).** Una conexión por filtro (compartida entre listeners del mismo filtro; si cambia la lista de mesas se abre una nueva y se cierra la anterior con 1000); traduce `order.*` a `OrderEvent`. `OrderService` no cambia; el mock tampoco.

**Lado FastAPI (sugerencia).** `@app.websocket("/ws/orders")` con `tableId: list[int] = Query([])` y `scope: str | None = Query(None)`; administrador de conexiones por mesa y `staff`; publicar después del `COMMIT`; tarea de heartbeat por conexión; con varios workers, pub/sub compartido (por ejemplo Redis), fuera de la 001.

---

## 8. Idiomas (i18n)

- Diccionarios planos `es.ts` (fuente) y `en.ts` (`satisfies Record<keyof typeof es, string>`) + test de claves en runtime.
- `t(key, vars?)`: interpolación `{name}`; plurales `_one` / `_other` con `Intl.PluralRules`.
- `formatPrice(cents, lang)`: `Intl.NumberFormat(lang === 'es' ? 'es-AR' : 'en-US', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 })`.
- `formatTime(iso, lang)`: `Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })`.
- `localize(text, lang)`: `text[lang] ?? text.es`.
- Español por defecto, sin detectar el idioma del navegador. Presupuesto de largo +30-40 %. Sin rayas (—) en textos de UI.

| Clave | ES | EN |
|---|---|---|
| hero.title | Pedí desde\ntu mesa | Order from\nyour table |
| hero.subtitle | Elegí tus platos, personalizalos y mandá el pedido directo a la cocina. | Pick your dishes, make them yours and send the order straight to the kitchen. |
| hero.cta | Ver la carta | See the menu |
| table.badge | Mesa {n} | Table {n} |
| table.notice | Para pedir, escaneá el código QR de tu mesa o pedile ayuda al personal. | To order, scan the QR code on your table or ask our staff. |
| table.checking | Verificando tu mesa | Checking your table |
| table.unverified | No pudimos verificar tu mesa. Revisá tu conexión. | We couldn't verify your table. Check your connection. |
| common.retry | Reintentar | Try again |
| dish.add | Agregar | Add |
| dish.soldOut | Agotado | Sold out |
| dish.required_one / _other | Elegí 1 opción / Elegí {count} opciones | Choose 1 option / Choose {count} options |
| dish.maxReached | Podés elegir hasta {max} | You can choose up to {max} |
| dish.added | Agregado: {name} × {qty} | Added: {name} × {qty} |
| cart.maxPerDish | Máximo 20 por plato | Maximum 20 per dish |
| cart.view | Ver pedido | View order |
| cart.remove | Quitar | Remove |
| cart.send | Enviar pedido | Send order |
| cart.sending | Enviando pedido | Sending order |
| cart.edit | Editar pedido | Edit order |
| cart.error.network | No pudimos enviar el pedido. Revisá tu conexión y probá de nuevo. | We couldn't send your order. Check your connection and try again. |
| cart.error.unresolved | No sabemos si el pedido llegó. Reintentá: no se va a duplicar. | We don't know if your order arrived. Try again: it won't be duplicated. |
| cart.error.validation | No pudimos procesar el pedido. Revisá cantidades y notas. | We couldn't process your order. Check quantities and notes. |
| cart.line.dish_unavailable | Este plato ya no está disponible. Quitalo para continuar. | This dish is no longer available. Remove it to continue. |
| cart.line.dish_not_found | Este plato ya no está en la carta. Quitalo para continuar. | This dish is no longer on the menu. Remove it to continue. |
| cart.line.option_unavailable | Una opción elegida ya no está disponible. Quitá el plato y volvé a agregarlo. | A chosen option is no longer available. Remove the dish and add it again. |
| cart.line.option_not_found | Una opción elegida ya no existe. Quitá el plato y volvé a agregarlo. | A chosen option no longer exists. Remove the dish and add it again. |
| cart.line.selection_invalid | Las opciones de este plato cambiaron. Quitalo y volvé a agregarlo. | This dish's options changed. Remove it and add it again. |
| cart.price.title | El total cambió | The total changed |
| cart.price.body | Antes {old}, ahora {new}. | Before {old}, now {new}. |
| cart.price.accept | Aceptar y enviar | Accept and send |
| cart.price.review | Revisar pedido | Review order |
| orders.title | Mis pedidos | My orders |
| orders.table | Mesa {n} | Table {n} |
| orders.sent | Pedido enviado | Order sent |
| orders.more | Pedir algo más | Order something else |
| orders.empty | Todavía no enviaste pedidos desde este celular. | You haven't sent any orders from this phone yet. |
| orders.cancelled | Este pedido fue cancelado. Consultá con el personal. | This order was cancelled. Please ask our staff. |
| orders.delayed | Tu pedido está tardando, avisá al mozo. | Your order is taking a while, please tell your server. |
| orders.announce | Pedido {code}: {status} | Order {code}: {status} |
| orders.active_one / _other | Mis pedidos, 1 activo / Mis pedidos, {count} activos | My orders, 1 active / My orders, {count} active |
| orders.news | Hay novedades en tus pedidos | There are updates on your orders |
| status.pending … status.cancelled | Enviado, Confirmado, En preparación, Listo para servir, Entregado, Cancelado | Sent, Confirmed, Being prepared, Ready to serve, Served, Cancelled |
| menu.error | No pudimos cargar la carta. | We couldn't load the menu. |
| menu.offline | Estás sin conexión. | You're offline. |
| menu.empty | La carta no está disponible en este momento. Consultá al personal. | The menu isn't available right now. Please ask our staff. |

---

## 9. Lenguaje visual (adaptado de las referencias)

### 9.1 Qué se toma de cada referencia y cómo se adapta
| Referencia | Se abstrae | Adaptación al restaurante | Se ignora |
|---|---|---|---|
| `ref1-menu.md` (principal) | Escenario oscuro con brillo inferior; píldora de navegación de vidrio con borde de 1 px; badge con azulejo de ícono; **botón con banco de luz al pie recortado por su propio radio**; titular enorme en mayúsculas con barrido de entrada; **anillo 3D en perspectiva** con giro lento, recorte y sombreado hacia los bordes; el mock de navegador que tapa el tercio inferior del anillo; botón flotante con pulso; timeline de entrada única con EXPO/SOFT y distancias ×0,66 en celular | Luz cian → **luz de brasa**; badge → **"Mesa 12"**; tarjetas del anillo → **platos destacados pedibles**; mock de navegador → **panel de la carta**; botón WhatsApp → **CartBar** con "ping" único; starfield → **chispas** estáticas | Canvas 1172×657, tabla de coordenadas, type fitter, textos, URLs de CloudFront, SVG del logo/rayo, creativos |
| `ref2-dashboard-securify.md` | Píldoras `neutral-900/90` + blur; tipografía gigante escalonada en `vw` | TopBar, CategoryTabs y Toast de vidrio; escala en `clamp()`; en la 002, números gigantes | Video, textos, logo |
| `ref3-alertas-cargox.md` | Condensada 800 en mayúsculas; EXPO_OUT `[0.16,1,0.3,1]`; `AnimatePresence`; tap `scale .97` | Barlow Condensed para display; mismas curvas; hojas y Toast con `AnimatePresence` | Mockup de iPhone, mapa, camiones, formulario |

### 9.2 Paleta y contraste por superficie
Un único acento: **brasa**. Colores de estado semánticos. `ash-500` se subió de `#8a7f75` a `#9a8f84` porque no llegaba a 4,5:1 sobre `coal-800` (4,41:1) ni `coal-700` (3,91:1).

| Token | Hex | Uso |
|---|---|---|
| `coal-950` | `#0c0a09` | Escenario (fondo) |
| `coal-900` | `#15120f` | Panel de la carta, filas |
| `coal-800` | `#1f1a16` | Hojas, Toast |
| `coal-700` | `#2b241e` | Pistas, separadores sólidos, botón deshabilitado |
| `bone-50` | `#f6f1eb` | Texto principal |
| `ash-300` | `#b3a89d` | Texto secundario |
| `ash-500` | `#9a8f84` | Texto terciario, íconos inactivos, texto de deshabilitado |
| `ember-300` | `#ffc58a` | Núcleo de luz (decorativo, no texto) |
| `ember-400` | `#ff9a3d` | Precios destacados, anillo de foco |
| `ember-500` | `#f2711c` | Acento (indicadores, estado actual, punto de novedad) |
| `ember-700` | `#8f3510` | Bordes de acento, azulejos (decorativo, no texto) |
| `herb-400` | `#8fcf8a` | "Listo para servir" / éxito |
| `chili-400` | `#ff6b5e` | Error, "Cancelado", demora |
| hairline | `rgb(255 240 225 / .10)` | Bordes de 1 px (decorativo) |

Contraste calculado (WCAG 2.1) de cada color de texto sobre cada superficie. Regla: **ningún texto se usa en una combinación < 4,5:1**; los íconos y bordes de componentes necesitan ≥ 3:1.

| Texto \ Superficie | coal-950 | coal-900 | coal-800 | coal-700 |
|---|---|---|---|---|
| bone-50 | 17,6 | 16,7 | 15,4 | 13,6 |
| ash-300 | 8,5 | 8,0 | 7,4 | 6,6 |
| ash-500 | 6,3 | 5,9 | 5,5 | 4,8 |
| ember-400 | 9,4 | 8,9 | 8,2 | 7,2 |
| ember-500 | 6,7 | 6,4 | 5,9 | 5,2 |
| herb-400 | 10,8 | 10,2 | 9,4 | 8,3 |
| chili-400 | 7,1 | 6,7 | 6,2 | 5,5 |

El texto del botón brasa (`bone-50`) se apoya en el cuerpo `#140f0c` (≈ 17:1); el banco de luz queda bajo la línea de base del texto. Fondo del escenario: `linear-gradient(180deg, transparent 38%, rgb(242 113 28 / .045) 56%, rgb(242 113 28 / .065) 70%, rgb(242 113 28 / .03) 100%), coal-950`.

### 9.3 Tipografía
- **Display:** Barlow Condensed 800 (titular, categorías, nombre en la ficha) y 600 (precios, `tabular-nums`). **Texto:** Barlow 400/500/600. *Descartada:* Playfair Display SC + Karla (`ui-ux-pro-max`; serif por defecto, contraria a las referencias).

| Rol | Familia | Tamaño | Interlineado | Tracking |
|---|---|---|---|---|
| Titular portada | Condensed 800, MAYÚSCULAS | `clamp(3.25rem, 16vw, 6rem)` | 0.86 | -0.01em |
| Título de categoría | Condensed 800, MAYÚSCULAS | `clamp(2rem, 9vw, 2.75rem)` | 0.9 | -0.005em |
| Nombre en ficha | Condensed 800, MAYÚSCULAS | `clamp(2rem, 8vw, 2.5rem)` | 0.92 | 0 |
| Nombre en fila | Barlow 600 | 1.0625rem | 1.25 | 0 |
| Cuerpo | Barlow 400 | 1rem (mín. 0.9375rem) | 1.5 | 0 |
| Precio | Condensed 600 | 1.25rem | 1 | 0.01em |
| Etiquetas y botones | Barlow 500/600, sentence case | 0.9375-1rem | 1 | 0.005em |
| Inputs | Barlow 400 | **16px** | 1.4 | 0 |

Mayúsculas solo en display; sin eyebrows. Titular con `text-wrap: balance` y sombra `0 0 34px rgb(255 150 80 / .18)`.

### 9.4 Forma, capas, espaciado y objetivos táctiles
- **Radios:** controles 14 px; filas/azulejos 16 px; tarjetas del anillo 16 px; hojas 28 px arriba; TableBadge 12 px; píldoras (TopBar, CategoryTabs, CartBar, SegmentedControl, Toast) radio completo.
- Filas con hairlines, sin cajas; elevación solo en hojas, barras y Toast.
- **Capas (`--z-*`):** escenario 0 · anillo 5 · panel 10 · CategoryTabs 20 · TopBar 30 · Toast 35 · CartBar 40 · hojas en top layer de `<dialog>`.
- Espaciado base 4 px; márgenes laterales 16 px (celular), 24 px (≥ 768 px).
- **44 × 44 px mínimo** en: cada opción de `LanguageToggle`, cada tab de `CategoryTabs` (alto 44), botones de `QuantityStepper`, "Quitar", cierre de hojas (botón X además de la manija), "Mis pedidos", cierre del Toast, opciones de radio/checkbox (fila completa de 48 px).

### 9.5 Componentes firma
**Botón "brasa" (`GlowButton`, `.btn-ember`)**, adaptación del Pixel Contract B de ref1:
- Cuerpo `#140f0c`; **banco de luz de ~18 px al pie** como `background` multi-stop recortado por el propio radio con `overflow: hidden`:
  `linear-gradient(to top, #ffe2bf 1px, #ffc88f 2px, #ffae63 3px, #ff9440 4px, #f97a22 5px, #e2620f 6px, #c9520b 7px, #ad450b 8px, #8f3a0c 9px, #6e2d0b 10px, #55240c 12px, #4a210d 13px, #3d1c0d 14px, #2e170d 16px, #23130d 18px, #1c110c 20px, #17100c 24px, #140f0c 30px, #140f0c 100%)`.
- `::after`: luz de borde lateral de 13 px **enmascarada** (tono `rgb(255 214 170 / .7)`).
- Sombras de la ref adaptadas; **sin halo exterior** mayor a 8 px de blur.
- Variante `streak` (raya de 2 px arriba) solo en la CartBar.
- Estados: `:active` `scale(.97)` 120 ms; hover (puntero fino) `brightness(1.08)` + `translateY(-1px)`; **deshabilitado = brasa apagada** (banco `coal-700`, texto `ash-500`); **cargando** → `aria-busy="true"`, "Enviando pedido", banco que "respira" salvo movimiento reducido.
- `<button type="button">` con texto; 52 px (primario) / 60 px (CartBar).

**TopBar:** fija, `top: calc(env(safe-area-inset-top) + 8px)`, márgenes 12 px, alto 56 px, `max-width: 680px`; `rgb(21 18 15 / .72)` + `backdrop-filter: blur(16px) saturate(140%)`, borde hairline. Marca, `LanguageToggle` y "Mis pedidos" (contador + punto `ember-500` de novedad; nombre accesible "Mis pedidos, 2 activos, hay novedades").

**TableBadge:** alto 36 px, radio 12; azulejo 28 × 28 a 4 px del borde con degradado brasa e ícono `ForkKnife`; texto a 42 px del borde.

**Toast (aviso de estado en la carta, RF47):** píldora de vidrio `coal-800/.9`, debajo de la TopBar, centrado, `max-width: 420px`; ícono del estado + "Pedido K7F2: Listo para servir" + botón "Ver" (va a "Mis pedidos") + cerrar (44 px). Dura `TOAST_MS` (4 s), uno a la vez (el nuevo reemplaza al anterior), se pausa mientras tiene foco o el puntero encima. El anuncio para lector de pantalla sale por la `LiveRegion` global (el Toast no es una región viva propia, para no duplicar).

**Anillo de platos destacados (`DishRing`):**
- `a = normalizar(i·paso + φ)` en [-180, 180); `|a| > cull` → oculto; si no `transform = translate3d(R·sin a, 0, R·(1 − cos a)) rotateY(−a)`.
- Celular: `R = 560`, `perspective = 560`, `n = 16` (22,5°), `cull = 48°`, carta 112 × 150, 3°/s. **Criterio a 320 y 375 px: 5 cartas visibles (la del frente completa y centrada), ninguna cortada por los bordes laterales salvo las dos extremas.** Desde 768 px: `R = 760`, `n = 20`, carta 140 × 186.
- Sombreado con capa de `opacity = min(.6, 1,2 · (1/cos a − 1))` (no `filter`).
- Se rellena ciclando los destacados **pedibles** (`featured && isDishOrderable`); si no hay, los primeros pedibles; si no hay ninguno, no se muestra.
- `useAnimationFrame` sobre refs; `dt = min(delta, 100 ms)`; pausa fuera de pantalla; quieto con movimiento reducido. `aria-hidden`, `pointer-events: none`.
- `ringMath.ts`: `ringCardState(index, phase, config) → { visible, transform, shade }`.

**Panel de la carta:** `section#carta`, `coal-900`, radio 28 px arriba, `margin-top` negativo para tapar el tercio inferior del anillo y asomar las CategoryTabs en el primer viewport.

**CartBar:** fija abajo (`env(safe-area-inset-bottom) + 12px`), `GlowButton wide + streak`: "Ver pedido" + contador + total. Ping único al agregar (WAAPI); con movimiento reducido, resaltado de borde por opacidad 1,5 s.

**Hojas (`Sheet`):** `<dialog>` modal a pantalla completa transparente, fondo `rgb(0 0 0 / .6)`, panel `coal-800`, radio 28 px, `max-height: 88dvh`, `overscroll-behavior: contain`, manija + botón cerrar, pie con zona segura. ≥ 768 px: `max-width: 560px`. `html:has(dialog[open]) { overflow: hidden }`.

**DishRow:** texto a la izquierda, `DishVisual` 96 × 96 a la derecha; toda la fila es un `<button>`; no pedible → `opacity .55`, "Agotado", `disabled`.

**DishVisual:** `imageUrl` → `<img loading="lazy">` con respaldo; si no, degradado según `category.visual` + ícono Phosphor (nombres confirmados contra el paquete en T6).

**StatusPill / OrderTimeline:** ícono + texto por estado (`PaperPlaneTilt`, `CheckCircle`, `CookingPot`, `BellRinging`, `ForkKnife`, `XCircle`). Timeline vertical: completos `bone-50`, actual `ember-500` con pulso (no final), futuros `coal-700`; "Listo" `herb-400`; cancelado y demora `chili-400`.

**EmberField:** un `div` de 1 px con `box-shadow` generado una vez con PRNG con semilla; estático.

### 9.6 Layout responsivo
- **Celular (< 768 px):** TopBar fija → portada (`min-height: min(100svh, 760px)`) → panel superpuesto → CartBar fija.
- **Tablet (≥ 768 px):** composición centrada, `max-width: 720px`.
- **Escritorio (≥ 1024 px):** portada centrada; carta en 2 columnas (`lg:grid-cols-2`); `max-width: 1120px`.
- `svh` para la portada, `dvh` para hojas.

---

## 10. Movimiento (motion)

Según `animate`, `emil-design-eng`, `apple-design` y `motion`: primero "¿debe animarse?", luego propósito, herramienta más barata, solo `transform`/`opacity` (+ `clip-path`), curvas fuertes, salida más rápida que entrada, movimiento reducido incluido.

### 10.1 Tokens (`ui/motion.ts` y espejo en `@theme`)
| Token | Valor | Uso |
|---|---|---|
| `--ease-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entradas de la portada (ref1/ref3) |
| `--ease-soft` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | Secundarios de la entrada (ref1) |
| `--ease-out-strong` | `cubic-bezier(0.23, 1, 0.32, 1)` | UI general |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Entrada de hojas |
| `SPRING.tab` | `{ type: 'spring', bounce: 0, duration: 0.35 }` | Indicador de categoría |
| `SPRING.sheetRelease` | `{ type: 'spring', bounce: 0.15, duration: 0.4 }` | Soltar una hoja tras un gesto con impulso |

### 10.2 Interacciones
| Interacción | Propósito | Herramienta | Propiedades | Curva y duración |
|---|---|---|---|---|
| Presión | Feedback | CSS `:active` | `scale(.97)` | 120 ms out-strong |
| Hover (puntero fino) | Feedback | CSS (`hover:` de Tailwind v4 ya condicionado) | `filter`, `transform` | 200 ms ease |
| Indicador de categoría | Estado | Motion `layoutId` | transform | `SPRING.tab` |
| Abrir hoja | Continuidad espacial | Motion + `AnimatePresence` | `translateY(100%→0)`, fondo opacity | 380 ms drawer; fondo 240 ms |
| Cerrar hoja | | Motion | mismo camino | 240 ms out-strong |
| Arrastrar hoja | Manipulación directa | `drag="y"` en la manija | motion value | cierra si `offset > 120px` o `velocity > 500px/s` |
| CartBar aparece/sale | Evitar salto | `AnimatePresence` | `translateY(110%)`, opacity | 300 / 200 ms out-strong |
| Contador | Estado | `AnimatePresence mode="popLayout"` | `translateY(±8px)`, opacity | 180 ms out-strong |
| Ping al agregar | Feedback | WAAPI | `scale(1→1.35)`, opacity .6→0 | 500 ms out-strong |
| Toast entra/sale | Estado | `AnimatePresence` | `translateY(-8px→0)`, opacity | 220 / 160 ms out-strong |
| Punto de novedad | Estado | CSS | `scale(.6→1)`, opacity | 200 ms out-strong |
| Errores en línea | Estado | Motion | opacity, `translateY(-4px→0)` | 180 ms out-strong |
| Cambio de estado del pedido | Estado | Motion | línea `scaleY`, punto opacity/color | 250 ms out-strong |
| Pulso del estado actual | Estado vivo | CSS en `::after` | `scale`, opacity | 2 s infinito; sin él con movimiento reducido |
| Tilde "Pedido enviado" | Deleite | Motion `pathLength` | trazo | 450 ms, 100 ms de demora |
| Anillo | Decorativo | `useAnimationFrame` + refs | transform + opacity | lineal 3°/s |
| Entrada de la portada | Deleite (una vez por sesión) | Motion variants | opacity, transform, clip-path | §10.3, **total ≤ 1,8 s** |

**Nunca:** `transition: all`, `scale(0)`, `ease-in` en UI, animar `width/height/top/left`, animaciones en acciones de teclado, `window.addEventListener('scroll')`. En la entrada (página cargando) usar **cadenas `transform` completas** en lugar de `x`/`y`/`scale`.

### 10.3 Timeline de entrada (ref1 §12 adaptado)
`D = 0.66` en < 768 px. No bloquea interacción; con `initial={false}` todo queda visible si se saltea. El último elemento termina a los 1,8 s (900 ms de demora + 900 ms).

| Elemento | Desde | Duración | Demora | Curva |
|---|---|---|---|---|
| TopBar | opacity 0, `translateY(-9·D px)` | 620 ms | 60 ms | expo |
| Marca / LanguageToggle / Mis pedidos | opacity 0, `translateY(6·D px)` | 520 ms | 150 / 185 / 215 ms | soft |
| TableBadge | opacity 0, `translateY(11·D px) scale(.985)` | 560 ms | 270 ms | expo |
| Titular línea 1 | opacity 0, `translateY(15·D px)`, `clip-path: inset(100% 0 -30% 0)` → `inset(-30% 0 -30% 0)` | 900 ms | 380 ms | expo |
| Titular línea 2 | igual | 900 ms | 470 ms | expo |
| Subtítulo | opacity 0, `translateY(10·D px)` | 620 ms | 690 ms | expo |
| CTA | opacity 0, `translateY(13·D px) scale(.985)` | 620 ms | 830 ms | expo |
| Anillo | opacity 0, `translateY(18·D px) scale(.99)` | 950 ms | 700 ms | expo |
| Panel de la carta | opacity 0, `translateY(26·D px)` | 900 ms | 900 ms | expo |

### 10.4 Accesibilidad del movimiento y materiales
- `MotionConfig reducedMotion="user"` + `useReducedMotion()`: sin entrada, anillo quieto, hojas y Toast con fundido de 200 ms, sin ping (resaltado por opacidad), `scrollIntoView({ behavior: 'auto' })`.
- CSS `prefers-reduced-motion`: sin pulso ni "respiración"; `prefers-reduced-transparency`: vidrio sólido `coal-900`; `prefers-contrast: more`: hairlines `rgb(255 255 255 / .3)`.
- Máximo dos superficies con `backdrop-filter` a la vez (TopBar y CartBar; el Toast usa fondo casi opaco sin blur).

---

## 11. Base nativa móvil (skill `mobile-native`, se entrega en T1)

- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">`, `<meta name="theme-color" content="#0c0a09">`, `<meta name="color-scheme" content="dark">`. Nunca `user-scalable=no` ni `maximum-scale`.
- `html`: `-webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; overscroll-behavior-y: none;`.
- `input, textarea, select { font-size: 16px }`; `enterkeyhint="done"` en notas.
- `button, [role=button], a { touch-action: manipulation; user-select: none }` (nunca en `body`).
- Zonas seguras en TopBar, CartBar, Toast y pies de hojas.
- CategoryTabs: `overflow-x: auto; scroll-snap-type: x proximity`.
- **Prueba en el celular por la red local sin HTTPS:** `npm run dev` con `--host` y se abre `http://192.168.x.x:5173/?mesa=12`. Ese origen no es "contexto seguro": `crypto.randomUUID` no existe ahí, por eso `createId()` usa `crypto.getRandomValues` como respaldo (probado en T2). `<dialog>`, `BroadcastChannel`, `localStorage` y `Intl.Segmenter` sí funcionan sin HTTPS.

### 11.1 Checklist en hardware real (paso manual del usuario, spec §8.6)
No lo ejecuta el agente implementador. El usuario lo corre al final de la spec en un celular real (iOS y/o Android):
1. Tocar botones y filas: sin destello gris/azul; feedback al presionar.
2. Escribir una nota: la página no hace zoom.
3. TopBar, CartBar, Toast y pie de hojas respetan notch y barra de inicio (vertical y horizontal).
4. Hoja abierta con el teclado visible: el botón "Agregar" sigue accesible.
5. Arrastrar la ficha hacia abajo: sigue al dedo y cierra con un gesto rápido.
6. "Atrás" del sistema con una hoja abierta: cierra la hoja.
7. Carrusel de la portada: gira sin tirones; la carta se desplaza fluida.
8. Dos pestañas (cliente y `window.__demo` desde la consola de escritorio, o `VITE_MOCK_AUTO_ADVANCE=true`): el estado avanza, aparece el Toast en la carta.

---

## 12. Decisiones y alternativas descartadas

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| D1 | Context + `useReducer` (carrito) y providers propios | Zustand / Redux / TanStack Query | Un solo estado compartido real; sin dependencias (`ponytail`). |
| D2 | Pantallas por hash + `history.state` + hojas con entrada de historial | React Router | Dos pantallas; "atrás" correcto (RF32, RF43) con poco código. Para la 002: segunda entrada de Vite (`panel.html` como input extra en `vite.config.ts`), que no necesita router ni regla de reescritura SPA. |
| D3 | Hojas sobre `<dialog>` nativo + Motion | Vaul / Radix Dialog | Foco, `inert` y Escape nativos. Costo: stub en jsdom. |
| D4 | Mock con `localStorage` + `BroadcastChannel` | Evento `storage` con diff / polling | Eventos explícitos iguales a los del backend. (El evento `storage` sí se usa para el registro local de pedidos, que es un dato y no un evento.) |
| D5 | WebSocket + REST, protocolo §7.4 (**confirmado por el usuario**) | SSE + REST | Backend probablemente FastAPI; bidireccional para "Llamar al mozo". Costo: reconexión, heartbeat y re-sync manuales, definidos en §7.4. |
| D6 | i18n propio tipado + `Intl` | i18next / react-intl | 2 idiomas, ~90 claves. |
| D7 | Centavos enteros | `number` decimal | Sin errores de redondeo. |
| D8 | TypeScript (**confirmado por el usuario**) | JavaScript + JSDoc | Contratos verificados en compilación. |
| D9 | Phosphor | Lucide / SVG a mano | `design-taste-frontend`. |
| D10 | Fontsource | `<link>` a Google Fonts | Sin dependencia externa en runtime. |
| D11 | Anillo con CSS 3D + `useAnimationFrame` sobre refs | Three.js / Swiper / estado por frame | Peso mínimo, sin re-renders. |
| D12 | Sombreado del anillo con `opacity` | `filter: brightness()` | Repintado por frame. |
| D13 | Layout fluido | Canvas escalado + type fitter de ref1 | Frágil; pedido del usuario. |
| D14 | `<button>` en todos los CTA | `<a href="#">` | HTML semántico. |
| D15 | Solo tema oscuro con tokens semánticos | Tema dual | Referencias oscuras; los tokens permiten sumar un tema claro. |
| D16 | Carrito e intento pendiente en `sessionStorage` por mesa, guardando IDs | `localStorage` / no persistir / guardar precios | Sobrevive a recargas, no reaparece otro día, precios vigentes. |
| D17 | Anillo decorativo | Cartas tocables | Objetivo en movimiento y duplicación inaccesible. |
| D18 | Filas con separadores | Tarjetas con caja | Evita el "kit SaaS". |
| D19 | Sin preselección | Opción por defecto | Elección consciente. |
| D20 | Tests en `tests/` | Junto al código | Convención del proyecto. |
| D21 | Sin adaptador REST/WebSocket en la 001 | Escribirlo "para después" | YAGNI; sus reglas de consistencia sí están en el dominio y se prueban. |
| D22 | Un celular por pedido, sin bloqueo por mesa (**usuario**) | Carrito compartido / bloqueo por mesa | Complejidad sin valor para la 001. |
| D23 | ARS y "Fogón" en `config.ts` (**usuario**) | Valores repartidos | Un solo lugar. |
| D24 | Idempotencia con intento persistido + bloqueo de edición mientras el resultado es desconocido + consulta por `clientRequestId` | Id en memoria / descartar el id al editar | Es la única forma de no duplicar tras recargas, timeouts o ediciones (RF26). |
| D25 | Reconfirmación de precio con `expectedTotalCents` y 409 sin registrar (**usuario, P1**) | Aceptar el total del servidor sin aviso | El cliente acepta lo que paga. |
| D26 | Reglas de consistencia (`mergeOrder`, `applyTransition`) en el dominio | Solo en el adaptador | La 001 las prueba y la 002 y el adaptador las reutilizan. |
| D27 | "Mis pedidos" por dispositivo y de todas las mesas (**usuario, P3**) | Filtrar por mesa actual | El cliente que cambia de mesa no pierde sus pedidos. |
| D28 | `TableService` separado para "Llamar al mozo" (solo documentado) | Ampliar `OrderEvent` / `OrderService` | El contrato de pedidos no cambia (RNF9). |
| D29 | `axe-core` en tests + Lighthouse en la verificación final | Solo revisión manual | RNF2 necesita un criterio medible. |
| D30 | `createId()` con respaldo `getRandomValues` | Servir HTTPS en desarrollo | Funciona en `http://` por IP local sin certificados. |

---

## 13. Estrategia de tests y verificación

### 13.1 Capas
| Capa | Herramienta | Qué se prueba |
|---|---|---|
| Unitaria | Vitest | `domain/*`, `lib/id`, `i18n/format`, `ringMath`, `services/storage` |
| Servicio | Vitest + fakes (`fakeChannel`, storage en memoria, `now`, `random`, timers falsos) | mock, idempotencia, precio, eventos, dos instancias = dos pestañas, ayudas de demo |
| Componente | Testing Library + user-event + `axe-core` | comportamiento por rol y nombre accesible; `expectNoA11yViolations` en cada pantalla y hoja |
| Integración | Testing Library sobre `<App/>` con mock sin latencia | flujo QR → pedido → estado (T9) |
| Visual (constitución §3) | MCP de Chrome DevTools | **en cada tarea con UI:** 375 × 812 y 320 × 568 (y lo que la tarea indique); la última repite 320/375/768/1280 con y sin movimiento reducido |
| Rendimiento (RNF3) | DevTools Performance, CPU ×4 | INP < 200 ms; sin tareas largas > 50 ms al desplazar con el anillo visible (T10) |
| Accesibilidad (RNF2) | Lighthouse + teclado | Lighthouse accesibilidad ≥ 95 en carta, ficha, resumen y "Mis pedidos"; recorrido completo con teclado (T10) |
| Hardware real | celular por IP local | checklist §11.1, **paso manual del usuario** |

### 13.2 Reglas
- **TDD estricto:** tests en rojo → mínimo para verde → triangular → refactor en verde.
- Consultas por `getByRole` / `getByLabelText` (sin `data-testid` salvo el anillo).
- Animaciones en tests: `MotionConfig` sin duración; esperar con `findBy*` / `waitFor`.
- Stubs de jsdom en `tests/setup.ts` (§2). `vi.useFakeTimers()` para Toast, `useNow`, `autoAdvance`, demoras.
- Sin aserciones triviales.
- `npm test` en verde (y `npm run build` sin errores) para marcar una tarea.
- **Cada reporte del implementer** termina con "🛠️ Skills Aplicadas" y con la evidencia de la verificación visual de la tarea.

### 13.3 Matriz de cobertura
| Requisito | Tarea | Prueba principal |
|---|---|---|
| RF1 | T2, T5 | `domain/table.test.ts`; `state/TableContext.test.tsx`; `features/menu/TableNotice.test.tsx` |
| RF2 | T2, T5, T7, T8 | `table.test.ts`; `TableNotice.test.tsx`; `dish/DishSheet.test.tsx` (sin "Agregar"); `cart/CartSheet.test.tsx` (enviar deshabilitado sin mesa válida) |
| RF3 | T5 | `TableContext.test.tsx` |
| RF4 | T5, T10 | `layout/TopBar.test.tsx` (marca); `hero/Hero.test.tsx` (mesa, titular, CTA, destacados) |
| RF5 | T10 | `hero/useIntroOnce.test.tsx` |
| RF6 | T7, T10 | `ui/Sheet.test.tsx`; `useIntroOnce.test.tsx`; `hero/DishRing.test.tsx` |
| RF7 | T2, T6 | `domain/menuOrder.test.ts`; `menu/MenuScreen.test.tsx`; `menu/DishRow.test.tsx` |
| RF8, RF9, RF10 | T6 | `MenuScreen.test.tsx` |
| RF11, RF12 | T6 | `menu/CategoryTabs.test.tsx` |
| RF13 | T2, T6 | `domain/selection.test.ts` (`isDishOrderable`); `DishRow.test.tsx` |
| RF14 | T7 | `DishSheet.test.tsx` |
| RF15, RF16, RF17 | T2, T7 | `selection.test.ts`; `dish/OptionGroupField.test.tsx` |
| RF18 | T2, T7 | `domain/pricing.test.ts`; `DishSheet.test.tsx` |
| RF19 | T2, T7 | `domain/cart.test.ts` (`addQuantity` con tope); `DishSheet.test.tsx` (anuncio, "Máximo 20 por plato", reducido) |
| RF20 | T2, T7, T8 | `cart.test.ts`; `domain/text.test.ts`; `ui/QuantityStepper.test.tsx`; `dish/NoteField.test.tsx`; `CartSheet.test.tsx` ("Quitar") |
| RF21 | T8 | `cart/CartBar.test.tsx` |
| RF22 | T2, T8 | `cart.test.ts`; `CartSheet.test.tsx` |
| RF23 | T7 | `state/CartContext.test.tsx` (incluye intento pendiente) |
| RF24, RF26 | T3, T8 | `services/mockOrderService.test.ts` (idempotencia, conflicto); `state/useSubmitOrder.test.tsx` (doble toque, bloqueo, reintento con el mismo id, resolución tras recargar, timeout con pedido creado) |
| RF25 | T8, T9 | `CartSheet.test.tsx`; `orders/OrdersScreen.test.tsx` |
| RF27 | T3, T8 | `mockOrderService.test.ts` (`LINES_REJECTED`); `CartSheet.test.tsx` (motivo por línea) |
| RF28 | T2, T8, T9 | `domain/myOrders.test.ts`; `state/myOrdersStore.test.ts`; `state/MyOrdersContext.test.tsx` (todas las mesas, otra pestaña); `OrdersScreen.test.tsx` (mesa por pedido, final visible hasta salir) |
| RF29 | T9 | `MyOrdersContext.test.tsx`; `OrdersScreen.test.tsx` (texto del anuncio, sin anuncio en la carga) |
| RF30 | T2, T9 | `domain/orderMerge.test.ts`; `MyOrdersContext.test.tsx` (refresh no retrocede) |
| RF31 | T9 | `orders/OrderCard.test.tsx` |
| RF32 | T5, T9 | `app/useHashScreen.test.tsx`; `app/CustomerApp.test.tsx` (back, scroll) |
| RF33, RF35 | T4 | `i18n/I18nContext.test.tsx`; `i18n/format.test.ts` |
| RF34 | T4, T6, T7, T9 | `I18nContext.test.tsx`; `DishRow.test.tsx`; `DishSheet.test.tsx` (CL19: selección conservada); `OrdersScreen.test.tsx` |
| RF36 | T2, T3 | `domain/shortCode.test.ts`; `mockOrderService.test.ts` |
| RF37 | T2, T3 | `domain/orderStatus.test.ts` (`applyTransition`); `mockOrderService.test.ts` |
| RF38 | T3 | `mockOrderService.test.ts` |
| RF39, RF40 | T3, T9 | `mockOrderService.test.ts` (dos instancias); `MyOrdersContext.test.tsx` |
| RF41 | T5 | `TableContext.test.tsx` (unverified, retry, online) |
| RF42 | T5, T9 | `TopBar.test.tsx`; `OrdersScreen.test.tsx` (CL30) |
| RF43 | T7 | `app/useBackToClose.test.tsx`; `DishSheet.test.tsx` |
| RF44 | T2, T8 | `domain/lineValidation.test.ts`; `CartSheet.test.tsx` (CL27) |
| RF45 | T6 | `state/useMenu.test.tsx` |
| RF46 | T3, T8 | `mockOrderService.test.ts` (`PRICE_CHANGED`); `cart/PriceChangeNotice.test.tsx`; `useSubmitOrder.test.tsx` |
| RF47 | T9 | `CustomerApp.test.tsx` (Toast en la carta, novedad); `ui/Toast.test.tsx` |
| RF48 | T2, T9 | `domain/delay.test.ts`; `OrderCard.test.tsx` (aparece a los 10 min con timers falsos) |
| RNF1 | T1, T5-T10 | verificación visual por tarea |
| RNF2 | T1 + todas las de UI, T10 | `expectNoA11yViolations`; Lighthouse ≥ 95 y teclado en T10 |
| RNF3 | T10 | traza de rendimiento con CPU ×4 |
| RNF4, RNF10 | T3, T9 | `ServicesContext.test.tsx`; `MyOrdersContext.test.tsx` con `fakeOrderService` (suscribir primero, buffer, sin duplicados ni retrocesos) |
| RNF8 | T3, T4, T7, T8, T10 | storage que lanza error en `storage.test.ts`, `I18nContext`, `CartContext`, `myOrdersStore`, `useIntroOnce` |
| RNF9 | T10 | revisión del contrato §7.3-§7.4 con el compañero (registrada en el reporte) |
| Flujo completo | T9 | `app/flow.test.tsx` |
| `createId` sin contexto seguro | T2 | `lib/id.test.ts` (con y sin `randomUUID`) |
| Ayudas de demo | T3 | `services/demoHelpers.test.ts` |

**Adaptador WebSocket (fuera de la 001, D21):** su tarea futura probará con un `WebSocket` falso: backoff, silencio de 50 s, `pong`, cierres permanentes, re-sync tras cada `welcome` con `since`, descarte por `id`, `mergeOrder` y que `OrderService` no cambie.

---

## 14. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| jsdom no implementa `<dialog>`, `IntersectionObserver`, layout ni contraste | Stubs en `tests/setup.ts`; geometría en funciones puras; contraste por tabla (§9.2) y Lighthouse. |
| Rendimiento del anillo y `backdrop-filter` en Android de gama media | Solo transform/opacity, recorte, pausa fuera de pantalla, máx. 2 blur; medición en T10 y checklist §11.1. |
| Navegadores fuera de objetivo (Safari < 16.4, Chrome < 111, Firefox < 128) | Fuera de soporte (Tailwind v4 los requiere; spec, supuesto 11). |
| `crypto.randomUUID` ausente en `http://` por IP local | `createId()` con respaldo `getRandomValues` (T2). |
| Concurrencia entre pestañas en el mock | Releer antes de escribir; "última gana" aceptado en demo. |
| El backend difiere del contrato | Contrato §7.3-§7.4 como propuesta; solo cambia `services/http/` + `services/index.ts`. |
| WebSocket suspendido o cortado sin aviso | Heartbeat, silencio de 50 s, backoff, reconexión inmediata, re-sync tras cada `welcome`. |
| Eventos perdidos o duplicados | Suscribir primero + buffer, `mergeOrder`, re-sync con `since`, descarte por `id`. |
| **Sin login (riesgo aceptado para la demo, decisión del usuario P7):** cualquiera con la URL puede seguir los avisos de una mesa y, con la 002, cambiar estados | Pedidos sin datos personales; validación de `Origin` y de mesas; `scope=staff` y `PATCH` deberán exigir autenticación del personal antes de cualquier uso real (con el backend, fuera de la 001). |
| Varios workers de FastAPI no comparten conexiones | Pub/sub en el backend, fuera de la 001. |
| Desvío de la constitución (Live Server, `node --test`) | §1.2; el coordinador indica `npm test` al delegar. |

---

## 15. Qué hereda la Spec 002

- `src/domain/*`: tipos, `canTransition`, `applyTransition` (no-op y conflicto), `mergeOrder` / `upsertOrders`, `isDelayed` con `PENDING_DELAY_MINUTES = 10` (el panel marca los pedidos demorados con la misma regla), precios, códigos.
- `src/services/contracts.ts` (`listOrders` con `since`, `updateOrderStatus` con `expectedStatus`, `subscribe` con `{ kind: 'staff' }`) y el mock con sincronización entre pestañas y `window.__demo`.
- Protocolo §7.4: `scope=staff` y los mensajes reservados `table.call_waiter` / `table.waiter_called` con el `TableService` separado (§7.1).
- `src/ui/*`: `GlowButton`, `GlassPill`, `IconTile`, `Sheet`, `SegmentedControl`, `StatusPill`, `Toast`, `LiveRegion`, `Skeleton`, `motion.ts`.
- Tokens de `@theme` con la tabla de contraste; i18n.
- Entrada propia `panel.html` en Vite (D2). Lenguaje sugerido desde ref2/ref3: números gigantes condensados para contadores y demoras; "Activar sonido" como `GlowButton`.
