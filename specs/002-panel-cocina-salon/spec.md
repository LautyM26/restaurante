# Spec 002: Panel de cocina y salón

- **Estado:** aprobado (por el usuario, 2026-10-20)
- **Fecha:** 2026-10-17
- **Autor:** @planner
- **Spec anterior:** 001, base del proyecto y menú del cliente (aprobada y cerrada). Esta spec reutiliza su modelo de pedido, sus reglas y su kit visual sin redefinirlos.

> Este documento describe el QUÉ y el POR QUÉ. El CÓMO (arquitectura, archivos, contratos, lenguaje visual concreto, tests) está en `plan.md`.
> Las marcas **(decidido, P#)** remiten a las decisiones que tomó el usuario el 2026-10-20 (§9): aprobó todas las recomendaciones.
> Las diferencias con las specs del backend de Uriel (el compañero) y su resolución o acción pendiente están en §10.

---

## 0. Contexto y objetivo

### Problema
Con la Spec 001 el cliente ya envía su pedido desde la mesa, pero del lado del restaurante nadie lo recibe: hoy solo se pueden mover estados desde la consola (`window.__demo`). La cocina necesita ver las comandas apenas llegan, en orden, con sus opciones y notas, y avisar cuando están listas; el salón necesita saber qué llevar a cada mesa y enterarse si algo se canceló. Si un aviso se pierde (una cancelación que nadie vio, un pedido que quedó sin confirmar), el error llega a la mesa.

### Objetivo de esta spec
1. Entregar el **panel del personal**: un tablero en tiempo real, estilo Kanban, donde cocina y salón ven las comandas activas por estado y las hacen avanzar con un toque.
2. Agregar un **sistema de alertas** que avise de forma visual, sonora y accesible lo que importa (pedido nuevo, listo, cancelado, demorado, conexión caída) con prioridades, sin saturar.
3. **Proteger el panel con autenticación del personal** (la carta del cliente sigue pública), definiendo el lado del frontend y proponiendo al backend lo que falta del contrato.

### Usuarios y escenarios
- **Cocina.** Tablet de 10" en horizontal apoyada en la mesada o en la pared, a 1-1,5 m. Manos ocupadas o mojadas, ruido de campana y extractor, luz fuerte. Mira el tablero de reojo. *Escenario:* entra un pedido de la mesa 12 → suena y aparece en "Nuevas" → el cocinero toca "Confirmar", después "Empezar" y, al terminar, "Listo".
- **Salón (mozos).** Tablet en la barra o el celular del mozo, en movimiento. *Escenario:* suena "listo" → ve "Mesa 12 · K7F2" en "Listas para servir" → lleva el plato y toca "Entregar".
- Ambos usan el mismo usuario del personal y los mismos permisos; la **estación** (Cocina o Salón) solo cambia qué se destaca (decidido, P6).

### Por qué un dashboard oscuro tipo SaaS
Pedido explícito del usuario, basado en las referencias 2 (`docs/referencias/ref2-dashboard-securify.md`) y 3 (`docs/referencias/ref3-alertas-cargox.md`): oscuro, elegante y limpio, con tarjetas tipo Kanban y modales y alertas dinámicos. El panel mantiene la identidad "Fogón" de la 001 (carbón + brasa) y prioriza que se lea rápido y a distancia. La estética nunca debe tapar una alerta ni demorar una acción.

---

## 1. Glosario

| Término | Definición |
|---|---|
| **Panel** | La aplicación del personal, en una dirección propia, distinta de la carta del cliente. |
| **Personal** | Cocina y salón. Un único rol con los mismos permisos (spec del backend, S5). |
| **Sesión del personal** | Período en que un usuario del personal está autenticado en un dispositivo. Tiene vencimiento y puede renovarse sin volver a escribir la contraseña mientras no termine el turno. |
| **Estación** | Vista elegida en el dispositivo: **Cocina** o **Salón**. Define columnas, acciones destacadas y alertas (§3.2). |
| **Comanda** | Un pedido tal como lo ve el personal (mismo `Order` de la 001). |
| **Tablero** | Conjunto de columnas con las comandas activas. |
| **Columna** | Agrupa comandas por estado (§3.2). |
| **Tarjeta** | Representación de una comanda en una columna. |
| **Acción principal** | El botón de una tarjeta que la pasa al estado siguiente (Confirmar, Empezar, Listo, Entregar). |
| **Alerta** | Aviso del panel con prioridad **crítica**, **alta** o **informativa** (§3.4). |
| **Cola de alertas** | Orden en que se muestran las alertas pendientes. |
| **Demorada** | Comanda con 10 minutos o más en `pending` (regla compartida con la 001, `isDelayed`). |
| **Conexión en vivo** | El canal por el que llegan los avisos en tiempo real. Puede estar *en vivo*, *reconectando* o *sin conexión*. |
| **Llamada de mesa** | Aviso "Llamar al mozo" enviado desde la carta del cliente (decidido, P12). |

---

## 2. Requisitos funcionales (EARS)

Notación EARS como en la 001: **Ubicuo**, **Evento**, **Estado**, **No deseado**, **Opcional**.

### A. Acceso y sesión (dominio CRÍTICO: requiere aprobación explícita del usuario antes de implementar)
- **RF1 (Ubicuo):** El sistema deberá servir el panel en una dirección propia, separada de la carta del cliente, y no deberá mostrar comandas, nombres de platos ni ningún dato del restaurante, ni permitir acciones, sin una sesión válida del personal. La carta del cliente sigue siendo pública.
- **RF2 (Evento):** Cuando el personal abre el panel sin una sesión válida, el sistema deberá mostrar la pantalla de ingreso con correo y contraseña (decidido, P5), compatible con gestores de contraseñas y con pegar texto.
- **RF3 (Evento):** Cuando el personal envía credenciales válidas, el sistema deberá iniciar la sesión, aprovechar ese toque para habilitar el sonido (RF42) y llevarlo a la estación recordada en el dispositivo o, si no hay ninguna, a la elección de estación (RF10).
- **RF4 (No deseado):** Si las credenciales son incorrectas, entonces el sistema deberá mostrar "Correo o contraseña incorrectos" sin indicar cuál de los dos falló, conservar el correo y vaciar la contraseña; si hubo demasiados intentos, deberá pedir que espere; si no hay conexión o el servidor no responde, deberá explicarlo como un problema de conexión y permitir reintentar.
- **RF5 (Estado):** Mientras se verifica el ingreso, el sistema deberá indicar que está ingresando e impedir envíos repetidos.
- **RF6 (Evento):** Cuando el personal recarga la página dentro de la vigencia de su sesión, el sistema deberá restaurarla sin volver a pedir credenciales, mostrando mientras tanto una pantalla de carga breve (no el formulario). Cerrar la pestaña o el navegador termina la sesión en ese dispositivo según la política de P3.
- **RF7 (No deseado):** Si la sesión vence o el servidor la rechaza durante el turno, entonces el sistema deberá intentar renovarla una vez sin interrumpir; si no puede, deberá: dejar de recibir comandas en vivo y de permitir cambios de estado, mantener el tablero visible pero atenuado y marcado como desactualizado (con la hora de la última actualización), y mostrar un aviso crítico "Tu sesión venció" con el formulario de ingreso. Al volver a ingresar deberá recuperar la estación, volver a sincronizar las comandas y conservar las alertas críticas pendientes de confirmar.
- **RF8 (Evento):** Cuando el personal elige "Cerrar sesión" y lo confirma, el sistema deberá cerrar la sesión en el servidor (o, sin conexión, al menos en el dispositivo), cortar la recepción en vivo, borrar del dispositivo todo dato de sesión y de comandas y volver a la pantalla de ingreso. La estación elegida y la preferencia de sonido se conservan porque son del dispositivo, no de la persona.
- **RF9 (No deseado):** Si un cambio de estado es rechazado porque la sesión venció, entonces el sistema no deberá dar el cambio por hecho ni repetirlo solo al reingresar: deberá devolver la tarjeta a su estado real e informar que el cambio no se guardó.

### B. Estación
- **RF10 (Evento):** Cuando el personal entra en un dispositivo sin estación recordada, el sistema deberá pedir que elija **Cocina** o **Salón** y recordar la elección en ese dispositivo.
- **RF11 (Evento):** Cuando el personal cambia de estación desde la barra superior, el sistema deberá cambiar la vista al instante, sin cerrar la sesión ni volver a cargar las comandas, y descartar las alertas no críticas que no correspondan a la nueva estación.
- **RF12 (Ubicuo):** El sistema deberá dar a las dos estaciones los mismos permisos; la estación solo define qué columnas, acciones principales y alertas se muestran (§3.2 y §3.4) (decidido, P6 y P7).

### C. Tablero
- **RF13 (Evento):** Cuando el tablero termina de cargar, el sistema deberá mostrar todas las comandas activas del restaurante organizadas en las columnas de la estación (§3.2), cada columna con su nombre, su ícono y la cantidad de comandas.
- **RF14 (Estado):** Mientras el tablero carga, el sistema deberá mostrar marcadores con la forma de las columnas y las tarjetas.
- **RF15 (No deseado):** Si las comandas no se pueden obtener, entonces el sistema deberá explicar el problema (distinguiendo la falta de conexión) y ofrecer "Reintentar".
- **RF16 (Ubicuo):** Cada tarjeta deberá mostrar código, mesa, hora de llegada, tiempo transcurrido desde la llegada y desde que entró al estado actual, cada línea (cantidad, nombre y opciones elegidas), las notas de cada línea y la nota general destacadas, y el estado con texto e ícono (nunca solo con color). En Salón la mesa va primero y más grande.
- **RF17 (Ubicuo):** El sistema deberá ordenar cada columna por antigüedad: primero la que llegó antes. En la columna de listas, primero la que está lista hace más tiempo.
- **RF18 (Estado):** Mientras una columna no tenga comandas, el sistema deberá mostrar en ella un estado vacío breve; mientras no haya ninguna comanda activa, un estado vacío general con la hora de la última actualización.
- **RF19 (Ubicuo):** El sistema deberá mostrar sobre el tablero un resumen de cifras grandes por estación: en Cocina, nuevas, en preparación, listas y demoradas; en Salón, listas, en cocina, demoradas y llamadas.
- **RF20 (Evento):** Cuando llega una comanda nueva o una comanda cambia de columna, el sistema deberá ubicarla en su columna con una transición breve que permita seguirla con la vista (un fundido con movimiento reducido) y resaltar brevemente la tarjeta recién llegada.
- **RF21 (Estado):** Mientras una columna tenga más comandas de las que entran en pantalla, el sistema deberá permitir desplazarla por separado, con su encabezado y su contador siempre visibles.
- **RF22 (Estado):** Mientras el ancho de la pantalla sea menor a 768 px, el sistema deberá mostrar una columna por vez con un selector de columnas que indique la cantidad de comandas de cada una.

### D. Cambios de estado
- **RF23 (Evento):** Cuando el personal toca la acción principal de una tarjeta, el sistema deberá pedir el paso al estado siguiente indicando el estado que veía, mostrar la tarjeta de inmediato en su nueva columna con una marca de "guardando" y confirmar o revertir el movimiento según la respuesta.
- **RF24 (Ubicuo):** El sistema deberá ofrecer como acción principal: en Cocina, "Confirmar" (`pending` → `accepted`), "Empezar" (`accepted` → `preparing`), "Listo" (`preparing` → `ready`) y "Entregar" (`ready` → `delivered`); en Salón, "Entregar" en la columna de listas. En ambas estaciones, "Cancelar" está disponible en toda comanda no final (§3.2, decidido P7).
- **RF25 (Evento):** Cuando el personal toca "Cancelar", el sistema deberá pedir confirmación en un modal con código, mesa y estado actual, advirtiendo que no se puede deshacer, y cancelar solo si se confirma.
- **RF26 (No deseado):** Si el pedido había cambiado desde que el personal lo vio (conflicto), entonces el sistema no deberá reintentar: deberá mostrar la tarjeta en su estado real y avisar, por ejemplo, "Otro dispositivo ya pasó K7F2 a En preparación".
- **RF27 (Evento):** Cuando se pide un estado que el pedido ya tiene, el sistema deberá tratarlo como hecho, sin error ni aviso.
- **RF28 (No deseado):** Si el cambio no está permitido (por ejemplo, el pedido ya fue entregado o cancelado desde otro dispositivo), entonces el sistema deberá actualizar esa comanda con su estado real y avisar el motivo.
- **RF29 (No deseado):** Si el cambio falla por conexión o por un error del servidor, entonces el sistema deberá devolver la tarjeta a su estado anterior y avisar "No se guardó el cambio" con la acción "Reintentar", que repite el pedido con el mismo estado esperado.
- **RF30 (Estado):** Mientras un cambio de una tarjeta se está guardando, el sistema deberá deshabilitar sus acciones, de modo que un doble toque produzca un único cambio.
- **RF31 (Evento):** Cuando el personal avanza una comanda con Confirmar, Empezar o Listo, el sistema deberá ofrecer "Deshacer" durante 5 segundos, que devuelve la comanda al estado anterior con las mismas reglas de conflicto. Pasados los 5 segundos, la interfaz no ofrece ninguna forma de retroceder; no hay "Deshacer" para Entregar ni Cancelar. Que el backend permita retroceder un paso (D-060) es solo un respaldo de la API (decidido, P9).

### E. Alertas
- **RF32 (Ubicuo):** El sistema deberá clasificar cada alerta en una de tres prioridades (§3.4): **crítica** (modal que exige confirmación explícita), **alta** (aviso visible con sonido, que se cierra solo o a mano) e **informativa** (aviso breve, sin sonido).
- **RF33 (Evento):** Cuando llega un pedido nuevo, el sistema deberá emitir en Cocina una alerta alta con mesa, código y cantidad de platos.
- **RF34 (Evento):** Cuando una comanda pasa a "Listo para servir", el sistema deberá emitir en Salón una alerta alta con mesa y código.
- **RF35 (No deseado):** Si una comanda se cancela mientras estaba confirmada o en preparación, entonces el sistema deberá mostrar en Cocina una alerta crítica ("Pedido K7F2 cancelado · Mesa 12 · Estaba en preparación"); y si se cancela estando lista, una alerta crítica en Salón ("No la lleves a la mesa"). La tarjeta deberá quedar en su columna con el sello "Cancelado" hasta que alguien en ese dispositivo toque "Entendido" (decidido, P10). Una cancelación en `pending` genera una alerta alta en Cocina.
- **RF36 (Ubicuo):** El sistema deberá mostrar las alertas críticas de a una, en orden de llegada, indicando cuántas quedan ("1 de 3"); y apilar las altas e informativas con un máximo de tres visibles, agrupando el resto ("y 2 avisos más"), sin tapar la barra superior ni las acciones de las tarjetas visibles en tablet y escritorio.
- **RF37 (Evento):** Cuando llegan tres o más pedidos nuevos en menos de 3 segundos, el sistema deberá agruparlos en una sola alerta ("4 pedidos nuevos") con un solo sonido.
- **RF38 (Ubicuo):** El sistema deberá anunciar cada alerta a tecnologías de asistencia con su texto completo (código, mesa y qué pasó): las críticas con prioridad urgente y las demás de forma cortés, sin duplicar el anuncio.
- **RF39 (Evento):** Cuando el personal toca "Ver" en una alerta, el sistema deberá llevar la vista a la tarjeta (cambiando de columna en pantallas chicas), darle el foco y resaltarla brevemente.
- **RF40 (No deseado):** Si una alerta alta o informativa queda obsoleta (por ejemplo, la comanda nueva ya fue confirmada por alguien), entonces el sistema deberá retirarla. Las acciones hechas desde este mismo dispositivo no generan alertas, salvo errores y conflictos.
- **RF41 (Estado):** Mientras haya comandas nuevas sin confirmar (Cocina) o listas sin entregar (Salón), el sistema deberá mostrar su cantidad en el título de la pestaña, por ejemplo "(3) Cocina · Fogón".

### F. Sonido
- **RF42 (Estado):** Mientras el navegador no permita reproducir sonido porque falta un gesto del usuario (política de reproducción automática), el sistema deberá mostrar en la barra superior un botón destacado y persistente "Activar sonido" que lo habilite al tocarlo.
- **RF43 (Evento):** Cuando se emite una alerta alta o crítica, el sistema deberá reproducir el sonido propio de su tipo (nuevo, listo, cancelado, demora, llamada, conexión), distinguibles entre sí, con al menos 1 segundo entre sonidos.
- **RF44 (Estado):** Mientras una alerta crítica no haya sido confirmada, el sistema deberá repetir su sonido cada 30 segundos, hasta 5 veces.
- **RF45 (Evento):** Cuando el personal silencia o reactiva el sonido, el sistema deberá recordarlo en el dispositivo y mostrar siempre el estado actual (activo, silenciado, bloqueado o no disponible) con texto o nombre accesible.
- **RF46 (No deseado):** Si el dispositivo no puede reproducir sonido o el navegador lo bloquea, entonces el sistema deberá seguir mostrando todas las alertas de forma visual y explicar el motivo junto al botón de sonido.

### G. Demora
- **RF47 (Estado):** Mientras una comanda lleve 10 minutos o más en `pending`, el sistema deberá marcarla como demorada en ambas estaciones (texto "Demorada · 12 min", ícono y color), contarla en el resumen de cifras y actualizar la marca sin recargar. La regla es la misma de la 001 (RF48 de la 001, `isDelayed`).
- **RF48 (Evento):** Cuando una comanda pasa a estar demorada, el sistema deberá emitir una sola vez por comanda y por dispositivo una alerta alta en Cocina y una informativa en Salón.

### H. Tiempo real y conexión
- **RF49 (Ubicuo):** El sistema deberá recibir en tiempo real, sin recargar, los pedidos nuevos y todos los cambios de estado, incluidos los hechos desde otros dispositivos del personal y la cancelación por el cliente mientras el pedido sigue en `pending`, que el panel trata como cualquier cancelación (decidido, P11; §10, K5).
- **RF50 (Estado):** Mientras la conexión en vivo no esté activa, el sistema deberá indicarlo en la barra superior ("Reconectando…" o "Sin conexión"), marcar el tablero como desactualizado con la hora de la última actualización y mostrar "En vivo" solo cuando la conexión esté realmente activa.
- **RF51 (No deseado):** Si la conexión en vivo sigue caída después de 30 segundos, entonces el sistema deberá mostrar un aviso persistente "Sin conexión: los pedidos nuevos no están llegando" con un sonido de conexión, hasta que se recupere.
- **RF52 (Evento):** Cuando la conexión se recupera o el panel vuelve a primer plano, el sistema deberá volver a sincronizar las comandas sin duplicarlas ni mostrar estados más viejos que los que ya tenía, retirar las que pasaron a un estado final y mostrar un aviso informativo con lo que cambió mientras tanto ("Llegaron 3 pedidos mientras estabas sin conexión"). Las cancelaciones de comandas en curso se alertan individualmente según RF35.
- **RF53 (Ubicuo):** La carga inicial y las sincronizaciones no deberán generar una alerta por cada comanda; solo el resumen de RF52.

### I. Llamar al mozo (dentro del alcance, decidido P12)
- **RF54 (Evento):** Cuando el cliente, con una mesa válida, toca "Llamar al mozo" en la carta (junto a la insignia de la mesa en la portada y en el aviso de demora de "Mis pedidos"), el sistema deberá enviar el aviso, confirmar "Avisamos al mozo" de forma visible y anunciada, y no permitir otro aviso de esa mesa desde ese dispositivo durante 60 segundos.
- **RF55 (Evento):** Cuando llega una llamada de mesa, el sistema deberá emitir en Salón una alerta alta con el sonido de llamada y mostrarla en una franja "Llamadas" sobre el tablero, con la mesa y el tiempo transcurrido.
- **RF56 (Evento):** Cuando un mozo toca "Atendida", el sistema deberá quitar la llamada en todos los dispositivos del salón.
- **RF57 (No deseado):** Si llega otra llamada de una mesa que ya tiene una llamada abierta, entonces el sistema deberá mantener una sola llamada y actualizar su hora.
- **RF58 (No deseado):** Si el aviso del cliente no se puede enviar, entonces el sistema deberá explicarlo en la carta y permitir reintentar.

### J. Idioma
- **RF59 (Ubicuo):** El sistema deberá mostrar el panel en español por defecto y permitir cambiarlo a inglés desde el menú de la cuenta, recordando la elección en el dispositivo; nombres de platos y opciones se muestran en el idioma elegido con español como respaldo (reglas de la 001).
- **RF60 (Evento):** Cuando el personal cambia de idioma, el sistema deberá traducir todo el panel, incluidas las alertas visibles, sin perder el estado del tablero ni las alertas pendientes.

### K. Pantalla encendida
- **RF61 (Opcional):** Donde el navegador lo permita, el sistema deberá mantener la pantalla del dispositivo encendida mientras el panel esté visible con una sesión válida, y volver a pedirlo al regresar a primer plano (decidido, P18).

---

## 3. Reglas de negocio

### 3.1 Heredadas de la 001 (no se redefinen)
- Ciclo de vida: `pending` → `accepted` → `preparing` → `ready` → `delivered`; `cancelled` desde cualquier estado no final (spec 001 §3.1). Retroceder un paso: solo dentro del "Deshacer" de 5 s de la interfaz (decidido, P9); el backend lo admite además como respaldo de la API (D-060).
- Concurrencia: mismo estado = sin cambios; estado esperado distinto = conflicto con el pedido actual; salto no permitido = transición inválida (spec 001 §3.2).
- Demora: 10 minutos o más en `pending` (spec 001 §3.1).
- Consistencia: gana el `updatedAt` más nuevo; nunca se muestra un estado más viejo que el que ya se mostró.

### 3.2 Vista por estación (decidido, P7)

| | Cocina | Salón |
|---|---|---|
| Columnas | Nuevas (`pending`) · Confirmadas (`accepted`) · En preparación (`preparing`) · Listas (`ready`) | Listas para servir (`ready`, primera y más ancha) · En cocina (`pending`, `accepted`, `preparing`, tarjetas compactas con su estado) |
| Acción principal | Confirmar · Empezar · Listo · Entregar (en Listas, menos destacada) | Entregar (en Listas). En "En cocina", ninguna |
| Cancelar | En toda comanda no final | En toda comanda no final |
| Arriba del tablero | Resumen: nuevas, en preparación, listas, demoradas | Franja de llamadas · resumen: listas, en cocina, demoradas, llamadas |
| Orden | Por llegada; Listas por hora en que quedó lista | Ídem |

Las tarjetas se mueven con botones, no arrastrándolas (decidido, P8).

### 3.3 Confirmaciones
- **Cancelar:** siempre con modal de confirmación (es final e irreversible).
- **Entregar:** sin confirmación (es el paso normal del salón); no se puede deshacer.
- **Confirmar, Empezar, Listo:** sin confirmación; "Deshacer" durante 5 s (decidido, P9).
- **Cerrar sesión:** con confirmación, avisando si hay alertas críticas sin confirmar.

### 3.4 Prioridades de alertas

| Evento | Cocina | Salón | Sonido |
|---|---|---|---|
| Pedido nuevo | Alta | — (aparece en "En cocina") | nuevo |
| Pasa a `ready` (desde otro dispositivo) | Informativa | **Alta** | listo |
| Cancelado estando `pending` | Alta | Informativa | cancelado |
| Cancelado estando `accepted` o `preparing` | **Crítica** | Informativa | cancelado (repite) |
| Cancelado estando `ready` | Alta | **Crítica** | cancelado (repite) |
| Pasa a demorada | Alta (una vez) | Informativa (una vez) | demora |
| Retroceso de estado desde otro dispositivo (el backend lo permite, D-060) | Informativa | Informativa | — |
| Llamada de mesa | — | Alta | llamada |
| Conflicto al guardar | Informativa | Informativa | — |
| Error al guardar | Alta, con "Reintentar" | Alta, con "Reintentar" | — |
| Conexión caída más de 30 s | Aviso persistente | Aviso persistente | conexión (una vez) |
| Reconexión con novedades | Informativa (resumen) | Informativa (resumen) | — |
| Sesión vencida | **Crítica** (ingreso) | **Crítica** (ingreso) | — |

- Duración: alta 10 s; informativa 4 s; ambas se pausan con el puntero o el foco encima y mientras la pestaña está oculta. La crítica no se cierra sola ni con Escape: solo con su botón.
- Las acciones hechas desde este dispositivo no generan alertas (salvo error o conflicto).
- Los valores numéricos (10 s, 4 s, 3 en 3 s, 30 s, 5 repeticiones) son propuestas del plan y se pueden ajustar sin cambiar la spec.

### 3.5 Sesión del personal (decidido, P2-P5)
- Una sesión pertenece a un usuario del personal, que pertenece a un solo restaurante (spec del backend, R8.5).
- La sesión dura como máximo un turno (12 h propuestas); dentro de ese plazo se renueva sola sin pedir la contraseña.
- La interfaz nunca muestra ni guarda en pantalla el token; solo la capa de servicios lo usa.
- Cerrar sesión borra del dispositivo los datos de sesión y de comandas.

### 3.6 Riesgos aceptados en esta spec
- **Modo demostración:** mientras no exista el backend, el ingreso se simula con usuarios de prueba y la protección es solo visual (cualquiera con acceso a la consola del navegador podría saltearla). La protección real la da el servidor (§10).
- **Dos pestañas del panel en el mismo dispositivo:** ambas funcionan y ambas suenan; se recomienda no abrir el panel dos veces en el mismo equipo.
- **Recarga con una cancelación sin confirmar:** al recargar, la tarjeta cancelada ya no se muestra (no es activa); la alerta crítica se pierde en ese dispositivo. Se acepta porque la cancelación ya se vio al ocurrir y el resto de los dispositivos la recibe igual.

---

## 4. Requisitos no funcionales

- **RNF1 (Dispositivos objetivo, decidido P19):** **Cocina:** tablets de 10" en horizontal (1024 × 768, 1180 × 820, 1280 × 800). **Salón:** celulares (desde 360 px de ancho, sin romperse a 320 px) y tablets chicas (768 × 1024 en vertical). Escritorio y monitor (1440 × 900, 1920 × 1080) no son objetivo, pero el panel debe verse bien. Sin desplazamiento horizontal de la página y respetando zonas seguras.
- **RNF2 (Legibilidad a distancia y operación con manos ocupadas):** En tablet, código y mesa con al menos 28 px de alto visual y acciones principales de al menos 56 px de alto y 48 px de ancho mínimo, con 8 px de separación; texto principal con contraste de 7:1 o más.
- **RNF3 (Accesibilidad):** WCAG 2.1 AA (y 2.5.7 de 2.2: toda acción sin arrastre): contraste documentado por superficie, foco visible, todo operable con teclado (recorrer columnas y tarjetas, acciones, alertas, modales), nombres accesibles, estados que no dependan solo del color. **Verificación:** análisis automático sin violaciones en cada pantalla y modal, recorrido con teclado y Lighthouse de accesibilidad de 95 o más en ingreso, estación y tablero.
- **RNF4 (Rendimiento):** Con 60 comandas activas y CPU 4 veces más lenta: respuesta a la acción principal (INP) menor a 200 ms; una ráfaga de 10 eventos no produce tareas largas de más de 50 ms; un evento recibido aparece en pantalla en menos de 1 s.
- **RNF5 (Turno completo):** El panel deberá poder quedar abierto 12 horas sin degradarse: sin fugas de suscripciones ni temporizadores, con reconexión automática.
- **RNF6 (Seguridad, dominio CRÍTICO):** El token nunca va en la URL, en registros de consola ni en el código HTML; no se guardan contraseñas; el formulario usa los atributos de autocompletado correctos; los errores de ingreso no revelan qué dato falló; al cerrar sesión no queda ningún dato de sesión ni de comandas en el dispositivo; el panel no debe ser indexado por buscadores. El almacenamiento del token sigue la política de P3. En producción, HTTPS obligatorio.
- **RNF7 (Reemplazabilidad):** Mientras no exista el servidor, el panel funcionará con la simulación (incluido el ingreso). Conectar el servidor real no deberá requerir cambios en las pantallas: solo en la capa de servicios.
- **RNF8 (Independencia del transporte):** Las pantallas no dependen de cómo llegan los avisos. Con cualquier origen, el tablero queda consistente: sin duplicados, sin retrocesos no ocurridos y sin avisos perdidos entre la carga inicial y la suscripción.
- **RNF9 (Calidad):** Cada RF cubierto por al menos una prueba automatizada escrita antes del código (TDD), con la suite en verde para dar una tarea por terminada.
- **RNF10 (Lenguaje visual):** Dashboard oscuro, elegante y limpio tipo SaaS, adaptado de las referencias 2 y 3 a la identidad "Fogón", sin reutilizar sus textos, videos, imágenes, logos ni URLs.
- **RNF11 (Calma operativa):** Sin animaciones en bucle salvo el indicador de "reconectando"; nada parpadea; las alertas no se repiten más de lo indicado en §3.4; con movimiento reducido, todo desplazamiento se reemplaza por fundidos y las alertas siguen siendo visibles.
- **RNF12 (Resiliencia):** Si el navegador no permite guardar datos, el panel sigue funcionando aunque no recuerde la estación, el silencio ni (en la simulación) la sesión tras recargar.

---

## 5. Casos límite y manejo de errores

| # | Situación | Comportamiento esperado | RF |
|---|---|---|---|
| CL1 | Se abre el panel sin sesión o con la sesión vencida y no renovable | Pantalla de ingreso; ningún dato del restaurante visible. | RF1, RF2 |
| CL2 | Correo o contraseña incorrectos | "Correo o contraseña incorrectos"; correo conservado, contraseña vacía. | RF4 |
| CL3 | Muchos intentos fallidos seguidos | Mensaje pidiendo esperar; el botón se habilita al vencer la espera. | RF4 |
| CL4 | Sin conexión al ingresar | Mensaje de conexión y "Reintentar"; no se confunde con credenciales incorrectas. | RF4 |
| CL5 | Recarga durante el turno | Sesión restaurada, estación recordada, tablero recargado, sin alertas por la carga. | RF6, RF53 |
| CL6 | El token vence y se puede renovar | Renovación silenciosa; el turno no se interrumpe. | RF7 |
| CL7 | La sesión no se puede renovar (turno terminado o sesión revocada) | Tablero atenuado y desactualizado, cambios bloqueados, modal crítico de ingreso; al reingresar, sincroniza y conserva las críticas pendientes. | RF7 |
| CL8 | La sesión vence justo al tocar una acción | El cambio no se da por hecho; la tarjeta vuelve; aviso "No se guardó: tu sesión venció"; no se repite solo. | RF9 |
| CL9 | Se reingresa con un usuario de otro restaurante | El tablero se recarga entero con el nuevo restaurante; se descartan comandas y alertas del anterior. | RF7, RF8 |
| CL10 | Cerrar sesión con alertas críticas sin confirmar | La confirmación lo advierte; al cerrar se descartan. | RF8 |
| CL11 | Dos dispositivos mueven la misma comanda a la vez | Uno gana; el otro ve el estado real y el aviso de conflicto, sin reintentar. | RF26 |
| CL12 | Doble toque en la acción principal | Un solo cambio. | RF30 |
| CL13 | Se pide el estado que la comanda ya tiene | Se da por hecho, sin aviso. | RF27 |
| CL14 | Se cancela una comanda que cocina está preparando | Alerta crítica en Cocina con sonido que se repite; sello "Cancelado" en la tarjeta hasta "Entendido". | RF35, RF44 |
| CL15 | Se cancela una comanda lista para servir | Alerta crítica en Salón ("No la lleves a la mesa"). | RF35 |
| CL16 | El cliente cancela su pedido en `pending` (aceptado por el usuario, P11) | Se trata como cancelación (alerta alta en Cocina); si el servidor informa quién canceló, se muestra "Cancelado por el cliente". | RF35, RF49 |
| CL17 | Llegan 4 pedidos en 2 segundos | Una alerta "4 pedidos nuevos" y un solo sonido; las 4 tarjetas aparecen. | RF37 |
| CL18 | 60 o más comandas activas | Columnas con desplazamiento propio y contadores visibles; sin lentitud perceptible. | RF21, RNF4 |
| CL19 | Comanda con 15 líneas, notas largas, nombres largos o en inglés | La tarjeta crece sin cortar cantidades, opciones ni notas; no hay desplazamiento horizontal. | RF16 |
| CL20 | Se recarga el panel y el navegador no permite sonido sin un toque | Botón "Activar sonido" destacado y persistente; las alertas se ven igual. | RF42, RF46 |
| CL21 | El dispositivo no soporta audio web | "Sonido no disponible" junto al botón; alertas solo visuales. | RF46 |
| CL22 | El personal silenció el sonido | No suena; el estado "Silenciado" se ve siempre; se recuerda al recargar. | RF45 |
| CL23 | La pestaña queda en segundo plano | Los sonidos siguen si el navegador lo permite, el título muestra la cantidad y los temporizadores de las alertas se pausan; al volver, se sincroniza. | RF41, RF52 |
| CL24 | Se corta la conexión en vivo | "Reconectando…" y tablero marcado desactualizado; a los 30 s, aviso persistente con sonido. Las acciones se pueden intentar; si fallan, RF29. | RF50, RF51 |
| CL25 | Vuelve la conexión | Sincronización sin duplicados ni retrocesos; resumen de lo que llegó; cancelaciones de comandas en curso alertadas una por una. | RF52 |
| CL26 | Llega tarde un aviso con un estado más viejo | Se descarta. | RF52, RNF8 |
| CL27 | Con el modal "Cancelar" abierto, otro dispositivo entrega o cancela esa comanda | El modal se cierra con el aviso "Esta comanda ya no está activa". | RF28 |
| CL28 | Una comanda cumple 10 minutos en "Nuevas" sin que nadie recargue | Se marca demorada en el momento, cuenta en el resumen y alerta una vez; al confirmarla deja de estar demorada. | RF47, RF48 |
| CL29 | El reloj de la tablet está adelantado o atrasado | Los tiempos se calculan corrigiendo la diferencia con la hora del servidor cuando se conoce; nunca se muestra un tiempo negativo. | RF16, RF47 |
| CL30 | Se cambia de estación con alertas en la cola | Las no críticas que no corresponden a la nueva estación se descartan; las críticas se mantienen. | RF11 |
| CL31 | Panel en el celular del mozo (360 px) | Una columna por vez con selector y contadores; acciones de 56 px; sin desplazamiento horizontal. | RF22, RNF1 |
| CL32 | Movimiento reducido activado | Sin desplazamientos ni brillo animado; fundidos breves; alertas igual de visibles. | RF20, RNF11 |
| CL33 | El navegador bloquea el almacenamiento | El panel funciona; no recuerda estación ni silencio; en la simulación, la sesión no sobrevive a recargar. | RNF12 |
| CL34 | No hay comandas activas | Estado vacío general con la hora de la última actualización. | RF18 |
| CL35 | Otro dispositivo retrocede un estado (el backend lo permite, D-060) | La tarjeta vuelve a la columna anterior con un aviso informativo. | RF49 |
| CL36 | La misma mesa llama al mozo varias veces | Una sola llamada abierta, con la hora actualizada. | RF57 |
| CL37 | Una llamada se atiende desde otro dispositivo | Desaparece en todos los dispositivos del salón. | RF56 |
| CL38 | Se toca "Deshacer" pero otro dispositivo ya movió la comanda | Conflicto: estado real y aviso. | RF31, RF26 |
| CL39 | Una comanda de una mesa que después se desactivó | Se muestra igual: la comanda guarda su mesa. | RF16 |
| CL40 | El panel queda abierto todo el turno y se cumple el máximo de la sesión | Aviso crítico de ingreso (CL7); nada se pierde del tablero. | RF7, RNF5 |
| CL41 | El panel se abre en dos pestañas del mismo equipo | Ambas funcionan y suenan (riesgo aceptado, §3.6). | §3.6 |
| CL42 | Un pedido llega mientras el tablero está cargando | No se pierde ni se duplica (suscribir antes de cargar). | RF13, RNF8 |
| CL43 | Una alerta alta queda obsoleta (otro dispositivo ya confirmó la comanda nueva) | Se retira sola. | RF40 |
| CL44 | Se cambia de idioma con alertas visibles | Las alertas visibles y pendientes se muestran en el nuevo idioma. | RF60 |

---

## 6. Supuestos

1. **Un único rol de personal** (spec del backend, S5): cocina y salón tienen los mismos permisos.
2. **Cada usuario del personal pertenece a un solo restaurante** (spec del backend, R8.5). El panel muestra solo las comandas de ese restaurante.
3. **El restaurante está siempre abierto** (como en la 001): sin turnos ni cierre de cocina.
4. **Las comandas no se editan:** solo cambia el estado (spec del backend, S3).
5. **Sin impresión** de comandas ni integración con impresoras de cocina.
6. **Solo tema oscuro**, como la 001.
7. **El panel funciona sin el backend** con la simulación de la 001 (localStorage + BroadcastChannel entre pestañas): el cliente en una pestaña y el panel en otra del mismo navegador.
8. **Usuarios de demostración** para el modo simulado (por ejemplo `demo@fogon.test`), visibles solo en desarrollo.
9. **Navegadores objetivo:** los de la 001 (Safari iOS/iPadOS 16.4+, Chrome 111+, Firefox 128+).
10. **El sonido lo genera el propio navegador** (sin archivos de audio) (decidido, P17).

---

## 7. Fuera de alcance

- Edición de la carta, del stock, de mesas o del personal (ABM), reportes, estadísticas e historial de turnos.
- Impresión de comandas, tiempos estimados de preparación y asignación de comandas a cocineros o mesas a mozos.
- Arrastrar tarjetas entre columnas (decidido, P8).
- Historial de entregadas en el tablero (se puede consultar en una spec futura).
- Demora en estados distintos de `pending` (decidido, P16).
- Notificaciones push o del sistema operativo, instalación como app (PWA) y funcionamiento sin conexión.
- Botón "Cancelar" para el cliente en la carta. El usuario aceptó la cancelación por el cliente en `pending` (P11, K5) y el panel ya la recibe, pero el botón cambia la carta de la 001 y depende de una ruta que el backend todavía no definió (R6); no es trivial ni estaba previsto en el plan. Va en una spec posterior (decisión del planner, 2026-10-20).
- Implementar el adaptador real REST + WebSocket: se diseña en el plan, pero se implementa cuando exista el backend.
- Mover el frontend a `frontend/` y las specs a `specs/frontend/` (decisión del backend D-039/D-040, a coordinar).

---

## 8. Criterios de finalización de la spec

1. Todos los RF dentro del alcance confirmado tienen al menos una prueba automatizada en verde (matriz en `plan.md` §13.3) y `npm run build` termina sin errores, con las dos entradas (carta y panel).
2. Prueba de integración del flujo completo en modo demostración: el cliente envía un pedido → aparece en el panel con su alerta → cocina lo confirma, lo empieza y lo marca listo → salón recibe la alerta y lo entrega → el cliente ve cada estado en "Mis pedidos".
3. Validación visual registrada en 375 × 812 (celular de salón), 768 × 1024 (tablet chica de salón), 1024 × 768 y 1280 × 800 (tablet de cocina) y, como control, 1920 × 1080; con y sin movimiento reducido y sin desplazamiento horizontal.
4. RNF3 y RNF4 verificados con las métricas indicadas.
5. Las tareas de autenticación (dominio CRÍTICO) se implementaron solo después de la aprobación explícita del usuario, registrada en el reporte.
6. Los puntos de §10 y los cambios de contrato de `plan.md` §7.5 quedaron listos para revisarlos con el compañero del backend.
7. **Paso manual del usuario:** prueba en una tablet real (sonido, "Activar sonido", lectura a 1,5 m, acciones con el dedo, pantalla encendida con HTTPS) y en un celular (vista del mozo).
8. `opencode/memory.md` actualizado al cerrar la última tarea (lo hace el coordinador).

---

## 9. Decisiones tomadas (antes "preguntas abiertas")

El usuario respondió el **2026-10-20** y aprobó todas las recomendaciones. La spec, el plan y las tareas ya las aplican.

| # | Tema | Decisión del usuario (2026-10-20) | Afecta |
|---|---|---|---|
| P1 | Stack del backend | Node.js + Express + Supabase (el backend de Uriel). | Plan §7.5 |
| P2 | Quién emite el token | El backend expone sus propias rutas `/api/auth/login`, `/refresh`, `/logout` y `/me`, y por dentro usa Supabase Auth; el frontend no usa el SDK de Supabase. | RF2-RF8, T2, plan §7.5 C1 |
| P3 | Guardado y duración del token | Token de acceso corto (15 min) solo en memoria + renovación con cookie `httpOnly` del backend; sesión máxima de un turno (12 h). | RF6, RF7, RNF6, T2, T3 |
| P4 | Token en el WebSocket | Primer mensaje `system.auth { token }` dentro de los 5 s; `system.welcome` llega después; se renueva con otro `system.auth` sin reconectar. | RF7, RF49, plan §7.6 |
| P5 | Credenciales | Correo + contraseña por persona (el restaurante puede igual crear una cuenta compartida). | RF2, T3 |
| P6 | Cocina/Salón | Vista elegida después de ingresar y recordada en el dispositivo; no es un rol del token. | RF10-RF12, T4 |
| P7 | Columnas y acciones por estación | La propuesta de §3.2. | RF24, §3.2, T6 |
| P8 | Arrastrar tarjetas | Solo botones en la 002. | RF23, T6 |
| P9 | Retroceso y "Deshacer" | "Deshacer" de 5 s en la interfaz. Que el backend permita retroceder es solo un respaldo de la API; la interfaz mantiene la regla de los 5 s. | RF31, CL38, T1, T5, T7 |
| P10 | Tarjeta cancelada | Queda con el sello hasta "Entendido" en las cancelaciones críticas; las demás salen al momento. | RF35, T6 |
| P11 | Cancelación por el cliente | Se acepta que el cliente cancele mientras el pedido siga en "Enviado"; el panel la trata como cualquier cancelación y muestra "Cancelado por el cliente" si el backend informa quién canceló (C5). El botón de la carta queda fuera de la 002 (§7). | RF35, RF49, CL16, T5, T6, plan §7.5 C5 |
| P12 | "Llamar al mozo" | Entra en la 002, en la T9. | RF54-RF58, T9 |
| P13 | Acción principal de las tarjetas | Píldora clara "hueso" con círculo y flecha. | Plan §9.5, T6 |
| P14 | Tipografía | Barlow + Barlow Condensed, sin Readex Pro. | Plan §9.3 |
| P15 | Paleta | Carbón cálido de la 001. | Plan §9.2 |
| P16 | Demora en otros estados | Solo la regla de `pending`. | RF47 |
| P17 | Sonidos | Generados por el navegador (Web Audio), sin archivos. | RF43, T8 |
| P18 | Pantalla encendida | Sí, donde el navegador lo permita (necesita HTTPS). | RF61, T8 |
| P19 | Dispositivos | Tablets de 10" en horizontal para la cocina; celulares o tablets chicas para el salón. | RNF1, RNF2, plan §9.6, tasks (regla 4) |
| P20 | Restaurante del panel | El restaurante del usuario sale de la sesión. Además, como el backend exige `restaurant=<slug>` (K3), la capa de servicios lo envía desde una única configuración (plan §7.5 C6). | T2, plan §7.5 |

---

## 10. Puntos con el backend de Uriel: resolución y acciones pendientes

Comparación con `origin/chore/backend-specs` (`specs/backend/001-pedidos-tiempo-real/requisitos.md` v2, `decisiones.md`, `alineacion-front.md` y `specs/constitucion.md` v2). Estado al 2026-10-20.

| # | Punto | Front | Backend (rama de Uriel) | Resolución / acción pendiente | Responsable |
|---|---|---|---|---|---|
| K1 | Stack | Habla solo con el contrato | Node.js + Express + `ws` + Prisma + PostgreSQL en Supabase (D-005, D-042) | **Resuelto:** confirmado Node.js + Express + Supabase (P1). | — |
| K2 | Autenticación | Rutas `/api/auth/*` propias del backend (P2) | Supabase Auth; el backend solo verifica el token (D-009, D-056, R8); no hay rutas de ingreso definidas | **Pendiente:** pedirle a Uriel las rutas de plan §7.5 C1-C3 (envolviendo Supabase Auth) y la cookie `httpOnly` de renovación. | Usuario con Uriel |
| K3 | Varios restaurantes | Se acepta enviar `restaurant=<slug>` (`fogon`) | `restaurant=<slug>` obligatorio en GET, WebSocket y cuerpo del POST (R1.4, R9.1, I3, D-045) | **Resuelto en el frontend:** la capa de servicios envía el slug desde una única configuración (`src/services/apiConfig.ts`); las pantallas nunca lo ven y el mock no lo valida. Afecta al adaptador HTTP futuro y al contrato de la 001 (plan §7.5 C6). **Pendiente:** confirmar con Uriel que valide que el slug coincide con el restaurante del token en las rutas del personal (403 / cierre 4403). | Frontend (config) · Usuario con Uriel (validación) |
| K4 | Retroceso de estados | "Deshacer" de 5 s (P9) | Retroceder un paso desde cualquier estado no final salvo `pending` (R5.3, D-060) | **Resuelto:** el backend lo conserva como respaldo de la API; la interfaz solo lo usa dentro del "Deshacer" de 5 s. El panel muestra bien un retroceso hecho por otro (CL35). | — |
| K5 | Cancelación por el cliente | Aceptada en `pending` (P11); el panel la trata como cualquier cancelación | El cliente cancela en `pending` con su `clientRequestId`; ruta sin definir (R6, D-048, D-058) | **Resuelto para el panel.** **Pendiente:** pedirle a Uriel `statusHistory[].by` (C5) y que defina la ruta de R6 (la usará el botón de la carta en una spec posterior). | Usuario con Uriel |
| K6 | WebSocket del personal: cierre sin token y vencimiento con la conexión abierta | `system.auth` + cierres 4401/4403 (P4, plan §7.6) | "Se define en el diseño" (R8.2, R8.4) | **Pendiente:** que Uriel implemente plan §7.6. | Usuario con Uriel |
| K7 | Mesa inválida | Se sostiene HTTP **404** | 422 `INVALID_TABLE` en `POST /api/orders` (R3.3); 404 `NOT_FOUND` en `GET /api/tables/{id}` (R2.2) | **Pendiente:** el usuario le pide a Uriel que `POST /api/orders` responda 404 con código `INVALID_TABLE`. No afecta al panel. | Usuario con Uriel |
| K8 | "Llamar al mozo" | Entra en la 002 (P12, T9) | `table.call_waiter` responde `NOT_IMPLEMENTED` (R9.8) | **Pendiente:** que Uriel implemente plan §7.5 C8. Mientras tanto, el frontend usa el mock. | Usuario con Uriel |
| K9 | Límite de 50 líneas por pedido | La 001 no lo valida | 400 `VALIDATION` (R3.4, D-054) | **Pendiente:** decidir si se suma a la 001 o se sube el límite. No afecta al panel. | Usuario con Uriel |
| K10 | Límite de 20 pedidos por minuto por IP | — | RNF7 del backend | **Pendiente:** el usuario le pide a Uriel desactivarlo o subirlo muchísimo, porque el wifi del local comparte la IP. No es tarea del frontend. Proponer también un límite de intentos de ingreso (C1). | Usuario con Uriel |
| K11 | Estructura del repo | Front en la raíz; specs en `specs/NNN-…` | Front en `frontend/`, specs en `specs/frontend/` (D-039, D-040) | **Pendiente:** coordinar el movimiento fuera de esta spec. | Usuario con Uriel |
| K12 | Mesas y escala | Un servidor con WebSockets en memoria | Entidad `Table` por restaurante (D-059); un servidor (RNF4 del backend) | **Compatible.** Sin acción. | — |
