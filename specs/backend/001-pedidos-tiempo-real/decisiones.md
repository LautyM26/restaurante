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
