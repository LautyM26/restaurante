const HOUR_MS = 60 * 60 * 1000;

/** Cantidad máxima por línea de pedido (R3.4). */
export const MAX_QTY = 20;
/** Cantidad máxima de líneas por pedido. */
export const MAX_LINES = 50;
/** Largo máximo (caracteres visibles) de la nota de una línea (D-085, D-086). */
export const NOTE_MAX = 140;
/** Largo máximo (caracteres visibles) de la nota del pedido (D-085, D-086). */
export const ORDER_NOTE_MAX = 200;
/** Largo máximo de `lineId` (D-113). */
export const LINE_ID_MAX = 4096;

/** Ventana del listado por `tableId` sin otros filtros: `createdAt >= now - 12 h` (R10.2, §6.6). */
export const TABLE_LIST_WINDOW_MS = 12 * HOUR_MS;
/** Ventana de unicidad del código corto: pedidos con `createdAt > now - 24 h` (R3.9, §8.6). */
export const SHORT_CODE_WINDOW_MS = 24 * HOUR_MS;

/** `GET /api/orders`: máximo de ids en `ids` (D-098, §6.6). */
export const MAX_IDS_FILTER = 100;
/** `GET /api/orders`: máximo de `tableId` repetidos (D-098, §6.6). */
export const MAX_TABLE_ID_FILTER = 20;

/** WebSocket: máximo de `tableId` por suscripción (D-094, §7.3). */
export const WS_MAX_TABLE_IDS = 20;
/** WebSocket: `maxPayload` en bytes (D-094, §7.2). */
export const WS_MAX_PAYLOAD_BYTES = 16 * 1024;
