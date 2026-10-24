import type { OrderStatus } from "@/generated/prisma/enums";
import { positionBetween } from "@/lib/position";
import type { KanbanBoard, KanbanCard } from "@/server/dal/orders";

// ============================================================================
// Lógica pura del tablero Kanban (sin React ni dnd-kit), probada en
// tests/unit/kanban-board.test.ts.
//
// Durante el arrastre la UI trabaja con `ColumnIds` (solo IDs por columna)
// para previsualizar el movimiento; al soltar, calcula la llave fraccional
// con las tarjetas vecinas y aplica el cambio al cache con applyCardMove.
// ============================================================================

export type ColumnIds = Record<OrderStatus, string[]>;

export type CardMove = {
  orderId: string;
  toStatus: OrderStatus;
  position: string;
  version: number;
};

export function boardToColumnIds(board: KanbanBoard): ColumnIds {
  return Object.fromEntries(board.columns.map((column) => [column.status, column.cards.map((c) => c.id)])) as ColumnIds;
}

/** Columna que contiene `id`. `id` puede ser una tarjeta o la propia columna (droppable vacío). */
export function findColumn(columns: ColumnIds, id: string): OrderStatus | undefined {
  if (id in columns) return id as OrderStatus;
  return (Object.keys(columns) as OrderStatus[]).find((status) => columns[status].includes(id));
}

/**
 * onDragOver: si la tarjeta entra en otra columna, la mueve ahí (antes de
 * la tarjeta que está debajo del puntero, o al final si es la columna vacía).
 * Devuelve el mismo objeto si no hay cambio, para no re-renderizar.
 */
export function moveAcrossColumns(columns: ColumnIds, activeId: string, overId: string): ColumnIds {
  const from = findColumn(columns, activeId);
  const to = findColumn(columns, overId);
  if (!from || !to || from === to) return columns;

  const target = columns[to];
  const overIndex = target.indexOf(overId);
  const insertAt = overIndex >= 0 ? overIndex : target.length;

  return {
    ...columns,
    [from]: columns[from].filter((id) => id !== activeId),
    [to]: [...target.slice(0, insertAt), activeId, ...target.slice(insertAt)],
  };
}

/** onDragEnd: reordena dentro de la columna final según la tarjeta sobre la que se soltó. */
export function reorderWithinColumn(columns: ColumnIds, activeId: string, overId: string): ColumnIds {
  const column = findColumn(columns, activeId);
  if (!column || findColumn(columns, overId) !== column) return columns;

  const ids = columns[column];
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (to < 0 || from === to) return columns;

  const next = [...ids];
  next.splice(to, 0, ...next.splice(from, 1));
  return { ...columns, [column]: next };
}

/**
 * Llave fraccional para que la tarjeta quede en `index` de su columna final.
 * `neighbors` son las tarjetas de esa columna SIN la arrastrada, en orden.
 * Si la columna está truncada (KANBAN_COLUMN_LIMIT), soltar al final la deja
 * después de la última visible, que es lo que el usuario ve.
 */
export function positionForIndex(neighbors: Pick<KanbanCard, "position">[], index: number): string {
  const before = neighbors[index - 1]?.position ?? null;
  const after = neighbors[index]?.position ?? null;
  return positionBetween(before, after);
}

// `<` de JS compara por unidades UTF-16: igual que COLLATE "C" para llaves base62.
function compareCards(a: KanbanCard, b: KanbanCard) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Aplica un movimiento al tablero de forma inmutable: saca la tarjeta de su
 * columna, la inserta en la de destino ordenada por `position` y ajusta los
 * totales. Se usa para la actualización optimista, para confirmar con la
 * versión del servidor y para el rollback (moviendo de vuelta al origen).
 */
export function applyCardMove(board: KanbanBoard, move: CardMove): KanbanBoard {
  let card: KanbanCard | undefined;
  let fromStatus: OrderStatus | undefined;

  const withoutCard = board.columns.map((column) => {
    const found = column.cards.find((c) => c.id === move.orderId);
    if (!found) return column;
    card = found;
    fromStatus = column.status;
    return { ...column, cards: column.cards.filter((c) => c.id !== move.orderId) };
  });

  if (!card) return board;
  const moved: KanbanCard = { ...card, status: move.toStatus, position: move.position, version: move.version };
  const changesColumn = fromStatus !== move.toStatus;

  return {
    ...board,
    columns: withoutCard.map((column) => {
      if (column.status === move.toStatus) {
        return {
          ...column,
          total: column.total + (changesColumn ? 1 : 0),
          cards: [...column.cards, moved].sort(compareCards),
        };
      }
      if (column.status === fromStatus && changesColumn) return { ...column, total: column.total - 1 };
      return column;
    }),
  };
}

export function findCard(board: KanbanBoard, orderId: string): KanbanCard | undefined {
  for (const column of board.columns) {
    const card = column.cards.find((c) => c.id === orderId);
    if (card) return card;
  }
  return undefined;
}
