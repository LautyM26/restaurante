# Spec 001: Base del proyecto y menú del cliente

- **Estado:** aprobado
- **Fecha:** 2026-10-11
- **Autor:** @planner
- **Spec siguiente (no incluida aquí):** 002, panel de cocina y salón

> Este documento describe el QUÉ y el POR QUÉ. El CÓMO (stack, arquitectura, archivos, protocolos, lenguaje visual concreto) está en `plan.md`.
> Los RF41 a RF48 se agregaron en la revisión QA y con las decisiones del usuario; se numeraron al final para no cambiar las referencias existentes.

---

## 0. Contexto y objetivo

### Problema
En el salón, el cliente depende de que un mozo esté libre para pedir la carta, tomar el pedido y transmitirlo a cocina. Eso genera esperas, errores de transcripción (sin cebolla, punto de cocción, extras) y poca visibilidad del estado del pedido.

### Objetivo de esta spec
1. Dejar la **base del proyecto** sobre la que se construirá todo el sistema: modelo de pedido, ciclo de vida de estados, avisos en tiempo real, idiomas y lenguaje visual, de forma que la Spec 002 los reutilice sin redefinirlos.
2. Entregar la **vista del cliente**: desde su celular, sentado a la mesa, el cliente escanea un QR, explora la carta, personaliza platos, envía el pedido y sigue su estado en tiempo real.

### Usuarios y escenario principal
- **Cliente del restaurante.** Usa su propio celular, con una mano, en un ambiente con luz tenue y con conexión variable (wifi del local o datos). Puede no hablar español. No quiere instalar nada ni registrarse.
- **Escenario:** escanea el QR pegado en la mesa 12 → se abre la carta ya asociada a esa mesa → elige platos y opciones → envía → ve "En preparación" y luego "Listo para servir" sin preguntar a nadie.

### Por qué una experiencia inmersiva
El restaurante quiere que la carta digital transmita la misma calidad que el local: tipografía grande, imágenes protagonistas y movimiento con intención, adaptando la calidad visual de las referencias de `docs/referencias/` al contexto gastronómico. La estética nunca debe frenar el objetivo principal: pedir rápido y sin errores.

---

## 1. Glosario

| Término | Definición |
|---|---|
| **Mesa** | Ubicación física identificada por un número. El QR de cada mesa abre la app con ese número. |
| **Carta** | Conjunto de categorías y platos que ofrece el restaurante. |
| **Plato** | Ítem de la carta con nombre, descripción, precio base, etiquetas dietarias, disponibilidad, orden dentro de su categoría y grupos de opciones. |
| **Grupo de opciones** | Conjunto de opciones de un plato (por ejemplo: punto de cocción, guarnición, extras, quitar ingredientes). Puede ser de elección única o múltiple, obligatorio u opcional, con mínimo y máximo de selecciones. |
| **Opción** | Elemento de un grupo. Puede sumar un costo adicional (o cero) y puede estar no disponible. |
| **Línea** | Un plato con una combinación concreta de opciones, una cantidad y una nota opcional. Tiene un identificador propio dentro del pedido en curso. |
| **Pedido en curso** | Las líneas que el cliente fue armando y todavía no envió (el "carrito"). |
| **Intento de envío** | Cada envío del pedido en curso, identificado de forma única para que el restaurante reconozca los reintentos y no duplique el pedido. |
| **Pedido** | Pedido en curso ya enviado y aceptado por el sistema. Tiene código corto, mesa, líneas, total, estado e historial. |
| **Código de pedido** | Identificador corto y legible que cliente y personal usan para referirse a un pedido (reglas en §3.3). |
| **Estado** | Etapa del pedido en su ciclo de vida (§3). Activo = estado no final. |
| **Dispositivo** | El navegador del celular del cliente. Varias pestañas de un mismo navegador cuentan como el mismo dispositivo. |
| **Sesión** | Desde que se abre la app en una pestaña hasta que esa pestaña se cierra. Recargar la página no inicia una sesión nueva. |
| **Hoja** | Panel que se abre sobre la carta (ficha del plato o resumen del pedido). |
| **Personal** | Cocina y salón (mozos). Usan el panel de la Spec 002. |

---

## 2. Requisitos funcionales (EARS)

Notación EARS: **Ubicuo** ("El sistema deberá…"), **Evento** ("Cuando…, el sistema deberá…"), **Estado** ("Mientras…, el sistema deberá…"), **No deseado** ("Si…, entonces el sistema deberá…"), **Opcional** ("Donde…, el sistema deberá…").

### A. Mesa
- **RF1 (Evento):** Cuando el cliente abre la app desde el QR con un identificador de mesa válido, el sistema deberá asociar la sesión a esa mesa y mostrar el número de mesa en la portada y en el resumen del pedido.
- **RF2 (No deseado):** Si el identificador de mesa falta, no es un número entero positivo o no corresponde a una mesa existente, entonces el sistema deberá permitir explorar la carta y las fichas de los platos (solo lectura), pero no agregar platos ni enviar pedidos, y deberá mostrar un aviso que indique escanear el QR de la mesa o pedir ayuda al personal.
- **RF3 (Estado):** Mientras el sistema verifica que la mesa existe, el sistema deberá permitir explorar la carta y mantener deshabilitadas las acciones de agregar y enviar.
- **RF41 (No deseado):** Si la mesa no se puede verificar por un problema de conexión o del servidor, entonces el sistema deberá mantener deshabilitadas las acciones de agregar y enviar, mostrar un aviso con la acción "Reintentar" y volver a intentarlo solo cuando se recupere la conexión.

### B. Portada
- **RF4 (Ubicuo):** El sistema deberá mostrar una portada con el número de mesa, un titular, una selección visual de platos destacados disponibles y un acceso directo "Ver la carta" que lleve al inicio de la carta; la identidad del restaurante (marca) deberá estar visible en la barra superior, presente sobre la portada.
- **RF5 (Evento):** Cuando el cliente abre la app por primera vez en la sesión, el sistema deberá presentar la portada con una única secuencia de entrada de 1,8 s como máximo, sin bloquear la interacción mientras ocurre; en el resto de la sesión deberá mostrarla directamente.
- **RF6 (Estado):** Mientras el dispositivo tenga activada la preferencia de movimiento reducido, el sistema deberá omitir la secuencia de entrada, mantener quieta la selección de destacados y reemplazar desplazamientos y deslizamientos por fundidos breves.

### C. Carta
- **RF7 (Evento):** Cuando la carta termina de cargar, el sistema deberá mostrarla agrupada por categorías y, dentro de cada categoría, los platos en el orden definido por el restaurante, con nombre, descripción breve, precio, imagen o representación visual y etiquetas dietarias (vegetariano, vegano, sin TACC, picante) de cada plato.
- **RF8 (Estado):** Mientras la carta se está cargando, el sistema deberá mostrar marcadores de carga con la forma del contenido final.
- **RF9 (No deseado):** Si la carta no se puede obtener, entonces el sistema deberá mostrar un mensaje que explique el problema (incluido el caso sin conexión) y una acción "Reintentar".
- **RF10 (No deseado):** Si una categoría no tiene platos, entonces el sistema deberá ocultarla; y si la carta no tiene ningún plato, deberá mostrar un estado vacío que explique que la carta no está disponible y sugiera consultar al personal.
- **RF11 (Evento):** Cuando el cliente toca una categoría en la navegación de categorías, el sistema deberá desplazar la vista hasta el inicio de esa categoría.
- **RF12 (Estado):** Mientras el cliente recorre la carta, el sistema deberá resaltar en la navegación la categoría que está a la vista.
- **RF13 (Estado):** Mientras un plato no esté disponible, o tenga algún grupo obligatorio sin suficientes opciones disponibles para alcanzar su mínimo (decisión del usuario, P4), el sistema deberá mostrarlo como "Agotado", no abrir su ficha para agregar e impedir que se agregue al pedido.
- **RF45 (Evento):** Cuando la app vuelve a primer plano, el sistema deberá actualizar la carta sin perder la posición en la carta, la hoja abierta ni el pedido en curso.

### D. Ficha del plato y personalización
- **RF14 (Evento):** Cuando el cliente toca un plato disponible, el sistema deberá abrir su ficha con imagen, descripción, etiquetas, grupos de opciones, selector de cantidad y nota opcional para la cocina; y deberá poder cerrarse sin agregar nada.
- **RF15 (Ubicuo):** El sistema deberá soportar grupos de opciones de elección única y de elección múltiple, cada uno con mínimo y máximo de selecciones, opciones con costo adicional (cero o positivo) y opciones no disponibles (visibles pero no seleccionables).
- **RF16 (Estado):** Mientras un grupo obligatorio no alcance su mínimo de selecciones, el sistema deberá impedir agregar el plato e indicar, junto a ese grupo, cuántas opciones faltan elegir.
- **RF17 (Estado):** Mientras un grupo de elección múltiple tenga seleccionado su máximo de opciones, el sistema deberá deshabilitar las opciones no seleccionadas de ese grupo e informar el límite junto al grupo. En un grupo de elección única, elegir otra opción reemplaza la anterior.
- **RF18 (Estado):** Mientras el cliente personaliza un plato, el sistema deberá mostrar el importe de la línea actualizado: (precio base + adicionales elegidos) × cantidad.
- **RF19 (Evento):** Cuando el cliente confirma "Agregar", el sistema deberá sumar la línea al pedido en curso, cerrar la ficha y confirmar el agregado de forma visible y anunciada a tecnologías de asistencia, también con movimiento reducido. Si ya existe una línea con el mismo plato, las mismas opciones y la misma nota, deberá sumar las cantidades en esa línea; si la suma supera 20, la línea queda en 20 y el sistema deberá avisar "Máximo 20 por plato" (decisión del usuario, P6).
- **RF20 (Ubicuo):** El sistema deberá mantener la cantidad de cada línea entre 1 y 20 unidades. En la ficha, el mínimo seleccionable es 1. En el resumen, eliminar una línea es una acción explícita "Quitar", siempre disponible, que reemplaza a la acción de restar cuando la cantidad es 1; la cantidad nunca llega a 0. La nota de un plato admite hasta 140 caracteres visibles y la nota general del pedido hasta 200.
- **RF43 (Evento):** Cuando el cliente usa el "atrás" del sistema o del navegador con una hoja abierta (ficha o resumen), el sistema deberá cerrar esa hoja en lugar de salir de la pantalla actual.

### E. Pedido en curso
- **RF21 (Estado):** Mientras el pedido en curso tenga al menos un plato, el sistema deberá mostrar una barra fija con la cantidad de unidades y el total, que abre el resumen del pedido.
- **RF22 (Evento):** Cuando el cliente abre el resumen, el sistema deberá permitir cambiar cantidades, quitar líneas y escribir una nota general, recalculando el total al instante.
- **RF23 (Evento):** Cuando el cliente recarga la página o vuelve a la pestaña con la misma mesa, el sistema deberá conservar el pedido en curso de esa mesa, incluido un intento de envío sin resolver; los pedidos en curso de mesas distintas no deberán mezclarse.
- **RF44 (Estado):** Mientras una línea del pedido en curso no sea válida frente a la carta vigente (plato inexistente o agotado, opción inexistente o no disponible, selección fuera del mínimo o máximo del grupo), el sistema deberá marcarla, explicar el motivo e impedir el envío hasta que el cliente la quite. Los importes del pedido en curso deberán calcularse siempre con los precios vigentes de la carta.

### F. Envío del pedido
- **RF24 (Evento):** Cuando el cliente toca "Enviar pedido" con una mesa válida, al menos un plato y todas las líneas válidas, el sistema deberá enviar el pedido, indicar que se está enviando e impedir envíos duplicados aunque el cliente toque el botón varias veces.
- **RF25 (Evento):** Cuando el pedido queda confirmado, el sistema deberá vaciar el pedido en curso y mostrar la confirmación con el código del pedido y el total confirmado por el restaurante.
- **RF46 (No deseado):** Si al enviar el restaurante calcula un total distinto del que el cliente vio (porque cambió algún precio), entonces el sistema no deberá registrar el pedido: deberá frenar el envío, mostrar el total nuevo y las líneas cuyo precio cambió, y enviar solo cuando el cliente acepte el total nuevo; si no lo acepta, el pedido en curso queda como estaba para editarlo (decisión del usuario, P1).
- **RF26 (No deseado):** Si el envío falla por un problema de conexión, una demora excesiva o un error del servidor, entonces el sistema deberá conservar el pedido en curso sin permitir modificarlo, explicar el error y, antes de cualquier reintento o edición, comprobar con el restaurante si ese intento ya había sido registrado: si lo fue, tratarlo como enviado (RF25); si no, permitir reintentar o volver a editar. Esta comprobación deberá ocurrir también después de recargar la página o de cerrar y reabrir el resumen. En ningún caso deberá generarse un pedido duplicado.
- **RF27 (No deseado):** Si el restaurante rechaza el pedido porque una o más líneas dejaron de ser válidas (plato u opción no disponible o inexistente, selección inválida), entonces el sistema deberá señalar cada línea afectada con su motivo y pedir quitarla antes de reenviar. Para cambiar una línea, el cliente la quita y vuelve a agregar el plato desde la carta.

### G. Seguimiento ("Mis pedidos")
- **RF28 (Ubicuo):** El sistema deberá ofrecer la sección "Mis pedidos" con **todos los pedidos activos enviados desde este dispositivo, de cualquier mesa**, cada uno con su número de mesa, durante las últimas 12 horas (incluidos los enviados desde otra pestaña del mismo navegador, que deberán aparecer en tiempo real), mostrando código, mesa, hora, detalle de líneas, total confirmado y el estado actual dentro de la secuencia de estados. Un pedido deja de listarse cuando llega a un estado final (entregado o cancelado) o cumple 12 horas; si llega a un estado final mientras el cliente está en "Mis pedidos", sigue visible con ese estado hasta que salga de la sección (decisión del usuario, P3).
- **RF29 (Evento):** Cuando cambia el estado de un pedido del cliente, el sistema deberá actualizarlo en pantalla sin recargar y anunciar a tecnologías de asistencia el código y el nuevo estado (por ejemplo: "Pedido K7F2: En preparación"). La carga inicial de la lista no se anuncia.
- **RF47 (Evento):** Cuando cambia el estado de un pedido del cliente mientras está en la carta (y no en "Mis pedidos"), el sistema deberá mostrar un aviso breve arriba de la carta con el código y el nuevo estado, anunciarlo a tecnologías de asistencia y marcar el acceso a "Mis pedidos" con una indicación de novedad hasta que el cliente entre a esa sección. No se usan notificaciones del sistema operativo (decisión del usuario, P2).
- **RF48 (Estado):** Mientras un pedido del cliente lleve 10 minutos o más en estado "Enviado" sin ser confirmado, el sistema deberá mostrar en ese pedido, en "Mis pedidos", el mensaje "Tu pedido está tardando, avisá al mozo". El umbral de 10 minutos es una regla compartida con la Spec 002, cuyo panel marcará el pedido como demorado (decisión del usuario, P5).
- **RF30 (Evento):** Cuando la app vuelve a primer plano o recupera la conexión, el sistema deberá actualizar el estado de los pedidos del cliente sin mostrar estados más viejos que los que ya mostraba.
- **RF31 (No deseado):** Si un pedido es cancelado por el personal, entonces el sistema deberá mostrarlo como cancelado e indicar que consulte al personal.
- **RF32 (Evento):** Cuando el cliente toca "Pedir algo más" o usa el "atrás" desde "Mis pedidos", el sistema deberá volver a la carta conservando la mesa, la posición en la carta y el pedido en curso.
- **RF42 (Estado):** Mientras el dispositivo tenga pedidos activos (de cualquier mesa), el sistema deberá mostrar en la barra superior el acceso a "Mis pedidos" con la cantidad de pedidos activos. Mientras no haya pedidos activos, el acceso deberá mostrarse solo si la mesa es válida. Si el cliente llega a "Mis pedidos" sin pedidos activos y sin mesa válida, deberá ver el aviso de mesa de RF2 y el acceso a la carta.

### H. Idioma
- **RF33 (Ubicuo):** El sistema deberá mostrar la interfaz en español por defecto.
- **RF34 (Evento):** Cuando el cliente elige otro idioma (español o inglés), el sistema deberá mostrar en ese idioma toda la interfaz, el contenido de la carta, la ficha abierta y el detalle de sus pedidos, sin perder selecciones ni datos; formatear precios y horas según el idioma; y recordar la elección en el dispositivo.
- **RF35 (No deseado):** Si un texto de la carta no tiene traducción al idioma elegido, entonces el sistema deberá mostrarlo en español.

### I. Ciclo de vida del pedido y tiempo real (contrato que reutiliza la Spec 002)
- **RF36 (Ubicuo):** El sistema deberá registrar cada pedido con: código corto (§3.3), mesa, líneas (plato, opciones, cantidad, nota y precios vigentes al momento del pedido, en ambos idiomas), nota general, total, estado, fecha y hora de creación y de última modificación, e historial de cambios de estado con su hora.
- **RF37 (Ubicuo):** El sistema deberá respetar el ciclo de vida y las reglas de cambio de estado de §3 y rechazar cualquier transición no permitida.
- **RF38 (Ubicuo):** El sistema deberá calcular y validar precios, disponibilidad y opciones del lado del restaurante al recibir un pedido; el total confirmado es el que vale.
- **RF39 (Evento):** Cuando se crea un pedido o cambia su estado, el sistema deberá emitir un aviso en tiempo real a todas las vistas interesadas (los dispositivos que siguen esa mesa y, en la Spec 002, cocina y salón), incluyendo el estado anterior y el nuevo.
- **RF40 (Opcional):** Donde no exista todavía el servidor real (modo demostración), el sistema deberá sincronizar pedidos y estados entre pestañas del mismo navegador, de modo que un pedido enviado o un estado cambiado en una pestaña aparezca en tiempo real en otra.

---

## 3. Reglas de negocio

### 3.1 Ciclo de vida del pedido

| Estado | Nombre para el cliente (ES / EN) | Significado |
|---|---|---|
| `pending` | Enviado / Sent | El pedido llegó al sistema; cocina todavía no lo confirmó. |
| `accepted` | Confirmado / Confirmed | Cocina vio y aceptó el pedido. |
| `preparing` | En preparación / Being prepared | Cocina lo está preparando. |
| `ready` | Listo para servir / Ready to serve | Está listo para que el salón lo lleve a la mesa. |
| `delivered` | Entregado / Served | Fue entregado en la mesa. Estado final. |
| `cancelled` | Cancelado / Cancelled | El personal lo canceló. Estado final. |

Transiciones permitidas (cualquier otra se rechaza):

```
pending ──► accepted ──► preparing ──► ready ──► delivered
   │            │             │           │
   └────────────┴─────────────┴───────────┴──► cancelled
```

- Solo el **cliente** crea pedidos (estado inicial `pending`).
- Solo el **personal** (Spec 002) cambia estados. Sin login esto no se puede garantizar todavía: es un riesgo conocido y aceptado para la demo (§3.5).
- Los estados finales (`delivered`, `cancelled`) no admiten transiciones.
- **Demora:** un pedido está *demorado* cuando lleva 10 minutos o más en `pending`. El umbral es una regla única compartida por el cliente (RF48) y el panel de la Spec 002.

### 3.2 Cambios de estado concurrentes (para la Spec 002)
- Pedir el cambio al estado que el pedido ya tiene no es un error: se ignora y no genera aviso.
- Quien pide un cambio indica el estado que veía; si el pedido cambió desde entonces, el cambio se rechaza como conflicto y se devuelve el estado actual, para que dos miembros del personal no se pisen.

### 3.3 Código de pedido
- 4 caracteres tomados de un alfabeto sin caracteres ambiguos: dígitos del 2 al 9 y letras mayúsculas sin `I` ni `O` (no se usan `0`, `1`, `I`, `O`).
- Único entre los pedidos creados en las últimas 24 horas (lo que incluye a todos los activos). Ante una coincidencia, el restaurante genera otro.

### 3.4 Envíos y reintentos
- Cada intento de envío tiene un identificador único. El restaurante registra a lo sumo un pedido por intento: repetir el mismo intento devuelve el mismo pedido.
- Repetir un intento con un contenido distinto se rechaza.
- Un intento de resultado desconocido (sin respuesta) se resuelve consultando al restaurante por ese identificador antes de reintentar o editar (RF26).
- El cliente envía el total que vio. Si el restaurante calcula otro total, rechaza el intento sin registrar el pedido y devuelve el total nuevo (RF46). Un intento rechazado no registra nada; el envío siguiente, ya con el total aceptado, es un intento nuevo.

### 3.5 Riesgos conocidos y aceptados (demo)
- **Sin autenticación (decisión del usuario, P7):** en la demo cualquiera que conozca la dirección podría seguir los avisos de una mesa o, cuando exista el panel, cambiar estados. El riesgo se acepta solo para la demostración. La autenticación real del personal (y la validación de quién cambia estados) se resuelve junto con el servidor antes de cualquier uso real, fuera del alcance de la 001. Los pedidos no contienen datos personales.

---

## 4. Requisitos no funcionales

- **RNF1 (Móvil primero):** La vista del cliente deberá ser plenamente usable desde 320 px de ancho, sin desplazamiento horizontal, con objetivos táctiles de al menos 44 × 44 px y respetando las zonas seguras del dispositivo (notch, barra de inicio). Debe verse correctamente también en tablet y escritorio.
- **RNF2 (Accesibilidad):** WCAG 2.1 AA: contraste de al menos 4,5:1 en texto normal y 3:1 en texto grande y componentes, foco visible, operable con teclado y lector de pantalla, nombres accesibles en controles con ícono y estados que no dependan solo del color. **Verificación:** análisis automático de accesibilidad sin violaciones en cada pantalla, contraste documentado por superficie, recorrido completo con teclado y puntaje de accesibilidad de Lighthouse de 95 o más.
- **RNF3 (Rendimiento percibido):** La carta deberá aceptar toques desde que se muestra, también durante la secuencia de entrada. **Métrica:** con un celular de gama media simulado (CPU ×4 más lenta), la respuesta a una interacción (INP) deberá ser menor a 200 ms y el desplazamiento de la carta con el carrusel en pantalla no deberá tener tareas largas de más de 50 ms.
- **RNF4 (Reemplazabilidad del origen de datos):** Mientras no exista el servidor, la app funcionará con datos simulados; el reemplazo por el servidor real no deberá requerir cambios en las pantallas.
- **RNF5 (Reutilización por la Spec 002):** El modelo de pedido, los estados, las reglas de §3, los avisos en tiempo real, los componentes visuales base, los tokens de diseño y la infraestructura de idiomas deberán quedar disponibles para el panel de cocina y salón.
- **RNF6 (Calidad):** Cada requisito funcional deberá estar cubierto por al menos una prueba automatizada escrita antes del código (TDD), y la suite deberá estar en verde para dar una tarea por terminada. Los RNF se verifican según lo indicado en cada uno y en §8.
- **RNF7 (Lenguaje visual):** Experiencia oscura e inmersiva, tipografía grande y movimiento con propósito, adaptada de las referencias de `docs/referencias/` al contexto de restaurante, sin reutilizar sus textos, imágenes, URLs ni ilustraciones.
- **RNF8 (Resiliencia):** Si el navegador no permite guardar datos (por ejemplo, modo privado), la app deberá seguir funcionando aunque no recuerde idioma, pedido en curso, intentos de envío, pedidos anteriores ni si ya vio la secuencia de entrada.
- **RNF9 (Canal en tiempo real bidireccional):** El canal en tiempo real con el servidor deberá admitir mensajes en ambos sentidos, de modo que la Spec 002 pueda agregar avisos desde la mesa hacia el restaurante (por ejemplo "Llamar al mozo") sin cambiar el contrato de pedidos. En la 001 solo se usan avisos del restaurante hacia el cliente. **Verificación:** revisión del contrato propuesto con el responsable del servidor (no hay código del canal real en la 001).
- **RNF10 (Independencia del transporte y consistencia):** Las pantallas no deberán depender de cómo llegan los avisos en tiempo real (simulación entre pestañas hoy, conexión con el servidor mañana). Con cualquier origen, la vista deberá quedar consistente: sin pedidos duplicados, sin estados que retrocedan y sin avisos perdidos entre la carga inicial y la suscripción. **En la 001** se exige y prueba la consistencia con la simulación y con los refrescos de RF30; la reconexión automática con el servidor real la resuelve el futuro adaptador del servidor (fuera de la 001), con las reglas ya definidas en el plan.

---

## 5. Casos límite y manejo de errores

| # | Situación | Comportamiento esperado | RF |
|---|---|---|---|
| CL1 | URL sin `mesa`, vacía (`mesa=`), con `mesa=abc`, `mesa=0`, `mesa=-3`, `mesa=12.5`, `mesa=1000` o un número que no es una mesa existente | Solo lectura; agregar y enviar bloqueados; aviso visible. `mesa=012` equivale a la mesa 12. Si `mesa` aparece repetida, vale la primera. | RF2 |
| CL2 | El cliente escanea el QR de otra mesa (después de haber enviado pedidos) | Se usa la nueva mesa; su pedido en curso es independiente del de la mesa anterior; "Mis pedidos" sigue mostrando los pedidos activos de ambas mesas, cada uno con su número de mesa. | RF23, RF28 |
| CL3 | Falla la carga de la carta o no hay conexión | Mensaje claro (distingue "sin conexión") y "Reintentar". | RF9 |
| CL4 | Carta vacía o categoría vacía | Categoría vacía oculta; carta vacía con estado explicativo. | RF10 |
| CL5 | Plato agotado | Visible como "Agotado", no se puede agregar ni aparece entre los destacados de la portada. | RF13, RF4 |
| CL6 | Opción no disponible | Visible y deshabilitada, con indicación. | RF15 |
| CL7 | Grupo obligatorio sin elegir | "Agregar" deshabilitado y mensaje junto al grupo con cuántas faltan. | RF16 |
| CL8 | Se alcanza el máximo de un grupo múltiple | Las opciones no elegidas quedan deshabilitadas y se informa el límite. | RF17 |
| CL9 | Se agrega dos veces el mismo plato con las mismas opciones y nota | Se suma la cantidad en la misma línea. Si la suma supera 20, queda en 20 y se avisa "Máximo 20 por plato". | RF19, RF20 |
| CL10 | En el resumen, una línea tiene cantidad 1 | La acción de restar se reemplaza por "Quitar"; la cantidad nunca llega a 0. | RF20, RF22 |
| CL11 | Doble toque en "Enviar pedido" | Se envía un único pedido. | RF24 |
| CL12 | Falla de red o error del servidor al enviar | Se conserva el pedido en curso bloqueado para edición; antes de reintentar se comprueba si el intento llegó; nunca se duplica. | RF26 |
| CL13 | Un plato u opción se agota entre que se armó el pedido y se envió | El restaurante rechaza el pedido indicando qué líneas y por qué; el cliente las quita (y si quiere vuelve a agregar el plato con otras opciones) y reenvía. | RF27 |
| CL14 | El precio cambió entre la carga de la carta y el envío | El envío se frena sin registrar el pedido; se muestran el total nuevo y las líneas que cambiaron; se envía solo si el cliente acepta. | RF46, RF38 |
| CL15 | Al recargar, una línea guardada corresponde a un plato que ya no existe o está agotado | La línea se marca como no válida y se pide quitarla antes de enviar. | RF23, RF44 |
| CL16 | El celular se bloquea o la app queda en segundo plano mientras se espera el pedido | Al volver, los estados se actualizan. | RF30 |
| CL17 | Se pierde y recupera la conexión durante el seguimiento | Al recuperar conexión, los estados se vuelven a sincronizar sin pedidos duplicados ni estados que retrocedan. | RF30, RNF10 |
| CL18 | El personal cancela el pedido | Se ve "Cancelado" con indicación de consultar al personal. | RF31 |
| CL19 | Se cambia de idioma con una ficha abierta o en "Mis pedidos" | Todo el contenido visible cambia de idioma sin perder selección ni datos. | RF34 |
| CL20 | Falta la traducción al inglés de un plato | Se muestra en español. | RF35 |
| CL21 | Textos largos (traducciones ~30 % más largas, nombres de platos extensos) | El diseño se adapta sin cortar precios ni superponer elementos. | RNF1 |
| CL22 | Movimiento reducido activado | Sin secuencia de entrada ni rotación; fundidos breves; la confirmación de "agregado" sigue siendo visible y anunciada. | RF6, RF19 |
| CL23 | Almacenamiento del navegador bloqueado | La app funciona sin recordar datos. | RNF8 |
| CL24 | Intento de transición de estado no permitida (por ejemplo, `delivered` → `preparing`) | Se rechaza. | RF37 |
| CL25 | Otro celular de la misma mesa también hace un pedido | Se acepta como un pedido independiente (no hay bloqueo por mesa); cada dispositivo ve solo los pedidos que envió. | RF28 |
| CL26 | No se puede verificar la mesa (sin conexión o error del servidor) aunque la carta cargue | Agregar y enviar bloqueados, aviso con "Reintentar" y reintento automático al recuperar conexión. | RF41 |
| CL27 | Con un pedido en curso armado, la carta cambia: un plato se agota, una opción desaparece o queda no disponible, cambian el mínimo o el máximo de un grupo o el precio de una opción | Las líneas afectadas se marcan con su motivo y bloquean el envío hasta quitarlas; los importes se recalculan con los precios vigentes. | RF44, RF45 |
| CL28 | El envío no responde a tiempo pero el pedido sí se creó en el restaurante | Al comprobar el intento se encuentra el pedido: se trata como enviado, aparece en "Mis pedidos" y no se duplica. | RF26 |
| CL29 | El cliente usa "atrás" con la ficha o el resumen abiertos | Se cierra la hoja; la pantalla no cambia. | RF43 |
| CL30 | Se llega a "Mis pedidos" sin una mesa válida | Si el dispositivo tiene pedidos activos, se listan (cada uno con su mesa). Si no tiene, se muestra el aviso de mesa y el acceso a la carta. | RF42 |
| CL31 | El cliente envía un pedido desde una segunda pestaña del mismo navegador | Aparece en "Mis pedidos" de ambas pestañas en tiempo real (mismo dispositivo). | RF28, RF40 |
| CL32 | Un grupo obligatorio no tiene suficientes opciones disponibles para su mínimo | El plato se muestra como "Agotado" y no se abre para agregar. | RF13 |
| CL33 | Un pedido lleva 10 minutos o más en "Enviado" sin ser confirmado | "Mis pedidos" muestra "Tu pedido está tardando, avisá al mozo" en ese pedido; el mensaje aparece solo al cumplirse el plazo aunque el cliente no recargue. | RF48 |
| CL37 | Un pedido cambia de estado mientras el cliente está en la carta | Aviso breve arriba de la carta, anunciado, y marca de novedad en "Mis pedidos" hasta entrar. | RF47 |
| CL38 | El cliente no acepta el total nuevo | No se envía nada; el pedido en curso queda editable con los precios vigentes. | RF46 |
| CL39 | Un pedido entregado o cancelado | Deja de listarse en "Mis pedidos" (si el cliente está mirando la sección, se ve el estado final hasta que salga). | RF28, RF31 |
| CL34 | El código generado coincide con el de otro pedido de las últimas 24 h | Se genera otro código. | RF36 |
| CL35 | Dos miembros del personal cambian el estado del mismo pedido a la vez (Spec 002) | Según §3.2: el mismo estado se ignora; el que llega tarde con un estado viejo recibe un conflicto. | RF37 |
| CL36 | Un plato pertenece a una categoría que no existe | No se muestra. | RF7 |

---

## 6. Supuestos

1. **Moneda y precios (confirmado por el usuario):** pesos argentinos (ARS), impuestos incluidos, sin propina. Los importes se muestran sin decimales cuando son enteros.
2. **Mesas válidas:** las define el restaurante; en el modo demostración son las mesas 1 a 20.
3. **Sin mesa válida, solo lectura (confirmado por el usuario):** se puede mirar la carta y las fichas, pero no se ingresa el número de mesa a mano, para evitar pedidos a mesas equivocadas.
4. **Un solo celular por pedido (confirmado por el usuario):** el celular que arma el pedido es el que lo envía y lo sigue; el pedido en curso y el seguimiento viven en ese dispositivo. No hay carrito compartido ni sincronización de pedidos entre celulares de la misma mesa.
   - **Sin bloqueo por mesa:** el sistema no impide que otro celular de la misma mesa haga su propio pedido; si ocurre, es un pedido independiente que solo ve el dispositivo que lo envió (CL25). Imponer un único celular por mesa queda fuera de esta spec.
5. **"Mis pedidos"** muestra solo los pedidos activos enviados desde este dispositivo (este navegador, en cualquiera de sus pestañas), de cualquier mesa, en las últimas 12 horas.
6. **El pedido en curso** sobrevive a recargas mientras la pestaña siga abierta; al cerrarla se descarta. Los pedidos enviados y el idioma sí se recuerdan entre visitas.
7. **El restaurante está siempre abierto** (sin horarios ni cierre de cocina en esta spec).
8. **Sin preselección** de opciones: el cliente elige explícitamente en los grupos obligatorios.
9. **Solo tema oscuro**, coherente con las referencias y el ambiente del salón.
10. **Nombre del restaurante provisional (confirmado por el usuario):** "Fogón" (configurable). Imágenes de platos: representaciones provisionales (degradados con íconos de comida) hasta tener fotos reales.
11. **Navegadores objetivo:** Safari iOS 16.4 o superior, Chrome 111 o superior (Android y escritorio) y Firefox 128 o superior.
12. **El cliente no puede cancelar** un pedido enviado; debe pedírselo al personal.
13. **Los caracteres de las notas** se cuentan como caracteres visibles (un emoji cuenta como uno).

### 6.1 Decisiones confirmadas por el usuario (2026-10-11)
| # | Tema | Decisión (el detalle técnico está en `plan.md`) |
|---|---|---|
| 1 | Contratos de datos | Deben quedar tipados y verificables, porque se comparten con el servidor y la Spec 002 (`plan.md` §1.3). |
| 2 | Nombre y moneda | "Fogón" (provisorio) y ARS. |
| 3 | Sin QR válido | Solo lectura: mirar la carta, sin ingresar la mesa a mano. |
| 4 | Carrito compartido | No: un solo celular hace el pedido y todo vive en ese celular. No se agrega bloqueo por mesa. |
| 5 | Canal en tiempo real con el servidor | Debe ser bidireccional para permitir, en la Spec 002, avisos desde la mesa como "Llamar al mozo" (`plan.md` §7.4). |

---

## 7. Fuera de alcance

**Va en la Spec 002 (panel de cocina y salón):**
- Pantalla de selección "Cocina" / "Salón" (sin login por ahora).
- Recepción de comandas en tiempo real y cambio de estados por el personal (con las reglas de §3.2).
- Alertas visuales, sonoras (con botón "Activar sonido" por la política de reproducción automática) y por demora según el estado del pedido.
- Candidato: botón "Llamar al mozo" desde la mesa. En la 001 solo queda reservado su lugar en el contrato del canal en tiempo real (RNF9); no hay interfaz ni lógica.

**Fuera del proyecto por ahora:**
- Pagos, propinas, división de cuenta.
- Cuentas de usuario, login, historial entre dispositivos.
- Servidor real y base de datos (los hace el compañero; esta spec propone el contrato en `plan.md`).
- Edición de la carta por el restaurante, gestión de stock y generación de los códigos QR.
- Edición de una línea ya agregada (se quita y se vuelve a agregar), cancelación por parte del cliente, reservas, bloqueo de un único celular por mesa.
- Modo claro, otros idiomas además de español e inglés.
- Instalación como app (PWA), notificaciones push y funcionamiento sin conexión.

---

## 8. Criterios de finalización de la spec

1. Todos los RF tienen al menos una prueba automatizada en verde (matriz en `plan.md` §13.3) y `npm run build` termina sin errores.
2. El flujo completo QR → carta → ficha → pedido en curso → envío → "Mis pedidos" con cambio de estado funciona en el modo demostración, incluida la sincronización entre pestañas, cubierto por una prueba de integración.
3. Validación visual registrada en anchos de 320, 375, 768 y 1280 px, con y sin movimiento reducido, sin desplazamiento horizontal (cada tarea con interfaz la hace para lo que construye; la última la repite completa).
4. RNF2 y RNF3 verificados con las métricas indicadas en cada uno.
5. RNF9 revisado con el responsable del servidor.
6. **Paso manual del usuario (no lo ejecuta el agente implementador):** checklist en un celular real conectado por la red local (`plan.md` §11.1): sin destello al tocar, sin zoom en las notas, barras respetando el notch y la barra de inicio, hojas usables con el teclado abierto, arrastre de hojas fluido, carrusel sin tirones, "atrás" del sistema cerrando hojas.
7. `opencode/memory.md` actualizado al cerrar la última tarea.

---

## 9. Decisiones del usuario tras la revisión QA (2026-10-11)

| # | Tema | Decisión | Dónde |
|---|---|---|---|
| P1 | El precio cambió entre el armado y el envío | Reconfirmar: se frena el envío y se muestra el total nuevo para que el cliente lo acepte antes de enviar. | RF46, CL14, CL38, §3.4 |
| P2 | Cambio de estado mientras el cliente está en la carta | Aviso breve arriba de la carta y marca de novedad en "Mis pedidos". Sin notificaciones push. | RF47, CL37 |
| P3 | Cliente que cambia de mesa tras enviar | "Mis pedidos" muestra todos los pedidos activos del dispositivo, cada uno con su mesa, hasta entregado o 12 h. | RF28, RF42, CL2, CL30, CL39 |
| P4 | Grupo obligatorio sin opciones disponibles | El plato se muestra como agotado y no se abre para agregar. | RF13, CL32 |
| P5 | Pedido que nunca se confirma | A los 10 minutos en "Enviado", "Mis pedidos" muestra "Tu pedido está tardando, avisá al mozo"; la 002 lo marca como demorado con el mismo umbral. | RF48, CL33, §3.1 |
| P6 | Tope al fusionar líneas | Queda en 20 y avisa "Máximo 20 por plato". | RF19, CL9 |
| P7 | Seguridad sin login | Riesgo aceptado para la demo; la autenticación real se resuelve con el servidor antes de uso real. | §3.5 |
